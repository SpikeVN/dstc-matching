"""GoTrue REST API client.

Calls the self-hosted GoTrue (supabase-auth) service for user management.
All calls go to GOTRUE_URL (default http://127.0.0.1:9999).
"""

import httpx
from fastapi import HTTPException

from auth.config import GOTRUE_URL, GOTRUE_SERVICE_KEY

# GoTrue sends confirmation/recovery emails synchronously during signup/verify,
# which can take ~10s over SMTP. httpx's default 5s read timeout is too short,
# so bump it for all GoTrue calls.
GOTRUE_TIMEOUT = httpx.Timeout(30.0, connect=10.0)


def _auth_headers() -> dict:
    """Return headers needed to call GoTrue (apikey header when going through Kong)."""
    headers = {}
    if GOTRUE_SERVICE_KEY:
        headers["apikey"] = GOTRUE_SERVICE_KEY
    return headers


async def signup(email: str, password: str, username: str = "") -> dict:
    """Create a new user via GoTrue.

    Returns GoTrue's response with access_token, refresh_token, user.
    """
    async with httpx.AsyncClient(timeout=GOTRUE_TIMEOUT) as client:
        resp = await client.post(
            f"{GOTRUE_URL}/signup",
            json={
                "email": email,
                "password": password,
                "data": {"full_name": username},
            },
            headers=_auth_headers(),
        )
        if resp.status_code != 200:
            try:
                body = resp.json()
                detail = body.get("msg") or body.get("error_description") or resp.text
            except Exception:
                detail = resp.text
            raise HTTPException(status_code=resp.status_code, detail=detail)
        return resp.json()


async def login(email: str, password: str) -> dict:
    """Authenticate a user with email/password via GoTrue.

    Returns {access_token, refresh_token, token_type, expires_in, user}.
    """
    async with httpx.AsyncClient(timeout=GOTRUE_TIMEOUT) as client:
        resp = await client.post(
            f"{GOTRUE_URL}/token",
            params={"grant_type": "password"},
            json={"email": email, "password": password},
            headers=_auth_headers(),
        )
        if resp.status_code != 200:
            try:
                body = resp.json()
                detail = body.get("error_description") or body.get("msg") or resp.text
            except Exception:
                detail = resp.text
            raise HTTPException(status_code=401, detail=detail)
        return resp.json()


async def refresh(refresh_token: str) -> dict:
    """Refresh an expired access token via GoTrue.

    Returns {access_token, refresh_token, ...}.
    """
    async with httpx.AsyncClient(timeout=GOTRUE_TIMEOUT) as client:
        resp = await client.post(
            f"{GOTRUE_URL}/token",
            params={"grant_type": "refresh_token"},
            json={"refresh_token": refresh_token},
            headers=_auth_headers(),
        )
        if resp.status_code != 200:
            try:
                body = resp.json()
                detail = body.get("error_description") or body.get("msg") or resp.text
            except Exception:
                detail = resp.text
            raise HTTPException(status_code=401, detail=detail)
        return resp.json()


async def get_user(access_token: str) -> dict:
    """Get the current user from GoTrue using their access token.

    Returns the GoTrue user object.
    """
    async with httpx.AsyncClient(timeout=GOTRUE_TIMEOUT) as client:
        headers = {**_auth_headers(), "Authorization": f"Bearer {access_token}"}
        resp = await client.get(
            f"{GOTRUE_URL}/user",
            headers=headers,
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        return resp.json()


async def verify(type: str, token: str, email: str = "") -> dict:
    """Verify an email confirmation or recovery token via GoTrue.

    Returns GoTrue's response with access_token, refresh_token, user.
    """
    payload = {"type": type, "token": token}
    if email:
        payload["email"] = email
    async with httpx.AsyncClient(timeout=GOTRUE_TIMEOUT) as client:
        resp = await client.post(
            f"{GOTRUE_URL}/verify",
            json=payload,
            headers=_auth_headers(),
        )
        if resp.status_code != 200:
            try:
                body = resp.json()
                detail = body.get("msg") or body.get("error_description") or resp.text
            except Exception:
                detail = resp.text
            raise HTTPException(status_code=resp.status_code, detail=detail)
        return resp.json()


async def admin_update_password(user_id: str, new_password: str) -> dict:
    """Update a user's password via GoTrue's admin API (service role).

    This does NOT require the user's access token — it uses the service
    role key, so it can be called from a recovery flow where we only have
    the user_id (verified via a scoped recovery JWT).
    """
    async with httpx.AsyncClient(timeout=GOTRUE_TIMEOUT) as client:
        headers = {**_auth_headers()}
        if GOTRUE_SERVICE_KEY:
            headers["Authorization"] = f"Bearer {GOTRUE_SERVICE_KEY}"
        resp = await client.put(
            f"{GOTRUE_URL}/admin/users/{user_id}",
            json={"password": new_password},
            headers=headers,
        )
        if resp.status_code != 200:
            try:
                body = resp.json()
                detail = body.get("msg") or body.get("error_description") or resp.text
            except Exception:
                detail = resp.text
            raise HTTPException(status_code=resp.status_code, detail=detail)
        try:
            return resp.json() or {}
        except Exception:
            return {}


async def google_login(id_token: str) -> dict:
    """Authenticate a user with a Google ID token via GoTrue.

    Returns {access_token, refresh_token, ...}.
    """
    async with httpx.AsyncClient(timeout=GOTRUE_TIMEOUT) as client:
        resp = await client.post(
            f"{GOTRUE_URL}/token",
            params={"grant_type": "id_token"},
            json={"provider": "google", "id_token": id_token},
            headers=_auth_headers(),
        )
        if resp.status_code != 200:
            try:
                body = resp.json()
                detail = body.get("msg") or body.get("error_description") or resp.text
            except Exception:
                detail = resp.text
            raise HTTPException(status_code=resp.status_code, detail=detail)
        return resp.json()
