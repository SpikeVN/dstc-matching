from fastapi import Request, HTTPException

from auth.jwt import verify_token


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
    """Get the current user from the JWT token.

    Decodes the JWT claims directly — no DB query needed.
    Returns a dict with id, email, username (from user_metadata), and role.
    Raises 401 if not authenticated.
    """
    user_id = await get_current_user_id(request)

    auth_header = request.headers.get("Authorization", "")
    token = auth_header[7:] if auth_header.startswith("Bearer ") else ""
    payload = verify_token(token) if token else {}

    user_metadata = payload.get("user_metadata", {})
    app_metadata = payload.get("app_metadata", {})

    return {
        "id": user_id,
        "email": payload.get("email", ""),
        "username": user_metadata.get("full_name") or user_metadata.get("name", ""),
        "role": app_metadata.get("role", "user"),
    }
