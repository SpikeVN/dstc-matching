import json
from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel
from typing import Optional
from database import fetch, fetch_one, execute, generate_id, now
from auth.dependencies import get_current_user

router = APIRouter(prefix="/api/teams")


class TeamCreate(BaseModel):
    name: str
    leader_id: str
    member_ids: list = []
    max_members: int = 4
    status: str = "forming"


class TeamUpdate(BaseModel):
    name: Optional[str] = None
    leader_id: Optional[str] = None
    member_ids: Optional[list] = None
    max_members: Optional[int] = None
    status: Optional[str] = None


@router.get("")
async def list_teams(request: Request):
    query = "SELECT * FROM teams"
    params = []
    conditions = []
    idx = 1

    for key in request.query_params:
        if key in ("leader_id", "status", "name", "id"):
            conditions.append(f"{key} = ${idx}")
            params.append(request.query_params[key])
            idx += 1

    if conditions:
        query += " WHERE " + " AND ".join(conditions)

    query += " ORDER BY created_date DESC"
    return await fetch(query, *params)


@router.get("/{team_id}")
async def get_team(team_id: str):
    row = await fetch_one("SELECT * FROM teams WHERE id = $1", team_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Team not found")
    return row


@router.post("")
async def create_team(team: TeamCreate, user: dict = Depends(get_current_user)):
    tid = generate_id()
    now_ts = now()
    # Always set leader to the authenticated user
    await execute(
        """
        INSERT INTO teams (id, created_date, updated_date, name, leader_id, member_ids, max_members, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    """,
        tid,
        now_ts,
        now_ts,
        team.name,
        user["id"],
        json.dumps(team.member_ids),
        team.max_members,
        team.status,
    )
    return await fetch_one("SELECT * FROM teams WHERE id = $1", tid)


@router.patch("/{team_id}")
async def update_team(
    team_id: str, update: TeamUpdate, user: dict = Depends(get_current_user)
):
    existing = await fetch_one("SELECT * FROM teams WHERE id = $1", team_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Team not found")
    if existing["leader_id"] != user["id"]:
        raise HTTPException(
            status_code=403, detail="Only the team leader can update the team"
        )

    fields = []
    vals = []
    idx = 1
    for key, value in update.model_dump(exclude_unset=True).items():
        if value is not None:
            if key == "member_ids":
                fields.append(f"{key} = ${idx}")
                vals.append(json.dumps(value))
            else:
                fields.append(f"{key} = ${idx}")
                vals.append(value)
            idx += 1

    if fields:
        fields.append(f"updated_date = ${idx}")
        vals.append(now())
        idx += 1
        vals.append(team_id)
        await execute(f"UPDATE teams SET {', '.join(fields)} WHERE id = ${idx}", *vals)

    return await fetch_one("SELECT * FROM teams WHERE id = $1", team_id)


@router.delete("/{team_id}")
async def delete_team(team_id: str, user: dict = Depends(get_current_user)):
    existing = await fetch_one("SELECT * FROM teams WHERE id = $1", team_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Team not found")
    if existing["leader_id"] != user["id"]:
        raise HTTPException(
            status_code=403, detail="Only the team leader can delete the team"
        )
    await execute("DELETE FROM teams WHERE id = $1", team_id)
    return {"success": True}
