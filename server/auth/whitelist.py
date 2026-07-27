"""Email whitelist helpers — used by admin CRUD and auth signup flows.

Empty whitelist = feature off (all emails allowed).
Case-insensitive email matching.
"""

from database import fetch_one, fetch


async def is_whitelist_active() -> bool:
    """Check if whitelist has any entries. Empty whitelist = feature off."""
    row = await fetch_one("SELECT COUNT(*) as count FROM public.email_whitelist")
    return row is not None and row["count"] > 0


async def is_email_whitelisted(email: str) -> bool:
    """Check if an email is in the whitelist.

    Returns True immediately if the whitelist is empty (feature not active).
    Performs a case-insensitive comparison.
    """
    if not (await is_whitelist_active()):
        return True  # whitelist empty → allow all

    row = await fetch_one(
        "SELECT 1 FROM public.email_whitelist WHERE LOWER(email) = LOWER($1)",
        email,
    )
    return row is not None


async def get_all_whitelisted_emails(search: str = "") -> list[dict]:
    """Return all whitelist entries with the name of who added each.

    Supports an optional search filter against the email field.
    """
    query = """
        SELECT
            ew.id,
            ew.email,
            ew.created_date,
            COALESCE(cp.display_name, '') as added_by_name
        FROM public.email_whitelist ew
        LEFT JOIN public.contestant_profiles cp ON ew.added_by = cp.created_by
    """
    params = []
    if search:
        query += " WHERE ew.email ILIKE $1"
        params.append(f"%{search}%")
    query += " ORDER BY ew.created_date DESC"
    return await fetch(query, *params)
