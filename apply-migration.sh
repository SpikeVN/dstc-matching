#!/usr/bin/env bash
set -euo pipefail

# === Apply a migration file to the self-hosted production DB ===
# Usage: ./apply-migration.sh <migration-filename.sql>
# Example: ./apply-migration.sh 20260726180000_add_feature.sql
#
# Runs the migration via SSH + docker exec (bypasses PgBouncer),
# then registers it in supabase_migrations.schema_migrations.

DB_HOST="root@mainframe.cteftu.id.vn"
DB_CONTAINER="supabase-db"
MIGRATIONS_DIR="$(dirname "$0")/supabase/migrations"
TRACKING_TABLE="supabase_migrations.schema_migrations"

FILE="$1"

if [ -z "$FILE" ]; then
  echo "Usage: $0 <path-to-migration.sql>"
  echo "Example: $0 supabase/migrations/20260726180000_add_feature.sql"
  exit 1
fi

# Resolve to just the filename if a relative/absolute path is given
FILE="$(basename "$FILE")"

if [ ! -f "$MIGRATIONS_DIR/$FILE" ]; then
  echo "Error: file not found: $MIGRATIONS_DIR/$FILE"
  exit 1
fi

VERSION="${FILE%%_*}"   # Extracts YYYYMMDDHHMMSS prefix
NAME="${FILE%.sql}"     # Full name without .sql extension

# Validate version looks like a 14-digit timestamp
if ! echo "$VERSION" | grep -qE '^[0-9]{14}$'; then
  echo "Error: filename must start with a 14-digit timestamp (YYYYMMDDHHMMSS)"
  echo "  Got: $VERSION  from: $FILE"
  exit 1
fi

echo "→ Checking if version $VERSION is already applied..."
EXISTS=$(ssh "$DB_HOST" "docker exec $DB_CONTAINER psql -U postgres -d postgres -tAc \
  \"SELECT COUNT(*) FROM $TRACKING_TABLE WHERE version='$VERSION';\"")

if [ "$EXISTS" -gt 0 ]; then
  echo "✓ Migration $VERSION already applied — skipping."
  exit 0
fi

echo "→ Applying migration: $FILE"
cat "$MIGRATIONS_DIR/$FILE" | ssh "$DB_HOST" "docker exec -i $DB_CONTAINER psql -U postgres -d postgres"
echo "✓ SQL applied successfully."

echo "→ Registering version $VERSION..."
ssh "$DB_HOST" "docker exec $DB_CONTAINER psql -U postgres -d postgres -c \
  \"INSERT INTO $TRACKING_TABLE (version, name) VALUES ('$VERSION', '$NAME');\""
echo "✓ Migration $FILE fully applied and registered."