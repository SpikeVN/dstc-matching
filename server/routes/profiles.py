import json
from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel
from typing import Optional
from database import fetch, fetch_one, execute, generate_id, now
from auth.dependencies import get_current_user

router = APIRouter(prefix="/api")


class InfoShownUpdate(BaseModel):
    info_shown: dict


@router.patch("/user-preferences/info-shown")
async def update_info_shown(update: InfoShownUpdate, user: dict = Depends(get_current_user)):
    """Save the current user's privacy info_shown settings."""
    existing = await fetch_one(
        "SELECT id FROM public.user_preferences WHERE user_id = $1", user["id"]
    )
    if existing:
        await execute(
            "UPDATE public.user_preferences SET info_shown = $1::jsonb, updated_date = $2 WHERE user_id = $3",
            json.dumps(update.info_shown), now(), user["id"],
        )
    else:
        await execute(
            """INSERT INTO public.user_preferences (id, user_id, info_shown)
               VALUES ($1, $2, $3::jsonb)""",
            generate_id(), user["id"], json.dumps(update.info_shown),
        )
    return {"info_shown": update.info_shown}


@router.post("/user-preferences/accept-terms")
async def accept_terms(user: dict = Depends(get_current_user)):
    """Record that the user has accepted the terms and conditions."""
    existing = await fetch_one(
        "SELECT id FROM public.user_preferences WHERE user_id = $1", user["id"]
    )
    if existing:
        await execute(
            "UPDATE public.user_preferences SET terms_accepted = true, updated_date = $1 WHERE user_id = $2",
            now(), user["id"],
        )
    else:
        await execute(
            """INSERT INTO public.user_preferences (id, user_id, terms_accepted)
               VALUES ($1, $2, true)""",
            generate_id(), user["id"],
        )
    return {"terms_accepted": True}


# ── User search ─────────────────────────────────────────────────


@router.get("/users/search")
async def search_users(request: Request, user: dict = Depends(get_current_user)):
    """Search for users by email. Excludes self, existing matches, and blocked users.
    Requires minimum 3 characters in query."""
    q = request.query_params.get("q", "").strip()
    if len(q) < 3:
        return []

    return await fetch("""
        SELECT cp.created_by as id, cp.email, cp.display_name, cp.role, cp.username, cp.profile_image
        FROM contestant_profiles cp
        WHERE cp.email ILIKE $1
          AND cp.created_by != $2
          AND cp.created_by NOT IN (
              SELECT CASE WHEN user1_id = $2 THEN user2_id ELSE user1_id END
              FROM matches
              WHERE (user1_id = $2 OR user2_id = $2)
          )
          AND cp.created_by NOT IN (
              SELECT blocked_id FROM blocked_users WHERE blocker_id = $2
          )
        ORDER BY cp.email
        LIMIT 10
    """, f"%{q}%", user["id"])


# ── Contestant profiles ──────────────────────────────────────────────

# ── Info shown field mapping ─────────────────────────────────────────────
# Maps info_shown keys to contestant_profiles fields
# When a key is False, the corresponding fields are stripped from the response
INFO_SHOWN_MAP = {
    "show_age": ("birth_year",),
    "show_gender": ("gender",),
    "show_location": ("city",),
    "show_school": ("school",),
    "show_major": ("major",),
    "show_achievements": ("achievements", "achievements_other"),
}


def _strip_hidden_fields(profile: dict, info_shown: dict | None) -> dict:
    """Remove profile fields that the user has hidden via info_shown.

    Merges with defaults (all visible) so missing keys don't break anything.
    """
    if not info_shown:
        return profile  # No preferences row — all fields visible

    defaults = {k: True for k in INFO_SHOWN_MAP}
    merged = {**defaults, **info_shown}

    for key, shown in merged.items():
        if not shown:
            for field in INFO_SHOWN_MAP.get(key, ()):
                profile.pop(field, None)

    return profile



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
    social_links: dict = {}


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
    social_links: Optional[dict] = None


