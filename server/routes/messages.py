import json
from fastapi import APIRouter, HTTPException, Request, Body
from pydantic import BaseModel
from typing import Optional
from database import get_connection, row_to_dict, rows_to_list, generate_id, now

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
def list_messages(request: Request):
    conn = get_connection()
    query = "SELECT * FROM messages"
    params = []
    conditions = []

    for key in request.query_params:
        if key in ('match_id', 'sender_id', 'receiver_id', 'is_read'):
            if key == 'is_read':
                conditions.append(f"{key} = ?")
                params.append(int(request.query_params[key] == 'true' or request.query_params[key] == '1'))
            else:
                conditions.append(f"{key} = ?")
                params.append(request.query_params[key])

    if conditions:
        query += " WHERE " + " AND ".join(conditions)

    query += " ORDER BY created_date ASC"
    rows = conn.execute(query, params).fetchall()
    conn.close()
    return rows_to_list(rows)


@router.get("/{message_id}")
def get_message(message_id: str):
    conn = get_connection()
    row = conn.execute("SELECT * FROM messages WHERE id = ?", (message_id,)).fetchone()
    conn.close()
    if row is None:
        raise HTTPException(status_code=404, detail="Message not found")
    return row_to_dict(row)


@router.post("")
def create_message(msg: MessageCreate):
    conn = get_connection()
    mid = generate_id()
    now_ts = now()
    conn.execute("""
        INSERT INTO messages (id, created_date, updated_date, match_id, sender_id, receiver_id, content, is_read)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (mid, now_ts, now_ts, msg.match_id, msg.sender_id, msg.receiver_id, msg.content, int(msg.is_read)))
    conn.commit()
    row = conn.execute("SELECT * FROM messages WHERE id = ?", (mid,)).fetchone()
    conn.close()
    return row_to_dict(row)


@router.patch("/{message_id}")
def update_message(message_id: str, update: MessageUpdate):
    conn = get_connection()
    existing = conn.execute("SELECT * FROM messages WHERE id = ?", (message_id,)).fetchone()
    if existing is None:
        conn.close()
        raise HTTPException(status_code=404, detail="Message not found")

    fields = []
    vals = []
    for key, value in update.dict(exclude_unset=True).items():
        if value is not None:
            if key == 'is_read':
                fields.append(f"{key} = ?")
                vals.append(int(value))
            else:
                fields.append(f"{key} = ?")
                vals.append(value)

    if fields:
        fields.append("updated_date = ?")
        vals.append(now())
        vals.append(message_id)
        conn.execute(f"UPDATE messages SET {', '.join(fields)} WHERE id = ?", vals)
        conn.commit()

    row = conn.execute("SELECT * FROM messages WHERE id = ?", (message_id,)).fetchone()
    conn.close()
    return row_to_dict(row)


@router.post("/bulk-update")
def bulk_update_messages(data: dict = Body(...)):
    conn = get_connection()
    ids = data.get("ids", [])
    updates = data.get("updates", {})
    if not ids:
        conn.close()
        return {"success": False, "error": "No ids provided"}

    fields = []
    vals = []
    for key, value in updates.items():
        if key == 'is_read':
            fields.append(f"{key} = ?")
            vals.append(int(value))
        else:
            fields.append(f"{key} = ?")
            vals.append(value)

    if fields:
        fields.append("updated_date = ?")
        vals.append(now())
        placeholders = ",".join("?" for _ in ids)
        conn.execute(f"UPDATE messages SET {', '.join(fields)} WHERE id IN ({placeholders})", vals + ids)
        conn.commit()

    conn.close()
    return {"success": True}


@router.delete("/{message_id}")
def delete_message(message_id: str):
    conn = get_connection()
    conn.execute("DELETE FROM messages WHERE id = ?", (message_id,))
    conn.commit()
    conn.close()
    return {"success": True}