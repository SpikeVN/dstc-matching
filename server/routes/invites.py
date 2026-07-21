from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel
from typing import Optional
from database import fetch, fetch_one, execute, generate_id, now
from auth.dependencies import get_current_user

router = APIRouter(prefix="/api/team-invites")


class InviteCreate(BaseModel):
    team_id: str
    inviter_id: str
    invitee_id: str
    status: str = "pending"


class InviteUpdate(BaseModel):
    status: Optional[str] = None


@router.get("")
async def list_invites(request: Request):
    query = "SELECT * FROM team_invites"
    params = []
    conditions = []
    idx = 1

    for key in request.query_params:
        if key in ('team_id', 'inviter_id', 'invitee_id', 'status'):
            conditions.append(f"{key} = ${idx}")
            params.append(request.query_params[key])
            idx += 1

    if conditions:
        query += " WHERE " + " AND ".join(conditions)

    query += " ORDER BY created_date DESC"
    return await fetch(query, *params)


@router.get("/{invite_id}")
async def get_invite(invite_id: str):
    row = await fetch_one("SELECT * FROM team_invites WHERE id = $1", invite_id)
    if row is None:
        raise HTTPException(status_code=404, detail="TeamInvite not found")
    return row


@router.post("")
async def create_invite(invite: InviteCreate, user: dict = Depends(get_current_user)):
    iid = generate_id()
    now_ts = now()
    await execute("""
        INSERT INTO team_invites (id, created_date, updated_date, team_id, inviter_id, invitee_id, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
    """, iid, now_ts, now_ts, invite.team_id, invite.inviter_id, invite.invitee_id, invite.status)
    return await fetch_one("SELECT * FROM team_invites WHERE id = $1", iid)


@router.patch("/{invite_id}")
async def update_invite(invite_id: str, update: InviteUpdate, user: dict = Depends(get_current_user)):
    existing = await fetch_one("SELECT * FROM team_invites WHERE id = $1", invite_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="TeamInvite not found")

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
        vals.append(invite_id)
        await execute(f"UPDATE team_invites SET {', '.join(fields)} WHERE id = ${idx}", *vals)

    return await fetch_one("SELECT * FROM team_invites WHERE id = $1", invite_id)


@router.delete("/{invite_id}")
async def delete_invite(invite_id: str, user: dict = Depends(get_current_user)):
    await execute("DELETE FROM team_invites WHERE id = $1", invite_id)
    return {"success": True}
