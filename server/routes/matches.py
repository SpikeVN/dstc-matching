from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel
from typing import Optional
from database import fetch, fetch_one, execute, generate_id, now, is_disabled
from auth.dependencies import get_current_user

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
async def list_matches(request: Request, user: dict = Depends(get_current_user)):
    # Restrict to matches where the authenticated user is a participant.
    # Additional optional status filter is scoped within those matches only.
    params = [user["id"], user["id"]]
    conditions = ["(user1_id = $1 OR user2_id = $2)"]
    idx = 3

    for key in request.query_params:
        if key in ('status',):
            conditions.append(f"{key} = ${idx}")
            params.append(request.query_params[key])
            idx += 1

    query = f"SELECT * FROM matches WHERE {' AND '.join(conditions)} ORDER BY created_date DESC"
    return await fetch(query, *params)


@router.get("/{match_id}")
async def get_match(match_id: str, user: dict = Depends(get_current_user)):
    row = await fetch_one("SELECT * FROM matches WHERE id = $1", match_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Match not found")
    if user["id"] not in (row["user1_id"], row["user2_id"]):
        raise HTTPException(status_code=403, detail="Not authorized to view this match")
    return row


@router.post("")
async def create_match(match: MatchCreate, user: dict = Depends(get_current_user)):
    if await is_disabled("matching_disabled"):
        raise HTTPException(status_code=400, detail="Đã hết thời hạn thực hiện matching.")
    if user["id"] not in (match.user1_id, match.user2_id):
        raise HTTPException(status_code=403, detail="Not authorized to create this match")

    # Require mutual like before creating a match — matches must flow through
    # the swipe flow, not be created directly via the API.
    reciprocal = await fetch_one(
        """SELECT 1 FROM swipe_actions
           WHERE swiper_id = $1 AND swiped_id = $2 AND action = 'like'
             AND EXISTS (
               SELECT 1 FROM swipe_actions
               WHERE swiper_id = $2 AND swiped_id = $1 AND action = 'like'
             )""",
        match.user1_id, match.user2_id,
    )
    if not reciprocal:
        raise HTTPException(
            status_code=403,
            detail="Both users must like each other before creating a match",
        )

    # Prevent duplicate matches (defense in depth alongside DB UNIQUE constraint)
    existing_match = await fetch_one(
        """SELECT 1 FROM matches
           WHERE (user1_id = $1 AND user2_id = $2)
              OR (user1_id = $2 AND user2_id = $1)
           LIMIT 1""",
        match.user1_id, match.user2_id,
    )
    if existing_match:
        raise HTTPException(status_code=409, detail="Match already exists between these users")

    mid = generate_id()
    now_ts = now()
    await execute("""
        INSERT INTO matches (id, created_date, updated_date, user1_id, user2_id, status, user1_confirmed, user2_confirmed)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    """, mid, now_ts, now_ts, match.user1_id, match.user2_id, match.status,
          match.user1_confirmed, match.user2_confirmed)
    return await fetch_one("SELECT * FROM matches WHERE id = $1", mid)


@router.patch("/{match_id}")
async def update_match(match_id: str, update: MatchUpdate, user: dict = Depends(get_current_user)):
    if await is_disabled("matching_disabled"):
        raise HTTPException(status_code=400, detail="Đã hết thời hạn thực hiện matching.")
    existing = await fetch_one("SELECT * FROM matches WHERE id = $1", match_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Match not found")
    if user["id"] not in (existing["user1_id"], existing["user2_id"]):
        raise HTTPException(status_code=403, detail="Not authorized to update this match")

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
        vals.append(match_id)
        await execute(f"UPDATE matches SET {', '.join(fields)} WHERE id = ${idx}", *vals)

    return await fetch_one("SELECT * FROM matches WHERE id = $1", match_id)


@router.delete("/{match_id}")
async def delete_match(match_id: str, user: dict = Depends(get_current_user)):
    """Soft-delete a match: set status to 'unmatched'. Messages stay visible, but
    a 3-message limit is enforced (see messages.py)."""
    if await is_disabled("matching_disabled"):
        raise HTTPException(status_code=400, detail="Đã hết thời hạn thực hiện matching.")
    existing = await fetch_one("SELECT * FROM matches WHERE id = $1", match_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Match not found")
    if user["id"] not in (existing["user1_id"], existing["user2_id"]):
        raise HTTPException(status_code=403, detail="Not authorized to delete this match")

    # Soft-delete: keep match visible, just change status
    await execute(
        "UPDATE matches SET status = 'unmatched', updated_date = $1 WHERE id = $2",
        now(), match_id,
    )
    return {"success": True, "unmatched": True}
