#!/bin/bash
# Sync environment variables from .env into .container (Quadlet) files.
# Run this after changing supabase/.env to keep production Quadlet files up to date.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"

if [[ ! -f "$ENV_FILE" ]]; then
    echo "Error: $ENV_FILE not found"
    exit 1
fi

# Source the .env file
set -a
source "$ENV_FILE"
set +a

# URL-encode POSTGRES_PASSWORD for connection strings (+ → %2B, / → %2F, = → %3D)
if [[ -n "${POSTGRES_PASSWORD:-}" ]]; then
    PG_PW_ENCODED=$(python3 -c "import urllib.parse; print(urllib.parse.quote_plus('$POSTGRES_PASSWORD'))" 2>/dev/null || echo "${POSTGRES_PASSWORD_ENCODED:-}")
else
    echo "Warning: POSTGRES_PASSWORD not set in .env"
    exit 1
fi

update_env() {
    local file="$1"
    local key="$2"
    local value="$3"
    if [[ -f "$file" ]]; then
        # Replace the value for the given Environment=KEY=... line
        sed -i "s|^Environment=${key}=.*|Environment=${key}=${value}|" "$file"
    fi
}

update_url_env() {
    local file="$1"
    local key="$2"
    local user="$3"
    local password="$4"
    local host="$5"
    local port="${6:-5432}"
    local db="${7:-postgres}"
    local url="postgresql://${user}:${password}@${host}:${port}/${db}"
    if [[ -f "$file" ]]; then
        sed -i "s|^Environment=${key}=.*|Environment=${key}=${url}|" "$file"
    fi
}

echo "Syncing .env → .container files..."

# supabase-db.container
DB_FILE="$SCRIPT_DIR/supabase-db.container"
update_env "$DB_FILE" POSTGRES_PASSWORD "$POSTGRES_PASSWORD"
update_env "$DB_FILE" JWT_SECRET "${JWT_SECRET:-}"
echo "  ✓ supabase-db.container"

# supabase-auth.container
AUTH_FILE="$SCRIPT_DIR/supabase-auth.container"
update_url_env "$AUTH_FILE" GOTRUE_DB_DATABASE_URL "supabase_auth_admin" "$PG_PW_ENCODED" "supabase-db"
update_env "$AUTH_FILE" GOTRUE_JWT_SECRET "${JWT_SECRET:-}"
update_env "$AUTH_FILE" GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID "${GOOGLE_CLIENT_ID:-}"
update_env "$AUTH_FILE" GOTRUE_EXTERNAL_GOOGLE_SECRET "${GOOGLE_CLIENT_SECRET:-}"
update_env "$AUTH_FILE" GOTRUE_EXTERNAL_EMAIL_ENABLED "${ENABLE_EMAIL_SIGNUP:-true}"
update_env "$AUTH_FILE" GOTRUE_MAILER_AUTOCONFIRM "${ENABLE_EMAIL_AUTOCONFIRM:-true}"
update_env "$AUTH_FILE" GOTRUE_SMTP_ADMIN_EMAIL "${SMTP_ADMIN_EMAIL:-noreply@cteftu.id.vn}"
update_env "$AUTH_FILE" GOTRUE_SMTP_HOST "${SMTP_HOST:-smtp.resend.com}"
# Port 587 (STARTTLS) — GoTrue speaks STARTTLS sequentially; implicit-SSL port 465
# makes it hang ~10s until timeout, which exceeded the signup client's read timeout.
update_env "$AUTH_FILE" GOTRUE_SMTP_PORT "${SMTP_PORT:-587}"
update_env "$AUTH_FILE" GOTRUE_SMTP_USER "${SMTP_USER:-resend}"
update_env "$AUTH_FILE" GOTRUE_SMTP_PASS "${SMTP_PASS:-}"
update_env "$AUTH_FILE" GOTRUE_SMTP_SENDER_NAME "${SMTP_SENDER_NAME:-Data Science Talent Competition}"
update_env "$AUTH_FILE" GOTRUE_SITE_URL "${GOTRUE_SITE_URL:-https://matching.cteftu.id.vn}"
echo "  ✓ supabase-auth.container"

# supabase-rest.container
REST_FILE="$SCRIPT_DIR/supabase-rest.container"
update_url_env "$REST_FILE" PGRST_DB_URI "authenticator" "$PG_PW_ENCODED" "supabase-db"
update_env "$REST_FILE" PGRST_JWT_SECRET "${JWT_SECRET:-}"
echo "  ✓ supabase-rest.container"

# supabase-kong.container
KONG_FILE="$SCRIPT_DIR/supabase-kong.container"
update_env "$KONG_FILE" ANON_KEY "${ANON_KEY:-}"
update_env "$KONG_FILE" SERVICE_ROLE_KEY "${SERVICE_ROLE_KEY:-}"
update_env "$KONG_FILE" SUPABASE_ANON_KEY "${ANON_KEY:-}"
update_env "$KONG_FILE" SUPABASE_SERVICE_ROLE_KEY "${SERVICE_ROLE_KEY:-}"
update_env "$KONG_FILE" DASHBOARD_USERNAME "${DASHBOARD_USERNAME:-supabase}"
update_env "$KONG_FILE" DASHBOARD_PASSWORD "${DASHBOARD_PASSWORD:-}"
echo "  ✓ supabase-kong.container"

# supabase-studio.container
STUDIO_FILE="$SCRIPT_DIR/supabase-studio.container"
update_env "$STUDIO_FILE" SUPABASE_ANON_KEY "${ANON_KEY:-}"
update_env "$STUDIO_FILE" SUPABASE_SERVICE_KEY "${SERVICE_ROLE_KEY:-}"
update_env "$STUDIO_FILE" AUTH_JWT_SECRET "${JWT_SECRET:-}"
update_env "$STUDIO_FILE" POSTGRES_PASSWORD "$PG_PW_ENCODED"
update_env "$STUDIO_FILE" PG_META_CRYPTO_KEY "${PG_META_CRYPTO_KEY:-}"
update_env "$STUDIO_FILE" SUPABASE_PUBLIC_URL "${SUPABASE_PUBLIC_URL:-https://supabase.cteftu.id.vn}"
echo "  ✓ supabase-studio.container"

# supabase-pg-meta.container
PGMETA_FILE="$SCRIPT_DIR/supabase-pg-meta.container"
update_url_env "$PGMETA_FILE" PG_META_DB_URL "postgres" "$PG_PW_ENCODED" "supabase-db"
update_env "$PGMETA_FILE" CRYPTO_KEY "${PG_META_CRYPTO_KEY:-}"
echo "  ✓ supabase-pg-meta.container"

echo ""
echo "Done. Review changes with: git diff supabase/*.container"
