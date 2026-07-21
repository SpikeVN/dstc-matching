from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from auth.dependencies import get_current_user, get_current_user_id
from auth.jwt import verify_token
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
    gotrue_user = result.get("user") or result
    user_id = gotrue_user.get("id")
    if not user_id:
        raise HTTPException(status_code=500, detail="GoTrue signup did not return a user ID")

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

    gotrue_user = result.get("user") or result
    user_id = gotrue_user.get("id")
    if not user_id:
        raise HTTPException(status_code=500, detail="GoTrue login did not return a user ID")

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

    # Decode the access_token JWT to reliably get user_id (sub claim).
    # GoTrue's id_token response format varies by version, but the JWT is consistent.
    access_token = result.get("access_token")
    if not access_token:
        raise HTTPException(status_code=500, detail="GoTrue did not return an access token")
    claims = verify_token(access_token)
    user_id = claims.get("sub")
    if not user_id:
        raise HTTPException(status_code=500, detail="Access token missing sub claim")

    # Extract email and name from the GoTrue response (try multiple paths)
    gotrue_user = result.get("user") or result
    email = gotrue_user.get("email") or claims.get("email", "")
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
        "access_token": access_token,
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
