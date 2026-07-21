from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel
from typing import Optional
from database import fetch, fetch_one, execute, generate_id, now
from auth.dependencies import get_current_user

router = APIRouter(prefix="/api/swipe-actions")


class SwipeCreate(BaseModel):
    swiper_id: str
    swiped_id: str
    action: str
    is_match: bool = False


class SwipeUpdate(BaseModel):
    is_match: Optional[bool] = None


@router.get("")
async def list_swipes(request: Request):
    query = "SELECT * FROM swipe_actions"
    params = []
    conditions = []
    idx = 1

    for key in request.query_params:
        if key in ('swiper_id', 'swiped_id', 'action', 'is_match'):
            if key == 'is_match':
                conditions.append(f"{key} = ${idx}")
                params.append(request.query_params[key] in ('true', '1'))
            else:
                conditions.append(f"{key} = ${idx}")
                params.append(request.query_params[key])
            idx += 1

    if conditions:
        query += " WHERE " + " AND ".join(conditions)

    query += " ORDER BY created_date DESC"
    return await fetch(query, *params)


@router.get("/{swipe_id}")
async def get_swipe(swipe_id: str):
    row = await fetch_one("SELECT * FROM swipe_actions WHERE id = $1", swipe_id)
    if row is None:
        raise HTTPException(status_code=404, detail="SwipeAction not found")
    return row


@router.post("")
async def create_swipe(swipe: SwipeCreate, user: dict = Depends(get_current_user)):
    sid = generate_id()
    now_ts = now()
    await execute("""
        INSERT INTO swipe_actions (id, created_date, updated_date, swiper_id, swiped_id, action, is_match)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
    """, sid, now_ts, now_ts, swipe.swiper_id, swipe.swiped_id, swipe.action, swipe.is_match)
    return await fetch_one("SELECT * FROM swipe_actions WHERE id = $1", sid)


@router.patch("/{swipe_id}")
async def update_swipe(swipe_id: str, update: SwipeUpdate, user: dict = Depends(get_current_user)):
    existing = await fetch_one("SELECT * FROM swipe_actions WHERE id = $1", swipe_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="SwipeAction not found")

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
        vals.append(swipe_id)
        await execute(f"UPDATE swipe_actions SET {', '.join(fields)} WHERE id = ${idx}", *vals)

    return await fetch_one("SELECT * FROM swipe_actions WHERE id = $1", swipe_id)


@router.delete("/{swipe_id}")
async def delete_swipe(swipe_id: str, user: dict = Depends(get_current_user)):
    await execute("DELETE FROM swipe_actions WHERE id = $1", swipe_id)
    return {"success": True}
