from fastapi import APIRouter, HTTPException, Request, Body, Depends
from pydantic import BaseModel
from typing import Optional
from database import fetch, fetch_one, execute, generate_id, now
from auth.dependencies import get_current_user
from mailer import fire_message_notification

# Helper to create a notification (imported inline to avoid circular deps)
async def _create_notification(user_id: str, type_: str, title: str, body: str = "", data: dict = None):
    from routes.notifications import create_notification_helper
    await create_notification_helper(user_id, type_, title, body, data or {})

router = APIRouter(prefix="/api/messages")


class MessageCreate(BaseModel):
    match_id: str
    sender_id: str
    receiver_id: str = ""
    content: str
    is_read: bool = False
    attachment_url: str = ""
    attachment_type: str = ""
    attachment_name: str = ""
    attachment_category: str = ""


class MessageUpdate(BaseModel):
    is_read: Optional[bool] = None
    delivered_at: Optional[str] = None
    read_at: Optional[str] = None


@router.get("")
async def list_messages(request: Request):
    query = "SELECT * FROM messages"
    params = []
    conditions = []
    idx = 1

    for key in request.query_params:
        if key in ('match_id', 'sender_id', 'receiver_id', 'is_read'):
            if key == 'is_read':
                conditions.append(f"{key} = ${idx}")
                params.append(request.query_params[key] in ('true', '1'))
            else:
                conditions.append(f"{key} = ${idx}")
                params.append(request.query_params[key])
            idx += 1

    if conditions:
        query += " WHERE " + " AND ".join(conditions)

    query += " ORDER BY created_date ASC"
    return await fetch(query, *params)


