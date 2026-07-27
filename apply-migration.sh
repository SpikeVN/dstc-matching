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
  cat "$MIGRATIONS_DIR/$FILE" | ssh "$DB_HOST" "docker exec -i $DB_CONTAINER psql -U postgres -d postgres"
  echo "✓ SQL applied successfully."

  echo "→ Registering version $VERSION..."
  ssh "$DB_HOST" "docker exec $DB_CONTAINER psql -U postgres -d postgres -c \
    \"INSERT INTO $TRACKING_TABLE (version, name) VALUES ('$VERSION', '$NAME');\""
  echo "✓ Migration $FILE fully applied and registered."
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
  # Get all .sql files sorted by name (timestamp order)
  ALL_FILES=()
  while IFS= read -r f; do
    ALL_FILES+=("$(basename "$f")")
  done < <(ls -1 "$MIGRATIONS_DIR"/*.sql | sort)

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
apply_one "$FILE"