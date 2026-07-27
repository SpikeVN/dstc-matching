import json
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from database import fetch, fetch_one, execute, generate_id, now
from auth.dependencies import get_current_user

router = APIRouter(prefix="/api/notifications")

class NotificationCreate(BaseModel):
    user_id: str
    type: str
    title: str
    body: str = ""
    data: dict = {}

class MarkReadRequest(BaseModel):
    ids: List[str] = []


# ── Helper function for other modules to create notifications ──────────

async def create_notification_helper(
    user_id: str,
    type_: str,
    title: str,
    body: str = "",
    data: dict = None,
):
    """Create a notification record directly (no auth check — for use by other routes)."""
    nid = generate_id()
    now_ts = now()
    await execute(
        """
        INSERT INTO notifications (id, created_date, updated_date, user_id, type, title, body, data, is_read)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        """,
        nid,
        now_ts,
        now_ts,
        user_id,
        type_,
        title,
        body,
        json.dumps(data) if data else "{}",
        False,
    )

@router.get("")
async def list_notifications(user: dict = Depends(get_current_user)):
    """Get all notifications for the current user, newest first."""
    return await fetch(
        "SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_date DESC LIMIT 50",
        user["id"],
    )

@router.get("/unread-count")
async def unread_count(user: dict = Depends(get_current_user)):
    """Get the count of unread notifications for the current user."""
    row = await fetch_one(
        "SELECT COUNT(*) as cnt FROM notifications WHERE user_id = $1 AND is_read = false",
        user["id"],
    )
    return {"count": row["cnt"] if row else 0}

@router.post("")
async def create_notification(
    notif: NotificationCreate,
    user: dict = Depends(get_current_user),
):
    """Create a notification. Only the backend uses this; for now, the caller
    must be the notification recipient or have elevated privileges."""
    nid = generate_id()
    now_ts = now()
    await execute(
        """
        INSERT INTO notifications (id, created_date, updated_date, user_id, type, title, body, data, is_read)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        """,
        nid,
        now_ts,
        now_ts,
        notif.user_id,
        notif.type,
        notif.title,
        notif.body,
        notif.data,
        False,
    )
    # Return the created notification
    n = await fetch_one("SELECT * FROM notifications WHERE id = $1", nid)
    if n is None:
        raise HTTPException(status_code=500, detail="Failed to create notification")
    return n

@router.post("/mark-read")
async def mark_read(
    req: MarkReadRequest,
    user: dict = Depends(get_current_user),
):
    """Mark specific notifications as read."""
    if not req.ids:
        # Mark all as read
        await execute(
            "UPDATE notifications SET is_read = true, read_at = $1, updated_date = $1 WHERE user_id = $2 AND is_read = false",
            now(),
            user["id"],
        )
    else:
        placeholders = ", ".join(f"${i+2}" for i in range(len(req.ids)))
        await execute(
            f"UPDATE notifications SET is_read = true, read_at = $1, updated_date = $1 WHERE user_id = $2 AND id IN ({placeholders})",
            now(),
            user["id"],
            *req.ids,
        )
    return {"success": True}

@router.post("/clear-all")
async def clear_all(user: dict = Depends(get_current_user)):
    """Delete all notifications for the current user."""
    await execute(
        "DELETE FROM notifications WHERE user_id = $1",
        user["id"],
    )
    return {"success": True}