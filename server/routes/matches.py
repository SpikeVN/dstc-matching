import json
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from database import get_connection, row_to_dict, rows_to_list, generate_id, now

router = APIRouter(prefix="/api/matches")


class MatchCreate(BaseModel):
    user1_id: str
    user2_id: str
    status: str = "matched"
    user1_confirmed: bool = False
    user2_confirmed: bool = False


class MatchUpdate(BaseModel):
    status: Optional[str] = None
    user1_confirmed: Optional[bool] = None
    user2_confirmed: Optional[bool] = None


@router.get("")
def list_matches(request: Request):
    conn = get_connection()
    query = "SELECT * FROM matches"
    params = []
    conditions = []

    for key in request.query_params:
        if key in ('user1_id', 'user2_id', 'status'):
            conditions.append(f"{key} = ?")
            params.append(request.query_params[key])

    if conditions:
        query += " WHERE " + " AND ".join(conditions)

    query += " ORDER BY created_date DESC"
    rows = conn.execute(query, params).fetchall()
    conn.close()
    return rows_to_list(rows)


@router.get("/{match_id}")
def get_match(match_id: str):
    conn = get_connection()
    row = conn.execute("SELECT * FROM matches WHERE id = ?", (match_id,)).fetchone()
    conn.close()
    if row is None:
        raise HTTPException(status_code=404, detail="Match not found")
    return row_to_dict(row)


@router.post("")
def create_match(match: MatchCreate):
    conn = get_connection()
    mid = generate_id()
    now_ts = now()
    conn.execute("""
        INSERT INTO matches (id, created_date, updated_date, user1_id, user2_id, status, user1_confirmed, user2_confirmed)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (mid, now_ts, now_ts, match.user1_id, match.user2_id, match.status,
          int(match.user1_confirmed), int(match.user2_confirmed)))
    conn.commit()
    row = conn.execute("SELECT * FROM matches WHERE id = ?", (mid,)).fetchone()
    conn.close()
    return row_to_dict(row)


@router.patch("/{match_id}")
def update_match(match_id: str, update: MatchUpdate):
    conn = get_connection()
    existing = conn.execute("SELECT * FROM matches WHERE id = ?", (match_id,)).fetchone()
    if existing is None:
        conn.close()
        raise HTTPException(status_code=404, detail="Match not found")

    fields = []
    vals = []
    for key, value in update.dict(exclude_unset=True).items():
        if value is not None:
            if key in ('user1_confirmed', 'user2_confirmed'):
                fields.append(f"{key} = ?")
                vals.append(int(value))
            else:
                fields.append(f"{key} = ?")
                vals.append(value)

    if fields:
        fields.append("updated_date = ?")
        vals.append(now())
        vals.append(match_id)
        conn.execute(f"UPDATE matches SET {', '.join(fields)} WHERE id = ?", vals)
        conn.commit()

    row = conn.execute("SELECT * FROM matches WHERE id = ?", (match_id,)).fetchone()
    conn.close()
    return row_to_dict(row)


@router.delete("/{match_id}")
def delete_match(match_id: str):
    conn = get_connection()
    conn.execute("DELETE FROM matches WHERE id = ?", (match_id,))
    conn.commit()
    conn.close()
    return {"success": True}