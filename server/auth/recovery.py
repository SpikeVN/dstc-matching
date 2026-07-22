"""Password recovery token helpers.

Generates and verifies short-lived, scoped JWTs used exclusively for
password resets.  These tokens carry `aud: "recovery"` so they cannot
be confused with regular access tokens, and they grant zero API access
on their own — the backend exchanges them for a password update via
GoTrue's admin API.
"""

from datetime import datetime, timedelta, timezone

from jose import jwt, JWTError

from auth.config import JWT_SECRET

_ALGORITHM = "HS256"
_EXPIRY = timedelta(hours=1)
_AUDIENCE = "recovery"


def generate_recovery_token(user_id: str) -> str:
    """Create a 1-hour JWT scoped to password recovery."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "aud": _AUDIENCE,
        "iat": now,
        "exp": now + _EXPIRY,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=_ALGORITHM)


def verify_recovery_token(token: str) -> str:
    """Verify a recovery JWT and return the user_id (sub claim).

    Raises ValueError with a human-readable message on failure.
    """
    try:
        payload = jwt.decode(
            token,
            JWT_SECRET,
            algorithms=[_ALGORITHM],
            audience=_AUDIENCE,
        )
    except JWTError as exc:
        raise ValueError(f"Invalid or expired recovery token: {exc}") from exc

    user_id: str | None = payload.get("sub")
    if not user_id:
        raise ValueError("Recovery token missing sub claim")
    return user_id
