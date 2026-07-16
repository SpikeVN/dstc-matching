import json
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from database import get_connection, row_to_dict, rows_to_list, generate_id, now

router = APIRouter(prefix="/api/contestant-profiles")


class ProfileCreate(BaseModel):
    created_by: str
    display_name: str = ""
    username: str = ""
    bio: str = ""
    birth_year: Optional[int] = None
    gender: str = ""
    city: str = ""
    school: str = ""
    major: str = ""
    profile_image: str = ""
    technical_skills: list = []
    soft_skills: list = []
    experience: str = ""
    goals: list = []
    role: str = ""
    achievements: str = ""
    achievements_other: str = ""
    has_team: bool = False
    team_id: str = ""
    profile_complete: bool = False


class ProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    username: Optional[str] = None
    bio: Optional[str] = None
    birth_year: Optional[int] = None
    gender: Optional[str] = None
    city: Optional[str] = None
    school: Optional[str] = None
    major: Optional[str] = None
    profile_image: Optional[str] = None
    technical_skills: Optional[list] = None
    soft_skills: Optional[list] = None
    experience: Optional[str] = None
    goals: Optional[list] = None
    role: Optional[str] = None
    achievements: Optional[str] = None
    achievements_other: Optional[str] = None
    has_team: Optional[bool] = None
    team_id: Optional[str] = None
    profile_complete: Optional[bool] = None


@router.get("")
def list_profiles(request: Request):
    conn = get_connection()
    query = "SELECT * FROM contestant_profiles"
    params = []
    conditions = []

    for key in request.query_params:
        if key in ('created_by', 'team_id', 'role', 'gender', 'experience', 'display_name', 'username'):
            conditions.append(f"{key} = ?")
            params.append(request.query_params[key])

    if conditions:
        query += " WHERE " + " AND ".join(conditions)

    query += " ORDER BY created_date DESC"
    rows = conn.execute(query, params).fetchall()
    conn.close()
    return rows_to_list(rows)


@router.get("/{profile_id}")
def get_profile(profile_id: str):
    conn = get_connection()
    row = conn.execute("SELECT * FROM contestant_profiles WHERE id = ?", (profile_id,)).fetchone()
    conn.close()
    if row is None:
        raise HTTPException(status_code=404, detail="Profile not found")
    return row_to_dict(row)


@router.post("")
def create_profile(profile: ProfileCreate):
    conn = get_connection()
    pid = generate_id()
    now_ts = now()
    conn.execute("""
        INSERT INTO contestant_profiles
        (id, created_by, created_date, updated_date, display_name, username, bio, birth_year,
         gender, city, school, major, profile_image, technical_skills, soft_skills,
         experience, goals, role, achievements, achievements_other, has_team, team_id, profile_complete)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        pid, profile.created_by, now_ts, now_ts, profile.display_name, profile.username,
        profile.bio, profile.birth_year, profile.gender, profile.city, profile.school,
        profile.major, profile.profile_image,
        json.dumps(profile.technical_skills), json.dumps(profile.soft_skills),
        profile.experience, json.dumps(profile.goals), profile.role,
        profile.achievements, profile.achievements_other,
        int(profile.has_team), profile.team_id, int(profile.profile_complete)
    ))
    conn.commit()
    row = conn.execute("SELECT * FROM contestant_profiles WHERE id = ?", (pid,)).fetchone()
    conn.close()
    return row_to_dict(row)


@router.patch("/{profile_id}")
def update_profile(profile_id: str, update: ProfileUpdate):
    conn = get_connection()
    existing = conn.execute("SELECT * FROM contestant_profiles WHERE id = ?", (profile_id,)).fetchone()
    if existing is None:
        conn.close()
        raise HTTPException(status_code=404, detail="Profile not found")

    fields = []
    vals = []
    for key, value in update.dict(exclude_unset=True).items():
        if value is not None:
            if key in ('technical_skills', 'soft_skills', 'goals'):
                fields.append(f"{key} = ?")
                vals.append(json.dumps(value))
            elif key in ('has_team', 'profile_complete'):
                fields.append(f"{key} = ?")
                vals.append(int(value))
            else:
                fields.append(f"{key} = ?")
                vals.append(value)

    if fields:
        fields.append("updated_date = ?")
        vals.append(now())
        vals.append(profile_id)
        conn.execute(f"UPDATE contestant_profiles SET {', '.join(fields)} WHERE id = ?", vals)
        conn.commit()

    row = conn.execute("SELECT * FROM contestant_profiles WHERE id = ?", (profile_id,)).fetchone()
    conn.close()
    return row_to_dict(row)


@router.delete("/{profile_id}")
def delete_profile(profile_id: str):
    conn = get_connection()
    conn.execute("DELETE FROM contestant_profiles WHERE id = ?", (profile_id,))
    conn.commit()
    conn.close()
    return {"success": True}