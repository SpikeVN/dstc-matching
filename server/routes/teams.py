import json
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from database import get_connection, row_to_dict, rows_to_list, generate_id, now

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
def list_teams(request: Request):
    conn = get_connection()
    query = "SELECT * FROM teams"
    params = []
    conditions = []

    for key in request.query_params:
        if key in ('leader_id', 'status', 'name', 'id'):
            conditions.append(f"{key} = ?")
            params.append(request.query_params[key])

    if conditions:
        query += " WHERE " + " AND ".join(conditions)

    query += " ORDER BY created_date DESC"
    rows = conn.execute(query, params).fetchall()
    conn.close()
    return rows_to_list(rows)


@router.get("/{team_id}")
def get_team(team_id: str):
    conn = get_connection()
    row = conn.execute("SELECT * FROM teams WHERE id = ?", (team_id,)).fetchone()
    conn.close()
    if row is None:
        raise HTTPException(status_code=404, detail="Team not found")
    return row_to_dict(row)


@router.post("")
def create_team(team: TeamCreate):
    conn = get_connection()
    tid = generate_id()
    now_ts = now()
    conn.execute("""
        INSERT INTO teams (id, created_date, updated_date, name, leader_id, member_ids, max_members, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (tid, now_ts, now_ts, team.name, team.leader_id, json.dumps(team.member_ids), team.max_members, team.status))
    conn.commit()
    row = conn.execute("SELECT * FROM teams WHERE id = ?", (tid,)).fetchone()
    conn.close()
    return row_to_dict(row)


@router.patch("/{team_id}")
def update_team(team_id: str, update: TeamUpdate):
    conn = get_connection()
    existing = conn.execute("SELECT * FROM teams WHERE id = ?", (team_id,)).fetchone()
    if existing is None:
        conn.close()
        raise HTTPException(status_code=404, detail="Team not found")

    fields = []
    vals = []
    for key, value in update.dict(exclude_unset=True).items():
        if value is not None:
            if key == 'member_ids':
                fields.append(f"{key} = ?")
                vals.append(json.dumps(value))
            else:
                fields.append(f"{key} = ?")
                vals.append(value)

    if fields:
        fields.append("updated_date = ?")
        vals.append(now())
        vals.append(team_id)
        conn.execute(f"UPDATE teams SET {', '.join(fields)} WHERE id = ?", vals)
        conn.commit()

    row = conn.execute("SELECT * FROM teams WHERE id = ?", (team_id,)).fetchone()
    conn.close()
    return row_to_dict(row)


@router.delete("/{team_id}")
def delete_team(team_id: str):
    conn = get_connection()
    conn.execute("DELETE FROM teams WHERE id = ?", (team_id,))
    conn.commit()
    conn.close()
    return {"success": True}