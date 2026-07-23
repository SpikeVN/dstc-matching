import re

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from auth.config import SITE_URL
from auth.dependencies import get_current_user, get_current_user_id
from auth.jwt import verify_token
from auth import gotrue
from database import fetch_one, execute, generate_id, now

router = APIRouter(prefix="/auth")


class SignupRequest(BaseModel):
    email: str
    password: str
    username: str = ""


class LoginRequest(BaseModel):
    email_or_username: str
    password: str


class GoogleRequest(BaseModel):
    credential: str  # Google ID token from the frontend


class RefreshRequest(BaseModel):
    refresh_token: str


class VerifyRequest(BaseModel):
    type: str  # "signup", "recovery", "invite", "magiclink", "email_change"
    token: str
    email: str = ""


class UsernameRequest(BaseModel):
    username: str


@router.post("/signup")
async def signup(req: SignupRequest):
    """Create a new user via GoTrue, then create a row in public.users.
    The username is stored in public.users.username.
    """
    # GoTrue handles password hashing and user creation in auth.users
    result = await gotrue.signup(req.email, req.password, req.username)

    # GoTrue returns the user object with id, email, etc.
    gotrue_user = result.get("user") or result
    user_id = gotrue_user.get("id")
    if not user_id:
        raise HTTPException(
            status_code=500, detail="GoTrue signup did not return a user ID"
        )

    # Create the user in our public.users table
    now_ts = now()
    await execute(
        """INSERT INTO public.users (id, email, username, full_name, role, created_date, updated_date)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO NOTHING""",
        user_id,
        req.email,
        req.username,
        "",  # full_name is empty at signup; can be set later in profile
        "user",
        now_ts,
        now_ts,
    )

    user = await fetch_one("SELECT * FROM public.users WHERE id = $1", user_id)

    # Create a minimal contestant profile so Profile page pre-populates
    profile_id = generate_id()
    await execute(
        """INSERT INTO public.contestant_profiles (id, created_by, display_name, username)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (created_by) DO NOTHING""",
        profile_id,
        user_id,
        req.username,  # display_name defaults to the chosen username
        req.username,
    )

    # If GoTrue didn't return an access_token, email confirmation is required
    access_token = result.get("access_token")
    if not access_token:
        return {"requires_email_confirmation": True, "user": user}

    return {
        "access_token": access_token,
        "refresh_token": result.get("refresh_token"),
        "user": user,
    }


@router.post("/login")
async def login(req: LoginRequest):
    """Authenticate with email (or username) and password via GoTrue.

    Accepts either an email address or a username. If a username is provided,
    it looks up the corresponding email from public.users first.
    """
    email = req.email_or_username

    # If the input doesn't look like an email, treat it as a username
    if "@" not in email:
        user_row = await fetch_one(
            "SELECT email FROM public.users WHERE username = $1", email
        )
        if not user_row:
            raise HTTPException(status_code=401, detail="Invalid username or password")
        email = user_row["email"]

    result = await gotrue.login(email, req.password)

    gotrue_user = result.get("user") or result
    user_id = gotrue_user.get("id")
    if not user_id:
        raise HTTPException(
            status_code=500, detail="GoTrue login did not return a user ID"
        )

    # Ensure user exists in public.users (in case they were created via GoTrue directly)
    user = await fetch_one("SELECT * FROM public.users WHERE id = $1", user_id)
    if not user:
        now_ts = now()
        await execute(
            """INSERT INTO public.users (id, email, username, full_name, role, created_date, updated_date)
               VALUES ($1, $2, $3, $4, $5, $6, $7)""",
            user_id,
            gotrue_user.get("email", email),
            "",
            gotrue_user.get("user_metadata", {}).get("full_name", ""),
            "user",
            now_ts,
            now_ts,
        )
        user = await fetch_one("SELECT * FROM public.users WHERE id = $1", user_id)

    return {
        "access_token": result.get("access_token"),
        "refresh_token": result.get("refresh_token"),
        "user": user,
    }