@router.get("/{message_id}")
async def get_message(message_id: str):
    row = await fetch_one("SELECT * FROM messages WHERE id = $1", message_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Message not found")
    return row


@router.post("")
async def create_message(msg: MessageCreate, user: dict = Depends(get_current_user)):
    mid = generate_id()
    now_ts = now()

    # Fetch match unconditionally (used for receiver resolution, block check, and pending limit)
    match = await fetch_one("SELECT * FROM matches WHERE id = $1", msg.match_id)

    # Resolve receiver: use provided receiver_id, or look up from the match
    receiver_id = msg.receiver_id
    if not receiver_id and match:
        receiver_id = match["user2_id"] if match["user1_id"] == msg.sender_id else match["user1_id"]

    # Reject if either user has blocked the other
    if receiver_id:
        blocked = await fetch_one(
            """SELECT 1 FROM public.blocked_users
               WHERE (blocker_id = $1 AND blocked_id = $2)
                  OR (blocker_id = $2 AND blocked_id = $1)
               LIMIT 1""",
            receiver_id, msg.sender_id
        )
        if blocked:
            raise HTTPException(status_code=403, detail="Cannot send message — user is blocked")

    # Enforce 3-message limit for pending and unmatched matches
    if match and match["status"] in ("pending", "unmatched"):
        msg_count = await fetch_one(
            "SELECT COUNT(*) as cnt FROM messages WHERE match_id = $1 AND sender_id = $2",
            msg.match_id, msg.sender_id
        )
        if msg_count and msg_count["cnt"] >= 3:
            label = "chờ kết nối" if match["status"] == "pending" else "đã hủy kết nối"
            raise HTTPException(status_code=403, detail=f"Message limit reached — {label}")

    await execute("""
        INSERT INTO messages (id, created_date, updated_date, match_id, sender_id, receiver_id, content, is_read,
            attachment_url, attachment_type, attachment_name, attachment_category)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    """, mid, now_ts, now_ts, msg.match_id, msg.sender_id, receiver_id or "", msg.content, msg.is_read,
         msg.attachment_url, msg.attachment_type, msg.attachment_name, msg.attachment_category)

    # Send message notification email to receiver
    if receiver_id:
        fire_message_notification(msg.sender_id, receiver_id, msg.match_id, msg.content)

        # Create in-app notification for the receiver
        sender_profile = await fetch_one(
            "SELECT display_name FROM contestant_profiles WHERE created_by = $1",
            msg.sender_id,
        )
        sender_name = sender_profile["display_name"] if sender_profile else "Ai đó"
        await _create_notification(
            receiver_id,
            "new_message",
            f"Tin nhắn từ {sender_name}",
            msg.content[:100] if msg.content else "",
            {"match_id": msg.match_id, "sender_id": msg.sender_id, "message_id": mid},
        )

    return await fetch_one("SELECT * FROM messages WHERE id = $1", mid)


@router.patch("/{message_id}")
async def update_message(message_id: str, update: MessageUpdate, user: dict = Depends(get_current_user)):
    existing = await fetch_one("SELECT * FROM messages WHERE id = $1", message_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Message not found")
    # Only sender or match participants can update
    match = await fetch_one("SELECT * FROM matches WHERE id = $1", existing["match_id"])
    if not match or user["id"] not in (match["user1_id"], match["user2_id"]):
        raise HTTPException(status_code=403, detail="Not authorized to update this message")

    fields = []
    vals = []
    idx = 1
    for key, value in update.model_dump(exclude_unset=True).items():
        if value is not None:
            fields.append(f"{key} = ${idx}")
            vals.append(value)
            idx += 1

    if fields:
        fields.append(f"updated_date = ${idx}")
        vals.append(now())
        idx += 1
        vals.append(message_id)
        await execute(f"UPDATE messages SET {', '.join(fields)} WHERE id = ${idx}", *vals)

    return await fetch_one("SELECT * FROM messages WHERE id = $1", message_id)


@router.post("/bulk-update")
async def bulk_update_messages(data: dict = Body(...), user: dict = Depends(get_current_user)):
    ids = data.get("ids", [])
    updates = data.get("updates", {})
    if not ids:
        return {"success": False, "error": "No ids provided"}

    # Verify user is a participant in the matches owning these messages
    placeholders = ", ".join(f"${i+1}" for i in range(len(ids)))
    rows = await fetch(
        f"SELECT DISTINCT match_id FROM messages WHERE id IN ({placeholders})", *ids
    )
    for row in rows:
        match = await fetch_one("SELECT * FROM matches WHERE id = $1", row["match_id"])
        if not match or user["id"] not in (match["user1_id"], match["user2_id"]):
            raise HTTPException(status_code=403, detail="Not authorized to update these messages")

    fields = []
    vals = []
    idx = 1
    for key, value in updates.items():
        if key == 'is_read':
            fields.append(f"{key} = ${idx}")
            vals.append(value)
        else:
            fields.append(f"{key} = ${idx}")
            vals.append(value)
        idx += 1

    if fields:
        fields.append(f"updated_date = ${idx}")
        vals.append(now())
        idx += 1
        # Build IN clause: $N, $N+1, ...
        in_placeholders = ", ".join(f"${idx + i}" for i in range(len(ids)))
        vals.extend(ids)
        await execute(f"UPDATE messages SET {', '.join(fields)} WHERE id IN ({in_placeholders})", *vals)

    return {"success": True}


@router.delete("/{message_id}")
async def delete_message(message_id: str, user: dict = Depends(get_current_user)):
    existing = await fetch_one("SELECT * FROM messages WHERE id = $1", message_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Message not found")
    match = await fetch_one("SELECT * FROM matches WHERE id = $1", existing["match_id"])
    if not match or user["id"] not in (match["user1_id"], match["user2_id"]):
        raise HTTPException(status_code=403, detail="Not authorized to delete this message")
    await execute("DELETE FROM messages WHERE id = $1", message_id)
    return {"success": True}


class MarkReadRequest(BaseModel):
    match_id: str


@router.post("/mark-read")
async def mark_read(data: MarkReadRequest, user: dict = Depends(get_current_user)):
    """Mark all unread messages in a match as read for the current user."""
    # Verify user is a participant in this match
    match = await fetch_one("SELECT * FROM matches WHERE id = $1", data.match_id)
    if not match or user["id"] not in (match["user1_id"], match["user2_id"]):
        raise HTTPException(status_code=403, detail="Not authorized")

    now_ts = now()
    result = await execute("""
        UPDATE messages
        SET is_read = true, read_at = $1, delivered_at = COALESCE(delivered_at, $1), updated_date = $1
        WHERE match_id = $2 AND receiver_id = $3 AND is_read = false
    """, now_ts, data.match_id, user["id"])

    return {"success": True, "updated_count": int(result.split()[-1]) if result else 0}


@router.post("/mark-delivered")
async def mark_delivered(data: MarkReadRequest, user: dict = Depends(get_current_user)):
    """Mark all undelivered messages in a match as delivered for the current user."""
    match = await fetch_one("SELECT * FROM matches WHERE id = $1", data.match_id)
    if not match or user["id"] not in (match["user1_id"], match["user2_id"]):
        raise HTTPException(status_code=403, detail="Not authorized")

    now_ts = now()
    result = await execute("""
        UPDATE messages
        SET delivered_at = $1, updated_date = $1
        WHERE match_id = $2 AND receiver_id = $3 AND delivered_at IS NULL
    """, now_ts, data.match_id, user["id"])

    return {"success": True, "updated_count": int(result.split()[-1]) if result else 0}
