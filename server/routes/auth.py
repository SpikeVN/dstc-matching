import json
import re

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from auth.config import SITE_URL
from auth.dependencies import get_current_user
from auth.jwt import verify_token
from auth import gotrue
from database import fetch_one, execute, generate_id, now

# Default privacy settings: all fields visible
DEFAULT_INFO_SHOWN = json.dumps({
    "show_age": True,
    "show_gender": True,
    "show_location": True,
    "show_school": True,
    "show_major": True,
    "show_achievements": True,
})

router = APIRouter(prefix="/auth")


# ── Helpers ────────────────────────────────────────────────────────────────


def _user_from_gotrue(result: dict) -> dict:
    """Build a user dict from a GoTrue SDK response."""
    gotrue_user = result.get("user") or {}
    user_metadata = gotrue_user.get("user_metadata", {})
    app_metadata = gotrue_user.get("app_metadata", {})
    return {
        "id": gotrue_user.get("id", ""),
        "email": gotrue_user.get("email", ""),
        "username": user_metadata.get("full_name") or user_metadata.get("name", ""),
        "role": app_metadata.get("role", "user"),
    }


# ── Request models ────────────────────────────────────────────────────────


class SignupRequest(BaseModel):
    email: str
    password: str
    username: str = ""


class LoginRequest(BaseModel):
    email: str
    password: str


class GitHubCallbackRequest(BaseModel):
    code: str
    state: str = ""


class RefreshRequest(BaseModel):
    refresh_token: str


class VerifyRequest(BaseModel):
    type: str
    token: str
    email: str = ""


class UsernameRequest(BaseModel):
    username: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    password: str


# ── Auth endpoints ────────────────────────────────────────────────────────


@router.post("/signup")
async def signup(req: SignupRequest):
    """Create a new user via GoTrue, then create a contestant profile."""
    result = await gotrue.signup(req.email, req.password, req.username)

    user_id = (result.get("user") or {}).get("id")
    if not user_id:
        raise HTTPException(status_code=500, detail="GoTrue signup did not return a user ID")

    # Create a minimal contestant profile
    profile_id = generate_id()
    default_avatar = f"https://api.dicebear.com/9.x/identicon/svg?seed={req.username}&scale=80"
    await execute(
        """INSERT INTO public.contestant_profiles
           (id, created_by, display_name, username, profile_image, email)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (created_by) DO NOTHING""",
        profile_id,
        user_id,
        req.username,
        req.username,
        default_avatar,
        req.email,
    )

    # Create default user_preferences with all privacy fields enabled
    await execute(
        """INSERT INTO public.user_preferences (id, user_id, info_shown)
           VALUES ($1, $2, $3::jsonb)
           ON CONFLICT (user_id) DO NOTHING""",
        generate_id(), user_id, DEFAULT_INFO_SHOWN,
    )

    access_token = result.get("access_token")
    if not access_token:
        return {"requires_email_confirmation": True, "user": _user_from_gotrue(result)}

    return {
        "access_token": access_token,
        "refresh_token": result.get("refresh_token"),
        "user": _user_from_gotrue(result),
    }


@router.post("/login")
async def login(req: LoginRequest):
    """Authenticate with email and password via GoTrue."""
    result = await gotrue.login(req.email, req.password)
    return {
        "access_token": result.get("access_token"),
        "refresh_token": result.get("refresh_token"),
        "user": _user_from_gotrue(result),
    }


# ── Google OAuth ───────────────────────────────────────────────────────────