@router.post("/google")
async def google_login(req: GoogleRequest):
    """Authenticate with a Google ID token via GoTrue."""
    result = await gotrue.google_login(req.credential)

    # Decode the access_token JWT to reliably get user_id (sub claim).
    # GoTrue's id_token response format varies by version, but the JWT is consistent.
    access_token = result.get("access_token")
    if not access_token:
        raise HTTPException(
            status_code=500, detail="GoTrue did not return an access token"
        )
    claims = verify_token(access_token)
    user_id = claims.get("sub")
    if not user_id:
        raise HTTPException(status_code=500, detail="Access token missing sub claim")

    # Extract email, name, and avatar from the GoTrue response (try multiple paths)
    gotrue_user = result.get("user") or result
    email = gotrue_user.get("email") or claims.get("email", "")
    user_metadata = gotrue_user.get("user_metadata", {})
    full_name = user_metadata.get("full_name") or user_metadata.get("name", "")
    picture = user_metadata.get("avatar_url") or user_metadata.get("picture") or claims.get("picture", "")

    # Derive username from email (e.g. "name" from "name@gmail.com")
    username = email.split("@")[0] if email else ""

    # Upsert user in public.users
    now_ts = now()
    await execute(
        """INSERT INTO public.users (id, email, username, full_name, role, created_date, updated_date)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO UPDATE SET
             email = EXCLUDED.email,
             username = EXCLUDED.username,
             full_name = EXCLUDED.full_name,
             updated_date = EXCLUDED.updated_date""",
        user_id,
        email,
        username,
        full_name,
        "user",
        now_ts,
        now_ts,
    )

    # Sync display_name and profile_image to contestant_profiles
    existing_profile = await fetch_one(
        "SELECT id, display_name, profile_image FROM public.contestant_profiles WHERE created_by = $1",
        user_id,
    )
    if existing_profile:
        # Update empty fields with Google data
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
        # Create a minimal profile with Google data
        profile_id = generate_id()
        await execute(
            """INSERT INTO public.contestant_profiles
               (id, created_by, display_name, username, profile_image)
               VALUES ($1, $2, $3, $4, $5)""",
            profile_id,
            user_id,
            full_name,
            username,
            picture,
        )

    user = await fetch_one("SELECT * FROM public.users WHERE id = $1", user_id)

    return {
        "access_token": access_token,
        "refresh_token": result.get("refresh_token"),
        "user": user,
    }


@router.get("/me")
async def get_me(request: Request, user: dict = Depends(get_current_user)):
    """Get the current authenticated user from the JWT token."""
    auth = request.headers.get("authorization", "")
    token_preview = auth[:30] + "..." if len(auth) > 30 else auth
    print(f"[auth/me] user={user.get('id','?')} token={token_preview}")
    return user


@router.post("/refresh")
async def refresh_tokens(req: RefreshRequest):
    """Refresh an expired access token using the refresh token."""
    token_preview = req.refresh_token[:20] + "..." if len(req.refresh_token) > 20 else req.refresh_token
    print(f"[auth/refresh] token={token_preview}")
    try:
        result = await gotrue.refresh(req.refresh_token)
        print(f"[auth/refresh] success, got access_token: {bool(result.get('access_token'))}, refresh_token: {bool(result.get('refresh_token'))}")
        return {
            "access_token": result.get("access_token"),
            "refresh_token": result.get("refresh_token"),
        }
    except Exception as e:
        print(f"[auth/refresh] FAILED: {e}")
        raise


