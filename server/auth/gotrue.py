"""GoTrue auth client — backed by the Supabase Python async SDK.

All auth operations (signup, login, refresh, Google, verify, admin
password update) go through the SDK.  The module exposes thin async
functions whose return shapes match the rest of the codebase.
"""

from fastapi import HTTPException

from auth.config import SUPABASE_PUBLIC_URL, SUPABASE_URL
from auth.supabase_client import get_supabase


# ── Auth operations ─────────────────────────────────────────────────────────


async def signup(email: str, password: str, username: str = "") -> dict:
    """Create a new user. Returns {access_token, refresh_token, user} or {user}."""
    sb = get_supabase()
    try:
        resp = await sb.auth.sign_up({
            "email": email,
            "password": password,
            "options": {"data": {"full_name": username}},
        })
    except Exception as exc:
        _raise_auth_error(exc)

    session = resp.session
    user = resp.user
    if user is None:
        raise HTTPException(status_code=400, detail="Signup failed")

    if session is None:
        # Email confirmation required — no tokens yet
        return {"user": _user_to_dict(user)}

    return {
        "access_token": session.access_token,
        "refresh_token": session.refresh_token,
        "user": _user_to_dict(user),
    }


async def login(email: str, password: str) -> dict:
    """Authenticate with email/password."""
    sb = get_supabase()
    try:
        resp = await sb.auth.sign_in_with_password({
            "email": email,
            "password": password,
        })
    except Exception as exc:
        _raise_auth_error(exc)

    session = resp.session
    if session is None:
        raise HTTPException(status_code=401, detail="Login failed — no session returned")

    return {
        "access_token": session.access_token,
        "refresh_token": session.refresh_token,
        "user": _user_to_dict(resp.user),
    }


async def refresh(refresh_token: str) -> dict:
    """Refresh an expired access token."""
    sb = get_supabase()
    preview = refresh_token[:20] + "..." if len(refresh_token) > 20 else refresh_token
    print(f"[gotrue.refresh] refreshing rt={preview}")
    try:
        resp = await sb.auth.refresh_session(refresh_token)
    except Exception as exc:
        print(f"[gotrue.refresh] FAILED: {exc}")
        _raise_auth_error(exc)

    session = resp.session
    if session is None:
        print("[gotrue.refresh] FAILED: no session in response")
        raise HTTPException(status_code=401, detail="Token refresh failed")

    print("[gotrue.refresh] SUCCESS")
    return {
        "access_token": session.access_token,
        "refresh_token": session.refresh_token,
    }


async def get_user(access_token: str) -> dict:
    """Get the current user using their access token."""
    sb = get_supabase()
    try:
        resp = await sb.auth.get_user(access_token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user = resp.user if resp else None
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return _user_to_dict(user)


async def google_login(id_token: str) -> dict:
    """Authenticate with a Google ID token."""
    sb = get_supabase()
    try:
        resp = await sb.auth.sign_in_with_id_token({
            "provider": "google",
            "token": id_token,
        })
    except Exception as exc:
        _raise_auth_error(exc)

    session = resp.session
    if session is None:
        raise HTTPException(status_code=401, detail="Google login failed — no session")

    return {
        "access_token": session.access_token,
        "refresh_token": session.refresh_token,
        "user": _user_to_dict(resp.user),
    }


async def _oauth_authorize(provider: str, redirect_to: str) -> str:
    """Return the OAuth authorize URL for any provider via GoTrue."""
    sb = get_supabase()
    try:
        resp = await sb.auth.sign_in_with_oauth({
            "provider": provider,
            "options": {"redirect_to": redirect_to},
        })
    except Exception as exc:
        _raise_auth_error(exc)

    # resp.url is the provider authorization URL — it may point to the
    # internal gateway (e.g. http://supabase-kong:8000) which the browser
    # cannot reach. Rewrite to the public-facing Supabase URL.
    url = getattr(resp, "url", None)
    if not url:
        # Fallback: the SDK may return it as a dict
        url = resp.get("url") if isinstance(resp, dict) else None
    if not url:
        raise HTTPException(status_code=500, detail=f"Could not generate {provider} OAuth URL")
    if SUPABASE_URL != SUPABASE_PUBLIC_URL:
        url = url.replace(SUPABASE_URL, SUPABASE_PUBLIC_URL, 1)
    return url


async def google_authorize(redirect_to: str) -> str:
    """Return the Google OAuth authorize URL via GoTrue."""
    return await _oauth_authorize("google", redirect_to)


async def github_authorize(redirect_to: str) -> str:
    """Return the GitHub OAuth authorize URL via GoTrue."""
    return await _oauth_authorize("github", redirect_to)


async def github_callback(code: str, redirect_to: str) -> dict:
    """Exchange a GitHub authorization code for a session via GoTrue."""
    sb = get_supabase()
    try:
        resp = await sb.auth.exchange_code_for_session({
            "auth_code": code,
            "redirect_to": redirect_to,
        })
    except Exception as exc:
        _raise_auth_error(exc)

    session = resp.session
    if session is None:
        raise HTTPException(status_code=401, detail="GitHub login failed — no session")

    return {
        "access_token": session.access_token,
        "refresh_token": session.refresh_token,
        "user": _user_to_dict(resp.user),
    }


async def verify(type: str, token: str, email: str = "") -> dict:
    """Verify an email confirmation / recovery token via OTP."""
    sb = get_supabase()
    params = {"type": type, "token": token}
    if email:
        params["email"] = email
    try:
        resp = await sb.auth.verify_otp(params)
    except Exception as exc:
        _raise_auth_error(exc)

    session = resp.session
    if session is None:
        raise HTTPException(status_code=400, detail="Verification failed — no session")

    return {
        "access_token": session.access_token,
        "refresh_token": session.refresh_token,
        "user": _user_to_dict(resp.user),
    }


async def admin_update_password(user_id: str, new_password: str) -> dict:
    """Update a user's password via the admin API (service role)."""
    sb = get_supabase()
    try:
        resp = await sb.auth.admin.update_user_by_id(
            user_id, {"password": new_password}
        )
    except Exception as exc:
        _raise_auth_error(exc)
    return _user_to_dict(resp.user) if resp.user else {}


async def admin_delete_user(user_id: str) -> None:
    """Delete a user from auth.users via the admin API (service role)."""
    sb = get_supabase()
    try:
        await sb.auth.admin.delete_user(user_id)
    except Exception as exc:
        msg = str(exc)
        print(f"[gotrue.admin_delete_user] FAILED user={user_id}: {msg}")
        _raise_auth_error(exc)


# ── Helpers ─────────────────────────────────────────────────────────────────


def _user_to_dict(user) -> dict:
    """Normalise a Supabase Auth User object into a plain dict."""
    if user is None:
        return {}
    return {
        "id": str(user.id),
        "email": user.email or "",
        "user_metadata": user.user_metadata or {},
        "app_metadata": user.app_metadata or {},
        "created_at": str(user.created_at) if user.created_at else "",
    }


def _raise_auth_error(exc: Exception):
    """Convert a Supabase SDK exception into an HTTPException."""
    msg = str(exc)
    status = 400
    low = msg.lower()
    if "401" in msg or "invalid" in low or "credentials" in low:
        status = 401
    elif "404" in msg or "not found" in low:
        status = 404
    elif "422" in msg:
        status = 422
    elif "409" in msg or "already" in low:
        status = 409
    raise HTTPException(status_code=status, detail=msg)