@router.post("/google")
async def google_login(request: Request):
    """Authenticate with a Google ID token via GoTrue (legacy endpoint)."""
    body = await request.json()
    credential = body.get("credential", "")
    result = await gotrue.google_login(credential)

    access_token = result.get("access_token")
    if not access_token:
        raise HTTPException(status_code=500, detail="GoTrue did not return an access token")

    user = _user_from_gotrue(result)
    user_id = user["id"]

    # Sync profile with Google data
    gotrue_user = result.get("user") or {}
    user_metadata = gotrue_user.get("user_metadata", {})
    full_name = user_metadata.get("full_name") or user_metadata.get("name", "")
    picture = user_metadata.get("avatar_url") or user_metadata.get("picture", "")

    existing_profile = await fetch_one(
        "SELECT id, display_name, profile_image FROM public.contestant_profiles WHERE created_by = $1",
        user_id,
    )
    if existing_profile:
        updates = []
        params = []
        idx = 1
        if not existing_profile.get("display_name") and full_name:
            updates.append(f"display_name = ${idx}")
            params.append(full_name)
            idx += 1
        if not existing_profile.get("profile_image") and picture:
            updates.append(f"profile_image = ${idx}")
            params.append(picture)
            idx += 1
        if updates:
            params.append(existing_profile["id"])
            await execute(
                f"UPDATE public.contestant_profiles SET {', '.join(updates)} WHERE id = ${idx}",
                *params,
            )
    else:
        profile_id = generate_id()
        await execute(
            """INSERT INTO public.contestant_profiles
               (id, created_by, display_name, username, profile_image, email)
               VALUES ($1, $2, $3, $4, $5, $6)""",
            profile_id, user_id, full_name, user["email"].split("@")[0] if user["email"] else "",
            picture, user["email"],
        )

    # Create default user_preferences with all privacy fields enabled
    await execute(
        """INSERT INTO public.user_preferences (id, user_id, info_shown)
           VALUES ($1, $2, $3::jsonb)
           ON CONFLICT (user_id) DO NOTHING""",
        generate_id(), user_id, DEFAULT_INFO_SHOWN,
    )

    return {
        "access_token": access_token,
        "refresh_token": result.get("refresh_token"),
        "user": user,
    }


@router.get("/google/authorize")
async def google_authorize():
    """Return the Google OAuth authorize URL."""
    url = await gotrue.google_authorize(redirect_to=SITE_URL)
    return {"url": url}


# ── GitHub OAuth ───────────────────────────────────────────────────────────


@router.get("/github/authorize")
async def github_authorize():
    """Return the GitHub OAuth authorize URL."""
    url = await gotrue.github_authorize(redirect_to=SITE_URL)
    return {"url": url}


@router.post("/github/callback")
async def github_callback(req: GitHubCallbackRequest):
    """Exchange GitHub authorization code for a session."""
    result = await gotrue.github_callback(req.code, redirect_to=SITE_URL)

    access_token = result.get("access_token")
    if not access_token:
        raise HTTPException(status_code=500, detail="GoTrue did not return an access token")

    user = _user_from_gotrue(result)
    user_id = user["id"]

    # Sync profile with GitHub data
    gotrue_user = result.get("user") or {}
    user_metadata = gotrue_user.get("user_metadata", {})
    full_name = user_metadata.get("full_name") or user_metadata.get("name", "")
    avatar_url = user_metadata.get("avatar_url") or user_metadata.get("picture", "")

    existing_profile = await fetch_one(
        "SELECT id, display_name, profile_image FROM public.contestant_profiles WHERE created_by = $1",
        user_id,
    )
    if existing_profile:
        updates = []
        params = []
        idx = 1
        if not existing_profile.get("display_name") and full_name:
            updates.append(f"display_name = ${idx}")
            params.append(full_name)
            idx += 1
        if not existing_profile.get("profile_image") and avatar_url:
            updates.append(f"profile_image = ${idx}")
            params.append(avatar_url)
            idx += 1
        if updates:
            params.append(existing_profile["id"])
            await execute(
                f"UPDATE public.contestant_profiles SET {', '.join(updates)} WHERE id = ${idx}",
                *params,
            )
    else:
        profile_id = generate_id()
        username = user_metadata.get("user_name") or (user["email"].split("@")[0] if user["email"] else "")
        await execute(
            """INSERT INTO public.contestant_profiles
               (id, created_by, display_name, username, profile_image, email)
               VALUES ($1, $2, $3, $4, $5, $6)""",
            profile_id, user_id, full_name, username, avatar_url, user["email"],
        )

    # Create default user_preferences with all privacy fields enabled
    await execute(
        """INSERT INTO public.user_preferences (id, user_id, info_shown)
           VALUES ($1, $2, $3::jsonb)
           ON CONFLICT (user_id) DO NOTHING""",
        generate_id(), user_id, DEFAULT_INFO_SHOWN,
    )

    return {
        "access_token": access_token,
        "refresh_token": result.get("refresh_token"),
        "user": user,
    }


