from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from database import get_connection, row_to_dict, rows_to_list, generate_id, now

router = APIRouter(prefix="/api/swipe-actions")


class SwipeCreate(BaseModel):
    swiper_id: str
    swiped_id: str
    action: str
    is_match: bool = False


class SwipeUpdate(BaseModel):
    is_match: Optional[bool] = None


@router.get("")
def list_swipes(request: Request):
    conn = get_connection()
    query = "SELECT * FROM swipe_actions"
    params = []
    conditions = []

    for key in request.query_params:
        if key in ('swiper_id', 'swiped_id', 'action', 'is_match'):
            if key == 'is_match':
                conditions.append(f"{key} = ?")
                params.append(int(request.query_params[key] == 'true' or request.query_params[key] == '1'))
            else:
                conditions.append(f"{key} = ?")
                params.append(request.query_params[key])

    if conditions:
        query += " WHERE " + " AND ".join(conditions)

    query += " ORDER BY created_date DESC"
    rows = conn.execute(query, params).fetchall()
    conn.close()
    return rows_to_list(rows)


@router.get("/{swipe_id}")
def get_swipe(swipe_id: str):
    conn = get_connection()
    row = conn.execute("SELECT * FROM swipe_actions WHERE id = ?", (swipe_id,)).fetchone()
    conn.close()
    if row is None:
        raise HTTPException(status_code=404, detail="SwipeAction not found")
    return row_to_dict(row)


@router.post("")
def create_swipe(swipe: SwipeCreate):
    conn = get_connection()
    sid = generate_id()
    now_ts = now()
    conn.execute("""
        INSERT INTO swipe_actions (id, created_date, updated_date, swiper_id, swiped_id, action, is_match)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (sid, now_ts, now_ts, swipe.swiper_id, swipe.swiped_id, swipe.action, int(swipe.is_match)))
    conn.commit()
    row = conn.execute("SELECT * FROM swipe_actions WHERE id = ?", (sid,)).fetchone()
    conn.close()
    return row_to_dict(row)


@router.patch("/{swipe_id}")
def update_swipe(swipe_id: str, update: SwipeUpdate):
    conn = get_connection()
    existing = conn.execute("SELECT * FROM swipe_actions WHERE id = ?", (swipe_id,)).fetchone()
    if existing is None:
        conn.close()
        raise HTTPException(status_code=404, detail="SwipeAction not found")

    fields = []
    vals = []
    for key, value in update.dict(exclude_unset=True).items():
        if value is not None:
            if key == 'is_match':
                fields.append(f"{key} = ?")
                vals.append(int(value))
            else:
                fields.append(f"{key} = ?")
                vals.append(value)

    if fields:
        fields.append("updated_date = ?")
        vals.append(now())
        vals.append(swipe_id)
        conn.execute(f"UPDATE swipe_actions SET {', '.join(fields)} WHERE id = ?", vals)
        conn.commit()

    row = conn.execute("SELECT * FROM swipe_actions WHERE id = ?", (swipe_id,)).fetchone()
    conn.close()
    return row_to_dict(row)


@router.delete("/{swipe_id}")
def delete_swipe(swipe_id: str):
    conn = get_connection()
    conn.execute("DELETE FROM swipe_actions WHERE id = ?", (swipe_id,))
    conn.commit()
    conn.close()
    return {"success": True}