from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from database import get_connection, row_to_dict, rows_to_list, generate_id, now

router = APIRouter(prefix="/api/team-invites")


class InviteCreate(BaseModel):
    team_id: str
    inviter_id: str
    invitee_id: str
    status: str = "pending"


class InviteUpdate(BaseModel):
    status: Optional[str] = None


@router.get("")
def list_invites(request: Request):
    conn = get_connection()
    query = "SELECT * FROM team_invites"
    params = []
    conditions = []

    for key in request.query_params:
        if key in ('team_id', 'inviter_id', 'invitee_id', 'status'):
            conditions.append(f"{key} = ?")
            params.append(request.query_params[key])

    if conditions:
        query += " WHERE " + " AND ".join(conditions)

    query += " ORDER BY created_date DESC"
    rows = conn.execute(query, params).fetchall()
    conn.close()
    return rows_to_list(rows)


@router.get("/{invite_id}")
def get_invite(invite_id: str):
    conn = get_connection()
    row = conn.execute("SELECT * FROM team_invites WHERE id = ?", (invite_id,)).fetchone()
    conn.close()
    if row is None:
        raise HTTPException(status_code=404, detail="TeamInvite not found")
    return row_to_dict(row)


@router.post("")
def create_invite(invite: InviteCreate):
    conn = get_connection()
    iid = generate_id()
    now_ts = now()
    conn.execute("""
        INSERT INTO team_invites (id, created_date, updated_date, team_id, inviter_id, invitee_id, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (iid, now_ts, now_ts, invite.team_id, invite.inviter_id, invite.invitee_id, invite.status))
    conn.commit()
    row = conn.execute("SELECT * FROM team_invites WHERE id = ?", (iid,)).fetchone()
    conn.close()
    return row_to_dict(row)


@router.patch("/{invite_id}")
def update_invite(invite_id: str, update: InviteUpdate):
    conn = get_connection()
    existing = conn.execute("SELECT * FROM team_invites WHERE id = ?", (invite_id,)).fetchone()
    if existing is None:
        conn.close()
        raise HTTPException(status_code=404, detail="TeamInvite not found")

    fields = []
    vals = []
    for key, value in update.dict(exclude_unset=True).items():
        if value is not None:
            fields.append(f"{key} = ?")
            vals.append(value)

    if fields:
        fields.append("updated_date = ?")
        vals.append(now())
        vals.append(invite_id)
        conn.execute(f"UPDATE team_invites SET {', '.join(fields)} WHERE id = ?", vals)
        conn.commit()

    row = conn.execute("SELECT * FROM team_invites WHERE id = ?", (invite_id,)).fetchone()
    conn.close()
    return row_to_dict(row)


@router.delete("/{invite_id}")
def delete_invite(invite_id: str):
    conn = get_connection()
    conn.execute("DELETE FROM team_invites WHERE id = ?", (invite_id,))
    conn.commit()
    conn.close()
    return {"success": True}