# ── Email verification ────────────────────────────────────────────────────


@router.post("/verify")
async def verify_email(req: VerifyRequest):
    """Verify an email confirmation token from GoTrue."""
    result = await gotrue.verify(req.type, req.token, req.email)

    access_token = result.get("access_token")
    if not access_token:
        raise HTTPException(status_code=500, detail="GoTrue verify did not return an access token")

    return {
        "access_token": access_token,
        "refresh_token": result.get("refresh_token"),
        "user": _user_from_gotrue(result),
    }


# ── Current user ──────────────────────────────────────────────────────────


@router.get("/me")
async def get_me(request: Request, user: dict = Depends(get_current_user)):
    """Get the current authenticated user from the JWT token."""
    return user


# ── Token refresh ─────────────────────────────────────────────────────────


@router.post("/refresh")
async def refresh_tokens(req: RefreshRequest):
    """Refresh an expired access token using the refresh token."""
    result = await gotrue.refresh(req.refresh_token)
    return {
        "access_token": result.get("access_token"),
        "refresh_token": result.get("refresh_token"),
    }


# ── Username ──────────────────────────────────────────────────────────────


@router.patch("/username")
async def change_username(
    req: UsernameRequest, user: dict = Depends(get_current_user)
):
    """Change the current user's username on contestant_profiles."""
    username = req.username.strip()

    if len(username) < 3 or len(username) > 20:
        raise HTTPException(status_code=400, detail="Tên đăng nhập phải từ 3 đến 20 ký tự")

    if not re.match(r"^[a-zA-Z0-9_]+$", username):
        raise HTTPException(
            status_code=400,
            detail="Tên đăng nhập chỉ được chứa chữ cái, số và dấu gạch dưới",
        )

    # Check uniqueness in contestant_profiles
    existing = await fetch_one(
        "SELECT id FROM public.contestant_profiles WHERE username = $1 AND created_by != $2",
        username,
        user["id"],
    )
    if existing:
        raise HTTPException(status_code=409, detail="Tên đăng nhập đã được sử dụng")

    # Update contestant_profiles.username
    await execute(
        "UPDATE public.contestant_profiles SET username = $1, updated_date = $2 WHERE created_by = $3",
        username,
        now(),
        user["id"],
    )

    return {
        "id": user["id"],
        "email": user["email"],
        "username": username,
        "role": user["role"],
    }


# ── Password recovery ─────────────────────────────────────────────────────


@router.post("/forgot-password")
async def forgot_password(req: ForgotPasswordRequest):
    """Send a password recovery email via a custom scoped JWT."""
    # Look up user by email in contestant_profiles
    profile = await fetch_one(
        "SELECT created_by FROM public.contestant_profiles WHERE email = $1", req.email
    )
    if profile:
        from auth.recovery import generate_recovery_token
        from mailer import send_email, render_template

        token = generate_recovery_token(profile["created_by"])
        reset_url = f"{SITE_URL}/reset-password?token={token}"
        html = render_template("recovery.html", reset_url=reset_url, email=req.email)
        await send_email(
            to=req.email,
            subject="🔐 Đặt lại mật khẩu — DSTC Matching",
            html=html,
        )
    # Always return success to prevent email enumeration
    return {"success": True}


@router.post("/reset-password")
async def reset_password(req: ResetPasswordRequest):
    """Reset a user's password using a scoped recovery token."""
    from auth.recovery import verify_recovery_token

    try:
        user_id = verify_recovery_token(req.token)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    await gotrue.admin_update_password(user_id, req.password)
    return {"success": True}


# ── Logout ────────────────────────────────────────────────────────────────


@router.post("/logout")
async def logout():
    """Logout is client-side (discard tokens). Server just confirms."""
    return {"success": True}
