#!/usr/bin/env bash
set -euo pipefail

# === Apply migration(s) to the self-hosted production DB ===
# Usage: ./apply-migration.sh                   # Apply all pending migrations
#        ./apply-migration.sh <filename.sql>    # Apply a specific file (tab-completable)
# Example: ./apply-migration.sh 20260727060000_add_last_active_at.sql
#
# Runs the migration via SSH + docker exec (bypasses PgBouncer),
# then registers it in supabase_migrations.schema_migrations.

DB_HOST="root@mainframe.cteftu.id.vn"
DB_CONTAINER="supabase-db"
MIGRATIONS_DIR="$(dirname "$0")/supabase/migrations"
TRACKING_TABLE="supabase_migrations.schema_migrations"

# ──────────────────────────────────────────────
# Ensure the tracking table exists (idempotent)
# ──────────────────────────────────────────────
ensure_tracking_table() {
  ssh "$DB_HOST" "docker exec $DB_CONTAINER psql -U postgres -d postgres -c \
    \"CREATE SCHEMA IF NOT EXISTS supabase_migrations; CREATE TABLE IF NOT EXISTS $TRACKING_TABLE (version text PRIMARY KEY, statements text[], name text, created_by text);\""
}

# ──────────────────────────────────────────────
# Apply a single migration file and register it
# ──────────────────────────────────────────────
apply_one() {
  local FILE="$1"
  local VERSION="${FILE%%_*}"
  local NAME="${FILE%.sql}"

  echo "→ Checking if version $VERSION is already applied..."
  local EXISTS
  EXISTS=$(ssh "$DB_HOST" "docker exec $DB_CONTAINER psql -U postgres -d postgres -tAc \
    \"SELECT COUNT(*) FROM $TRACKING_TABLE WHERE version='$VERSION';\"")

  if [ "$EXISTS" -gt 0 ]; then
    echo "✓ Migration $VERSION already applied — skipping."
    return 0
  fi

  echo "→ Applying migration: $FILE"
  # Run SQL and registration in a single psql session (transactional).
  # If either fails, the other is rolled back.
  {
    cat "$MIGRATIONS_DIR/$FILE"
    echo "INSERT INTO $TRACKING_TABLE (version, name) VALUES ('$VERSION', '$NAME') ON CONFLICT (version) DO NOTHING;"
  } | ssh "$DB_HOST" "docker exec -i $DB_CONTAINER psql -U postgres -d postgres"

  echo "✓ Migration $FILE applied and registered."
}

# ──────────────────────────────────────────────
# Validate a filename: basename, existence, timestamp prefix
# ──────────────────────────────────────────────
validate_file() {
  local FILE="$1"
  local VERSION="${FILE%%_*}"

  if [ ! -f "$MIGRATIONS_DIR/$FILE" ]; then
    echo "Error: file not found: $MIGRATIONS_DIR/$FILE"
    exit 1
  fi

  if ! echo "$VERSION" | grep -qE '^[0-9]{14}$'; then
    echo "Error: filename must start with a 14-digit timestamp (YYYYMMDDHHMMSS)"
    echo "  Got: $VERSION  from: $FILE"
    exit 1
  fi
}

# ══════════════════════════════════════════════
# Mode 1: No args → apply all pending migrations
# ══════════════════════════════════════════════
if [ $# -eq 0 ]; then
  echo "→ Scanning for all pending migrations..."
  ensure_tracking_table

  # Get all .sql files sorted by name (timestamp order)
  ALL_FILES=()
  while IFS= read -r -d '' f; do
    ALL_FILES+=("$(basename "$f")")
  done < <(find "$MIGRATIONS_DIR" -maxdepth 1 -name '*.sql' -print0 | sort -z)

  # Fetch already-applied versions from production
  APPLIED_VERSIONS=$(ssh "$DB_HOST" "docker exec $DB_CONTAINER psql -U postgres -d postgres -tAc \
    \"SELECT version FROM $TRACKING_TABLE ORDER BY version;\"")

  PENDING=()
  for f in "${ALL_FILES[@]}"; do
    VERSION="${f%%_*}"
    if ! echo "$APPLIED_VERSIONS" | grep -q "^${VERSION}$"; then
      PENDING+=("$f")
    fi
  done

  if [ ${#PENDING[@]} -eq 0 ]; then
    echo "✓ All migrations are already applied — nothing to do."
    exit 0
  fi

  echo "→ Found ${#PENDING[@]} pending migration(s):"
  for f in "${PENDING[@]}"; do
    echo "   • $f"
  done
  echo

  for f in "${PENDING[@]}"; do
    validate_file "$f"
    apply_one "$f"
    echo
  done

  echo "✓ All ${#PENDING[@]} pending migration(s) applied successfully."
  exit 0
fi

# ══════════════════════════════════════════════
# Mode 2: One arg → apply a specific file
# ══════════════════════════════════════════════
FILE="$1"

# Resolve to just the filename if a relative/absolute path is given
FILE="$(basename "$FILE")"

validate_file "$FILE"
ensure_tracking_table
apply_one "$FILE"