@router.post("/verify")
async def verify_email(req: VerifyRequest):
    """Verify an email confirmation token from GoTrue."""
    result = await gotrue.verify(req.type, req.token, req.email)

    # Extract user info from the GoTrue response
    gotrue_user = result.get("user") or result
    user_id = gotrue_user.get("id")
    if not user_id:
        raise HTTPException(
            status_code=500, detail="GoTrue verify did not return a user ID"
        )

    access_token = result.get("access_token")
    if not access_token:
        raise HTTPException(
            status_code=500, detail="GoTrue verify did not return an access token"
        )

    # Upsert user in public.users (same pattern as Google login).
    # Preserve existing username — don't overwrite with empty string.
    email = gotrue_user.get("email", "")
    full_name = gotrue_user.get("user_metadata", {}).get("full_name", "")
    now_ts = now()
    await execute(
        """INSERT INTO public.users (id, email, username, full_name, role, created_date, updated_date)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO UPDATE SET
             email = EXCLUDED.email,
             full_name = EXCLUDED.full_name,
             updated_date = EXCLUDED.updated_date""",
        user_id,
        email,
        "",  # only used on INSERT; UPDATE clause preserves existing username
        full_name,
        "user",
        now_ts,
        now_ts,
    )

    user = await fetch_one("SELECT * FROM public.users WHERE id = $1", user_id)

    return {
        "access_token": access_token,
        "refresh_token": result.get("refresh_token"),
        "user": user,
    }


@router.patch("/username")
async def change_username(
    req: UsernameRequest, user: dict = Depends(get_current_user)
):
    """Change the current user's username.

    Validates: 3-20 chars, alphanumeric + underscore, unique in public.users.
    Also updates contestant_profiles.username for consistency.
    """
    username = req.username.strip()

    # Validate length
    if len(username) < 3 or len(username) > 20:
        raise HTTPException(
            status_code=400, detail="Tên đăng nhập phải từ 3 đến 20 ký tự"
        )

    # Validate characters: alphanumeric + underscore
    if not re.match(r"^[a-zA-Z0-9_]+$", username):
        raise HTTPException(
            status_code=400,
            detail="Tên đăng nhập chỉ được chứa chữ cái, số và dấu gạch dưới",
        )

    # Check uniqueness (exclude current user)
    existing = await fetch_one(
        "SELECT id FROM public.users WHERE username = $1 AND id != $2",
        username,
        user["id"],
    )
    if existing:
        raise HTTPException(
            status_code=409, detail="Tên đăng nhập đã được sử dụng"
        )

    # Update public.users
    await execute(
        "UPDATE public.users SET username = $1, updated_date = $2 WHERE id = $3",
        username,
        now(),
        user["id"],
    )

    # Also update contestant_profiles.username for consistency
    await execute(
        "UPDATE public.contestant_profiles SET username = $1 WHERE created_by = $2",
        username,
        user["id"],
    )

    updated_user = await fetch_one(
        "SELECT * FROM public.users WHERE id = $1", user["id"]
    )
    return updated_user


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    password: str


@router.post("/forgot-password")
async def forgot_password(req: ForgotPasswordRequest):
    """Send a password recovery email.

    Uses a custom scoped JWT (NOT GoTrue's built-in recovery flow) so
    the token grants zero API access — the backend exchanges it for a
    password update via GoTrue's admin API.
    """
    # Look up the user by email.  Return success regardless to prevent
    # email enumeration.
    user = await fetch_one("SELECT id FROM public.users WHERE email = $1", req.email)
    if user:
        from auth.recovery import generate_recovery_token
        from mailer import send_email, render_template

        token = generate_recovery_token(user["id"])
        reset_url = f"{SITE_URL}/reset-password?token={token}"
        html = render_template("recovery.html", reset_url=reset_url, email=req.email)
        await send_email(
            to=req.email,
            subject="🔐 Đặt lại mật khẩu — DSTC Matching",
            html=html,
        )
    return {"success": True}


@router.post("/reset-password")
async def reset_password(req: ResetPasswordRequest):
    """Reset a user's password using a scoped recovery token.

    The token is a short-lived JWT with `aud: "recovery"` — it carries
    zero API access.  The backend exchanges it for a password update
    via GoTrue's admin API (service role).
    """
    from auth.recovery import verify_recovery_token

    try:
        user_id = verify_recovery_token(req.token)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    await gotrue.admin_update_password(user_id, req.password)
    return {"success": True}


@router.post("/logout")
async def logout():
    """Logout is client-side (discard tokens). Server just confirms."""
    return {"success": True}
