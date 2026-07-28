import time

import httpx
from jose import JWTError, jwt
from fastapi import HTTPException

from auth.config import JWT_SECRET, GOTRUE_URL

# Cache the JWKS public keys fetched from GoTrue's .well-known endpoint.
# GoTrue rotates keys rarely; re-fetching on every request is wasteful.
_jwks_cache: tuple[dict, float] | None = None
JWKS_TTL = 3600  # 1 hour


def _get_jwks() -> dict:
    """Fetch and cache the JWKS from GoTrue's well-known endpoint."""
    global _jwks_cache
    now = time.time()
    if _jwks_cache is not None and (now - _jwks_cache[1]) < JWKS_TTL:
        return _jwks_cache[0]

    jwks_url = f"{GOTRUE_URL}/.well-known/jwks.json"
    try:
        resp = httpx.get(jwks_url, timeout=5.0)
        resp.raise_for_status()
        _jwks_cache = (resp.json(), now)
    except Exception:
        _jwks_cache = ({"keys": []}, now)
    return _jwks_cache[0]


def verify_token(token: str) -> dict:
    """Verify a Supabase/GoTrue JWT and return the payload.

    Supports both ES256 (current default) and HS256 (legacy).
    The algorithm is auto-detected from the token header.

    GoTrue JWTs have:
      - aud: "authenticated"
      - sub: user UUID
      - email: user email
      - role: "authenticated"
      - exp: expiry timestamp

    Audience verification is skipped (verify_aud=False) because GoTrue
    instances may set aud to different values depending on configuration.
    As a compensating control, the token MUST contain an 'email' claim —
    this prevents recovery tokens (which only carry sub/aud/iat/exp) from
    being used as access tokens.
    """
    try:
        header = jwt.get_unverified_header(token)
        alg = header.get("alg", "HS256")

        if alg == "ES256":
            jwks = _get_jwks()
            # python-jose accepts a JWKS dict directly — it picks the
            # matching key by the token's `kid` header automatically.
            payload = jwt.decode(
                token,
                jwks,
                algorithms=["ES256"],
                options={"verify_aud": False},
            )
        else:
            # Fallback: HS256 with shared secret (legacy tokens issued before
            # the GoTrue ES256 migration).
            payload = jwt.decode(
                token,
                JWT_SECRET,
                algorithms=["HS256"],
                options={"verify_aud": False},
            )

        # Reject tokens that lack the email claim (e.g. recovery tokens).
        # GoTrue access tokens always include email; recovery tokens do not.
        if not payload.get("email"):
            raise HTTPException(status_code=401, detail="Invalid token: missing email claim")

        return payload
    except HTTPException:
        raise
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")
