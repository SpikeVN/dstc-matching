import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL environment variable is required")

GOTRUE_URL = os.getenv("GOTRUE_URL", "http://127.0.0.1:54321/auth/v1")
GOTRUE_SERVICE_KEY = os.getenv("GOTRUE_SERVICE_KEY", "")
JWT_SECRET = os.getenv("JWT_SECRET")
if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET environment variable is required")
CORS_ORIGINS = os.getenv(
    "CORS_ORIGINS",
    "https://matching.cteftu.id.vn,http://localhost:4236",
).split(",")

# Supabase (Storage + Auth SDK)
# Default: derive from GOTRUE_URL by stripping the /auth/v1 suffix
_SUPABASE_URL_DEFAULT = GOTRUE_URL.rsplit("/auth/v1", 1)[0] if "/auth/v1" in GOTRUE_URL else GOTRUE_URL
SUPABASE_URL = os.getenv("SUPABASE_URL", _SUPABASE_URL_DEFAULT)
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", GOTRUE_SERVICE_KEY)

# Public-facing Supabase URL — used for storage URLs served to the browser.
# In Docker, SUPABASE_URL is the internal gateway (http://supabase-kong:8000)
# but users need the public origin (https://supabase.cteftu.id.vn).
SUPABASE_PUBLIC_URL = os.getenv("SUPABASE_PUBLIC_URL", SUPABASE_URL)

# Version / commit info
GIT_SHA = os.getenv("GIT_SHA", "dev")

# Frontend URL for OAuth redirects
SITE_URL = os.getenv("SITE_URL", "http://localhost:4236")

# Email (Resend)
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
EMAIL_FROM = os.getenv("EMAIL_FROM", "DSTC Matching <noreply@cteftu.id.vn>")
