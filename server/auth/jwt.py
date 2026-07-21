from jose import JWTError, jwt
from fastapi import HTTPException

from auth.config import JWT_SECRET

ALGORITHM = "HS256"


def verify_token(token: str) -> dict:
    """Verify a Supabase/GoTrue JWT and return the payload.

    GoTrue JWTs have:
      - aud: "authenticated"
      - sub: user UUID
      - email: user email
      - role: "authenticated"
      - exp: expiry timestamp
    """
    try:
        payload = jwt.decode(
            token,
            JWT_SECRET,
            algorithms=[ALGORITHM],
            options={"verify_aud": False},  # GoTrue may or may not set aud
        )
        return payload
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")
