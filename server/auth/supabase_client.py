"""Supabase async client — shared instance for auth and storage."""

from supabase import create_async_client
from supabase._async.client import AsyncClient

from auth.config import SUPABASE_URL, SUPABASE_SERVICE_KEY

_client: AsyncClient | None = None


async def init_supabase() -> AsyncClient:
    """Initialize the global Supabase async client (call once at startup)."""
    global _client
    _client = await create_async_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    print(f"Supabase client initialized → {SUPABASE_URL}")
    return _client


def get_supabase() -> AsyncClient:
    """Return the global Supabase client. Raises if not initialized."""
    if _client is None:
        raise RuntimeError("Supabase client not initialized — call init_supabase() first")
    return _client
