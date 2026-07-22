from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel
from typing import Optional
from database import fetch, fetch_one, execute, generate_id, now
from auth.dependencies import get_current_user
from mailer import fire_match_notification

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
    # Enforce that the authenticated user is the swiper
    if swipe.swiper_id != user["id"]:
        raise HTTPException(status_code=403, detail="Cannot swipe on behalf of another user")

    # Check for existing swipe from this user to the same target
    existing = await fetch_one(
        "SELECT * FROM swipe_actions WHERE swiper_id = $1 AND swiped_id = $2",
        swipe.swiper_id, swipe.swiped_id,
    )
    if existing:
        raise HTTPException(status_code=409, detail="Already swiped on this user")

    # Server determines if this is a match (mutual like)
    is_match = False
    if swipe.action == "like":
        reciprocal = await fetch_one(
            "SELECT * FROM swipe_actions WHERE swiper_id = $1 AND swiped_id = $2 AND action = 'like'",
            swipe.swiped_id, swipe.swiper_id,
        )
        if reciprocal:
            is_match = True

    sid = generate_id()
    now_ts = now()
    await execute("""
        INSERT INTO swipe_actions (id, created_date, updated_date, swiper_id, swiped_id, action, is_match)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
    """, sid, now_ts, now_ts, swipe.swiper_id, swipe.swiped_id, swipe.action, is_match)

    # If mutual like, create a match record
    if is_match:
        mid = generate_id()
        await execute("""
            INSERT INTO matches (id, created_date, updated_date, user1_id, user2_id, status, user1_confirmed, user2_confirmed)
            VALUES ($1, $2, $3, $4, $5, 'matched', false, false)
        """, mid, now_ts, now_ts, swipe.swiper_id, swipe.swiped_id)
        # Update both swipes to reflect the match
        await execute("UPDATE swipe_actions SET is_match = true WHERE id = $1", sid)
        await execute("UPDATE swipe_actions SET is_match = true WHERE swiper_id = $1 AND swiped_id = $2",
                      swipe.swiped_id, swipe.swiper_id)
        # Send match notification email to both users
        fire_match_notification(swipe.swiper_id, swipe.swiped_id, mid)

    return await fetch_one("SELECT * FROM swipe_actions WHERE id = $1", sid)


@router.patch("/{swipe_id}")
async def update_swipe(swipe_id: str, update: SwipeUpdate, user: dict = Depends(get_current_user)):
    existing = await fetch_one("SELECT * FROM swipe_actions WHERE id = $1", swipe_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="SwipeAction not found")
    if existing["swiper_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized to update this swipe")

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
    existing = await fetch_one("SELECT * FROM swipe_actions WHERE id = $1", swipe_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="SwipeAction not found")
    if existing["swiper_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized to delete this swipe")
    await execute("DELETE FROM swipe_actions WHERE id = $1", swipe_id)
    return {"success": True}