@router.get("/contestant-profiles")
async def list_profiles(request: Request, user: dict = Depends(get_current_user)):
    query = """
        SELECT cp.*,
               COALESCE(up.admin_visible, true) as admin_visible,
               up.info_shown
        FROM contestant_profiles cp
        LEFT JOIN user_preferences up ON cp.created_by = up.user_id
        WHERE COALESCE(up.admin_visible, true) = true
    """
    params = []
    conditions = []
    idx = 1

    for key in request.query_params:
        if key in ('created_by', 'team_id', 'role', 'gender', 'experience', 'display_name', 'username'):
            conditions.append(f"cp.{key} = ${idx}")
            params.append(request.query_params[key])
            idx += 1

    if conditions:
        query += " AND " + " AND ".join(conditions)

    query += " ORDER BY cp.created_date DESC"
    rows = await fetch(query, *params)
    # Strip hidden fields per each profile owner's info_shown settings
    return [_strip_hidden_fields(r, r.pop("info_shown", None)) for r in rows]


@router.get("/contestant-profiles/{profile_id}")
async def get_profile(profile_id: str, user: dict = Depends(get_current_user)):
    row = await fetch_one(
        """SELECT cp.*, up.info_shown
           FROM contestant_profiles cp
           LEFT JOIN user_preferences up ON cp.created_by = up.user_id
           WHERE cp.id = $1""",
        profile_id,
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Profile not found")
    return _strip_hidden_fields(row, row.pop("info_shown", None))


@router.post("/contestant-profiles")
async def create_profile(profile: ProfileCreate, user: dict = Depends(get_current_user)):
    pid = generate_id()
    now_ts = now()
    await execute("""
        INSERT INTO contestant_profiles
        (id, created_by, created_date, updated_date, display_name, username, bio, birth_year,
         gender, city, school, major, profile_image, cv_url, technical_skills, soft_skills,
         experience, goals, role, achievements, achievements_other, has_team, team_id, profile_complete,
         social_links)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
    """,
        pid, user["id"], now_ts, now_ts, profile.display_name, profile.username,
        profile.bio, profile.birth_year, profile.gender, profile.city, profile.school,
        profile.major, profile.profile_image, profile.cv_url,
        json.dumps(profile.technical_skills), json.dumps(profile.soft_skills),
        profile.experience, json.dumps(profile.goals), profile.role,
        profile.achievements, profile.achievements_other,
        profile.has_team, profile.team_id, profile.profile_complete,
        json.dumps(profile.social_links)
    )
    return await fetch_one("SELECT * FROM contestant_profiles WHERE id = $1", pid)


@router.patch("/contestant-profiles/{profile_id}")
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
        if value is not None or key in ('team_id',):
            if key in ('technical_skills', 'soft_skills', 'goals', 'social_links'):
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


@router.delete("/contestant-profiles/{profile_id}")
async def delete_profile(profile_id: str, user: dict = Depends(get_current_user)):
    existing = await fetch_one("SELECT * FROM contestant_profiles WHERE id = $1", profile_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Profile not found")
    if existing["created_by"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized to delete this profile")
    await execute("DELETE FROM contestant_profiles WHERE id = $1", profile_id)
    return {"success": True}


@router.patch("/contestant-profiles/{profile_id}/visit")
async def mark_profile_visited(profile_id: str, user: dict = Depends(get_current_user)):
    """Mark a profile as visited (visited_profile = true).

    Called when the user opens the Profile page for the first time.
    Discover uses this to prompt users who haven't visited their profile yet.
    """
    existing = await fetch_one("SELECT * FROM contestant_profiles WHERE id = $1", profile_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Profile not found")
    if existing["created_by"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized to update this profile")

    await execute(
        "UPDATE contestant_profiles SET visited_profile = true, updated_date = $1 WHERE id = $2",
        now(),
        profile_id,
    )
    return {"success": True}
