from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel
from typing import Optional
from database import fetch, fetch_one, execute, generate_id, now
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
async def list_matches(request: Request):
    query = "SELECT * FROM matches"
    params = []
    conditions = []
    idx = 1

    for key in request.query_params:
        if key in ('user1_id', 'user2_id', 'status'):
            conditions.append(f"{key} = ${idx}")
            params.append(request.query_params[key])
            idx += 1

    if conditions:
        query += " WHERE " + " AND ".join(conditions)

    query += " ORDER BY created_date DESC"
    return await fetch(query, *params)


@router.get("/{match_id}")
async def get_match(match_id: str):
    row = await fetch_one("SELECT * FROM matches WHERE id = $1", match_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Match not found")
    return row


@router.post("")
async def create_match(match: MatchCreate, user: dict = Depends(get_current_user)):
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
    existing = await fetch_one("SELECT * FROM matches WHERE id = $1", match_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Match not found")

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
    await execute("DELETE FROM matches WHERE id = $1", match_id)
    return {"success": True}
