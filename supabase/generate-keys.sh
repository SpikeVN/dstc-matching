#!/usr/bin/env bash
# Generate ANON_KEY and SERVICE_ROLE_KEY JWTs for Supabase self-hosted
# Requires: python3 + PyJWT (pip install pyjwt)
#
# Usage: ./generate-keys.sh
# Reads JWT_SECRET from .env and prints the keys to add back to .env

set -euo pipefail
cd "$(dirname "$0")"

if [ ! -f .env ]; then
  echo "Error: .env not found. Copy .env.example to .env first."
  exit 1
fi

# Source .env
source .env

if [ -z "${JWT_SECRET:-}" ] || [ "$JWT_SECRET" = "change-me-use-openssl-rand-base64-32" ]; then
  echo "Error: Set a real JWT_SECRET in .env first."
  exit 1
fi

# Generate keys using Python (PyJWT is in python-jose or standalone pyjwt)
generate_key() {
  local role="$1"
  python3 -c "
import json, base64, hmac, hashlib, time

secret = '$JWT_SECRET'
now = int(time.time())

header = base64.urlsafe_b64encode(json.dumps({'alg':'HS256','typ':'JWT'}).encode()).rstrip(b'=').decode()
payload = base64.urlsafe_b64encode(json.dumps({
    'role': '$role',
    'iss': 'supabase',
    'iat': now,
    'exp': now + 10*365*24*3600,  # 10 years
    'aud': 'authenticated'
}).encode()).rstrip(b'=').decode()

msg = f'{header}.{payload}'
sig = base64.urlsafe_b64encode(
    hmac.new(secret.encode(), msg.encode(), hashlib.sha256).digest()
).rstrip(b'=').decode()

print(f'{msg}.{sig}')
"
}

ANON_KEY=$(generate_key "anon")
SERVICE_ROLE_KEY=$(generate_key "service_role")

echo ""
echo "=== Add these to your .env file ==="
echo ""
echo "ANON_KEY=${ANON_KEY}"
echo "SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}"
echo ""
