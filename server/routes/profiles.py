import json
from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel
from typing import Optional
from database import fetch, fetch_one, execute, generate_id, now
from auth.dependencies import get_current_user

router = APIRouter(prefix="/api/contestant-profiles")


class ProfileCreate(BaseModel):
    display_name: str = ""
    username: str = ""
    bio: str = ""
    birth_year: Optional[int] = None
    gender: str = ""
    city: str = ""
    school: str = ""
    major: str = ""
    profile_image: str = ""
    cv_url: str = ""
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
    cv_url: Optional[str] = None
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
async def list_profiles(request: Request):
    query = "SELECT * FROM contestant_profiles"
    params = []
    conditions = []
    idx = 1

    for key in request.query_params:
        if key in ('created_by', 'team_id', 'role', 'gender', 'experience', 'display_name', 'username'):
            conditions.append(f"{key} = ${idx}")
            params.append(request.query_params[key])
            idx += 1

    if conditions:
        query += " WHERE " + " AND ".join(conditions)

    query += " ORDER BY created_date DESC"
    return await fetch(query, *params)


@router.get("/{profile_id}")
async def get_profile(profile_id: str):
    row = await fetch_one("SELECT * FROM contestant_profiles WHERE id = $1", profile_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Profile not found")
    return row


@router.post("")
async def create_profile(profile: ProfileCreate, user: dict = Depends(get_current_user)):
    pid = generate_id()
    now_ts = now()
    await execute("""
        INSERT INTO contestant_profiles
        (id, created_by, created_date, updated_date, display_name, username, bio, birth_year,
         gender, city, school, major, profile_image, cv_url, technical_skills, soft_skills,
         experience, goals, role, achievements, achievements_other, has_team, team_id, profile_complete)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
    """,
        pid, user["id"], now_ts, now_ts, profile.display_name, profile.username,
        profile.bio, profile.birth_year, profile.gender, profile.city, profile.school,
        profile.major, profile.profile_image, profile.cv_url,
        json.dumps(profile.technical_skills), json.dumps(profile.soft_skills),
        profile.experience, json.dumps(profile.goals), profile.role,
        profile.achievements, profile.achievements_other,
        profile.has_team, profile.team_id, profile.profile_complete
    )
    return await fetch_one("SELECT * FROM contestant_profiles WHERE id = $1", pid)


@router.patch("/{profile_id}")
async def update_profile(profile_id: str, update: ProfileUpdate, user: dict = Depends(get_current_user)):
    existing = await fetch_one("SELECT * FROM contestant_profiles WHERE id = $1", profile_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Profile not found")
    if existing["created_by"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized to update this profile")

    fields = []
    vals = []
    idx = 1
    for key, value in update.model_dump(exclude_unset=True).items():
        if value is not None:
            if key in ('technical_skills', 'soft_skills', 'goals'):
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
        vals.append(profile_id)
        await execute(f"UPDATE contestant_profiles SET {', '.join(fields)} WHERE id = ${idx}", *vals)

    return await fetch_one("SELECT * FROM contestant_profiles WHERE id = $1", profile_id)


@router.delete("/{profile_id}")
async def delete_profile(profile_id: str, user: dict = Depends(get_current_user)):
    existing = await fetch_one("SELECT * FROM contestant_profiles WHERE id = $1", profile_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Profile not found")
    if existing["created_by"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized to delete this profile")
    await execute("DELETE FROM contestant_profiles WHERE id = $1", profile_id)
    return {"success": True}
