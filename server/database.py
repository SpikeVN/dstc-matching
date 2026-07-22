import json
import uuid
from datetime import datetime, timezone

import asyncpg

from auth.config import DATABASE_URL

_pool: asyncpg.Pool | None = None


async def get_pool() -> asyncpg.Pool:
    """Get or create the asyncpg connection pool."""
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            DATABASE_URL,
            min_size=2,
            max_size=10,
            statement_cache_size=0,  # Disable prepared statements for pgbouncer compatibility
        )
    return _pool


async def close_pool():
    """Close the connection pool (call on shutdown)."""
    global _pool
    if _pool:
        await _pool.close()
        _pool = None


async def fetch(query: str, *args) -> list[dict]:
    """Execute a SELECT query and return a list of dicts."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(query, *args)
        return [_record_to_dict(r) for r in rows]


async def fetch_one(query: str, *args) -> dict | None:
    """Execute a SELECT query and return a single dict or None."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(query, *args)
        return _record_to_dict(row) if row else None


async def execute(query: str, *args) -> str:
    """Execute an INSERT/UPDATE/DELETE query. Returns the status string."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        return await conn.execute(query, *args)


def generate_id() -> str:
    """Generate a UUID string for use as a primary key."""
    return str(uuid.uuid4())


def now() -> datetime:
    """Return the current UTC time as a timezone-aware datetime."""
    return datetime.now(timezone.utc)


def _record_to_dict(record: asyncpg.Record) -> dict:
    """Convert an asyncpg Record to a plain dict, parsing JSON fields."""
    d = {}
    for k, v in dict(record).items():
        # Convert UUID objects to strings so comparisons with Pydantic str fields work
        if isinstance(v, uuid.UUID):
            d[k] = str(v)
        else:
            d[k] = v
    # Parse JSONB fields that asyncpg returns as strings
    for field in ("technical_skills", "soft_skills", "goals", "member_ids"):
        if field in d and isinstance(d[field], str):
            try:
                d[field] = json.loads(d[field])
            except (json.JSONDecodeError, TypeError):
                d[field] = []
    # Convert boolean fields (PostgreSQL returns real bools, but just in case)
    for field in ("has_team", "profile_complete", "visited_profile", "is_match", "is_read", "user1_confirmed", "user2_confirmed"):
        if field in d and d[field] is not None:
            d[field] = bool(d[field])
    return d
