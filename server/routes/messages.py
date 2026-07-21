from fastapi import APIRouter, HTTPException, Request, Body, Depends
from pydantic import BaseModel
from typing import Optional
from database import fetch, fetch_one, execute, generate_id, now
from auth.dependencies import get_current_user

router = APIRouter(prefix="/api/messages")


class MessageCreate(BaseModel):
    match_id: str
    sender_id: str
    receiver_id: str = ""
    content: str
    is_read: bool = False


class MessageUpdate(BaseModel):
    is_read: Optional[bool] = None


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
    await execute("""
        INSERT INTO messages (id, created_date, updated_date, match_id, sender_id, receiver_id, content, is_read)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    """, mid, now_ts, now_ts, msg.match_id, msg.sender_id, msg.receiver_id, msg.content, msg.is_read)
    return await fetch_one("SELECT * FROM messages WHERE id = $1", mid)


@router.patch("/{message_id}")
async def update_message(message_id: str, update: MessageUpdate, user: dict = Depends(get_current_user)):
    existing = await fetch_one("SELECT * FROM messages WHERE id = $1", message_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Message not found")

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
    await execute("DELETE FROM messages WHERE id = $1", message_id)
    return {"success": True}
