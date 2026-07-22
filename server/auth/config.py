import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@127.0.0.1:5432/postgres")
GOTRUE_URL = os.getenv("GOTRUE_URL", "http://127.0.0.1:9999")
GOTRUE_SERVICE_KEY = os.getenv("GOTRUE_SERVICE_KEY", "")
JWT_SECRET = os.getenv("JWT_SECRET", "super-secret-jwt-token-with-at-least-32-characters")
CORS_ORIGINS = os.getenv(
    "CORS_ORIGINS",
    "https://matching.cteftu.id.vn,http://localhost:4236",
).split(",")

# Email (Resend)
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
EMAIL_FROM = os.getenv("EMAIL_FROM", "DSTC Matching <noreply@cteftu.id.vn>")
SITE_URL = os.getenv("SITE_URL", "http://localhost:4236")
