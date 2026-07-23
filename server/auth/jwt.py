import httpx
from jose import JWTError, jwt
from fastapi import HTTPException

from auth.config import JWT_SECRET, GOTRUE_URL

# Cache the JWKS public keys fetched from GoTrue's .well-known endpoint.
# GoTrue rotates keys rarely; re-fetching on every request is wasteful.
_jwks_cache: dict | None = None


def _get_jwks() -> dict:
    """Fetch and cache the JWKS from GoTrue's well-known endpoint."""
    global _jwks_cache
    if _jwks_cache is not None:
        return _jwks_cache

    jwks_url = f"{GOTRUE_URL}/.well-known/jwks.json"
    try:
        resp = httpx.get(jwks_url, timeout=5.0)
        resp.raise_for_status()
        _jwks_cache = resp.json()
    except Exception:
        _jwks_cache = {"keys": []}
    return _jwks_cache


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
    """
    try:
        header = jwt.get_unverified_header(token)
        alg = header.get("alg", "HS256")

        if alg == "ES256":
            jwks = _get_jwks()
            # python-jose accepts a JWKS dict directly — it picks the
            # matching key by the token's `kid` header automatically.
            return jwt.decode(
                token,
                jwks,
                algorithms=["ES256"],
                options={"verify_aud": False},
            )

        # Fallback: HS256 with shared secret (legacy tokens issued before
        # the GoTrue ES256 migration).
        return jwt.decode(
            token,
            JWT_SECRET,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
    except HTTPException:
        raise
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")
