from fastapi import Request, HTTPException

from auth.jwt import verify_token
from database import fetch_one


async def get_current_user_id(request: Request) -> str:
    """Extract the authenticated user ID from the Authorization header.

    Returns the Supabase user UUID (the 'sub' claim).
    Raises 401 if the token is missing or invalid.
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = auth_header[7:]
    payload = verify_token(token)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token: no sub claim")

    return user_id


async def get_current_user(request: Request) -> dict:
    """Get the full user dict from the database based on the JWT.

    Returns the user row from public.users.
    Raises 401 if not authenticated or user not found.
    """
    user_id = await get_current_user_id(request)
    user = await fetch_one("SELECT * FROM public.users WHERE id = $1", user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found in database")
    return user
