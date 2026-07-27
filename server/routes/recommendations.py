"""
GET /api/recommendations — server-side match recommendations.

Fetches the caller's profile, remaining candidates (not yet swiped), and
matched profiles, then delegates to matching.match_recommend().
"""

from fastapi import APIRouter, Depends, HTTPException, Query

from auth.dependencies import get_current_user
from database import fetch, fetch_one
from matching import ProfileData, match_recommend

router = APIRouter(prefix="/api/recommendations")


def _row_to_profile(row: dict) -> ProfileData:
    """Convert a DB row dict to a ProfileData instance."""
    return ProfileData(
        id=row["id"],
        display_name=row.get("display_name", ""),
        bio=row.get("bio", ""),
        gender=row.get("gender", ""),
        city=row.get("city", ""),
        school=row.get("school", ""),
        major=row.get("major", ""),
        technical_skills=row.get("technical_skills") or [],
        soft_skills=row.get("soft_skills") or [],
        experience=row.get("experience", ""),
        goals=row.get("goals") or [],
        role=row.get("role", ""),
        achievements=row.get("achievements", ""),
    )


@router.get("")
async def get_recommendations(
    n: int = Query(default=10, ge=1, le=50),
    user: dict = Depends(get_current_user),
):
    """Return top-n recommended profiles for the authenticated user."""

    # 1. Caller's own profile
    my_row = await fetch_one(
        "SELECT * FROM contestant_profiles WHERE created_by = $1",
        user["id"],
    )
    if not my_row:
        raise HTTPException(status_code=404, detail="No profile found")
    me = _row_to_profile(my_row)

    # 2. People the user already swiped on (like or pass)
    swiped_rows = await fetch(
        "SELECT swiped_id FROM swipe_actions WHERE swiper_id = $1",
        user["id"],
    )
    swiped_ids = {r["swiped_id"] for r in swiped_rows}

    # 2b. Users who blocked the current user, or whom the current user blocked
    blocked_rows = await fetch(
        "SELECT blocker_id, blocked_id FROM public.blocked_users WHERE blocker_id = $1 OR blocked_id = $1",
        user["id"],
    )
    blocked_ids = set()
    for b in blocked_rows:
        blocked_ids.add(b["blocker_id"])
        blocked_ids.add(b["blocked_id"])

    # 3. Remaining candidates: everyone except self + already-swiped + blocked
    all_rows = await fetch(
        "SELECT * FROM contestant_profiles WHERE created_by != $1 AND display_name != ''",
        user["id"],
    )
    remaining = [
        _row_to_profile(r) for r in all_rows
        if r["created_by"] not in swiped_ids and r["created_by"] not in blocked_ids
    ]

    # 4. Matched profiles (for future算法 use)
    match_rows = await fetch(
        """SELECT * FROM matches
           WHERE (user1_id = $1 OR user2_id = $1) AND status = 'matched'""",
        user["id"],
    )
    matched_ids = set()
    for m in match_rows:
        other = m["user2_id"] if m["user1_id"] == user["id"] else m["user1_id"]
        matched_ids.add(other)

    matched = [_row_to_profile(r) for r in all_rows if r["created_by"] in matched_ids]

    # 5. Run the matching algorithm
    results = match_recommend(me, remaining, matched, n=n)

    # Build a lookup for profile_image (avoids N+1 queries)
    image_lookup = {r["id"]: r.get("profile_image", "") for r in all_rows}

    return {
        "recommendations": [
            {
                "id": p.id,
                "display_name": p.display_name,
                "role": p.role,
                "technical_skills": p.technical_skills,
                "soft_skills": p.soft_skills,
                "goals": p.goals,
                "experience": p.experience,
                "school": p.school,
                "city": p.city,
                "bio": p.bio,
                "gender": p.gender,
                "profile_image": image_lookup.get(p.id, ""),
            }
            for p in results
        ],
        "total_remaining": len(remaining),
    }
