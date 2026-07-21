from fastapi import APIRouter, Depends
from pydantic import BaseModel

from auth.dependencies import get_current_user, get_current_user_id
from auth import gotrue
from database import fetch_one, execute, generate_id, now

router = APIRouter(prefix="/auth")


class SignupRequest(BaseModel):
    email: str
    password: str
    full_name: str = ""


class LoginRequest(BaseModel):
    email: str
    password: str


class GoogleRequest(BaseModel):
    credential: str  # Google ID token from the frontend


class RefreshRequest(BaseModel):
    refresh_token: str


@router.post("/signup")
async def signup(req: SignupRequest):
    """Create a new user via GoTrue, then create a row in public.users."""
    # GoTrue handles password hashing and user creation in auth.users
    result = await gotrue.signup(req.email, req.password, req.full_name)

    # GoTrue returns the user object with id, email, etc.
    gotrue_user = result.get("user", result)
    user_id = gotrue_user.get("id")

    # Create the user in our public.users table
    now_ts = now()
    await execute(
        """INSERT INTO public.users (id, email, full_name, role, created_date, updated_date)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (id) DO NOTHING""",
        user_id,
        req.email,
        req.full_name,
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


@router.post("/login")
async def login(req: LoginRequest):
    """Authenticate with email/password via GoTrue."""
    result = await gotrue.login(req.email, req.password)

    gotrue_user = result.get("user", result)
    user_id = gotrue_user.get("id")

    # Ensure user exists in public.users (in case they were created via GoTrue directly)
    user = await fetch_one("SELECT * FROM public.users WHERE id = $1", user_id)
    if not user:
        now_ts = now()
        await execute(
            """INSERT INTO public.users (id, email, full_name, role, created_date, updated_date)
               VALUES ($1, $2, $3, $4, $5, $6)""",
            user_id,
            gotrue_user.get("email", req.email),
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

    gotrue_user = result.get("user", result)
    user_id = gotrue_user.get("id")
    email = gotrue_user.get("email", "")
    full_name = gotrue_user.get("user_metadata", {}).get("full_name", "")

    # Upsert user in public.users
    now_ts = now()
    await execute(
        """INSERT INTO public.users (id, email, full_name, role, created_date, updated_date)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (id) DO UPDATE SET
             email = EXCLUDED.email,
             full_name = EXCLUDED.full_name,
             updated_date = EXCLUDED.updated_date""",
        user_id,
        email,
        full_name,
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


@router.get("/me")
async def get_me(user: dict = Depends(get_current_user)):
    """Get the current authenticated user from the JWT token."""
    return user


@router.post("/refresh")
async def refresh_tokens(req: RefreshRequest):
    """Refresh an expired access token using the refresh token."""
    result = await gotrue.refresh(req.refresh_token)
    return {
        "access_token": result.get("access_token"),
        "refresh_token": result.get("refresh_token"),
    }


@router.post("/logout")
async def logout():
    """Logout is client-side (discard tokens). Server just confirms."""
    return {"success": True}
