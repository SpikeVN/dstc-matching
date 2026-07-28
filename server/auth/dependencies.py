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
    """Get the current user from the JWT token.

    Decodes JWT claims and queries user_preferences for admin role info.
    Returns a dict with id, email, username, role, admin_role, admin_visible.
    Raises 401 if not authenticated or if the user no longer exists (deleted).
    """
    user_id = await get_current_user_id(request)

    auth_header = request.headers.get("Authorization", "")
    token = auth_header[7:] if auth_header.startswith("Bearer ") else ""
    payload = verify_token(token) if token else {}

    user_metadata = payload.get("user_metadata", {})

    # Verify user still exists in the application database.  When an admin
    # deletes a user the GoTrue auth record is removed and tables cascade,
    # but the JWT the user already holds remains valid until expiry.  Without
    # this check the deleted user can still hit authenticated endpoints and
    # see a broken UI because their contestant_profiles row is gone.
    alive = await fetch_one(
        "SELECT 1 FROM public.contestant_profiles WHERE created_by = $1",
        user_id,
    )
    if not alive:
        raise HTTPException(status_code=401, detail="User no longer exists")

    # Query profile_image from contestant_profiles
    profile_row = await fetch_one(
        "SELECT profile_image FROM public.contestant_profiles WHERE created_by = $1",
        user_id,
    )

    # Query user_preferences for admin role, visibility, info_shown, and terms_accepted
    prefs = await fetch_one(
        "SELECT admin_role, admin_visible, info_shown, terms_accepted FROM public.user_preferences WHERE user_id = $1",
        user_id,
    )

    # Default info_shown settings
    DEFAULT_INFO_SHOWN = {
        "show_age": True,
        "show_gender": True,
        "show_location": True,
        "show_school": True,
        "show_major": True,
        "show_achievements": True,
    }

    info_shown = prefs["info_shown"] if prefs and prefs.get("info_shown") else {}
    # Merge with defaults so missing keys default to visible
    merged_info_shown = {**DEFAULT_INFO_SHOWN, **info_shown}

    return {
        "id": user_id,
        "email": payload.get("email", ""),
        "username": user_metadata.get("full_name") or user_metadata.get("name", ""),
        "profile_image": profile_row["profile_image"] if profile_row else "",
        "role": "admin" if prefs and prefs["admin_role"] != "user" else "user",
        "admin_role": prefs["admin_role"] if prefs else "user",
        "admin_visible": prefs["admin_visible"] if prefs else True,
        "info_shown": merged_info_shown,
        "terms_accepted": prefs["terms_accepted"] if prefs else False,
    }
