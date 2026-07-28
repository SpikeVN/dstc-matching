"""
GET /api/recommendations — server-side match recommendations.

Fetches the caller's profile, remaining candidates (excluding liked AND
passed profiles by default), scores them with matching.py, and returns
the ranked list.  Pass ?include_passed=true to skip pass exclusion so
the frontend can restart the round.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from auth.dependencies import get_current_user
from database import fetch, fetch_one
from matching import ProfileData, score

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
    request: Request,
    n: int = Query(default=999, ge=1, le=999),
    user: dict = Depends(get_current_user),
):
    """Return scored recommendations for the authenticated user.

    Only profiles the user has *liked* are excluded — passed profiles remain
    eligible so the frontend can loop back when the round is exhausted.
    Optional query-param filters are forwarded from the Discover page.
    """

    # 1. Caller's own profile
    my_row = await fetch_one(
        "SELECT * FROM contestant_profiles WHERE created_by = $1",
        user["id"],
    )
    if not my_row:
        raise HTTPException(status_code=404, detail="No profile found")
    me = _row_to_profile(my_row)

    # 2. People the user already swiped on.
    # By default both likes and passes are excluded so passed profiles don't
    # reappear mid-round.  ?include_passed=true skips pass exclusion so the
    # frontend can restart the round with a clean slate.
    include_passed = request.query_params.get("include_passed", "").lower() in ("true", "1")
    if include_passed:
        swiped_rows = await fetch(
            "SELECT swiped_id FROM swipe_actions WHERE swiper_id = $1 AND action = 'like'",
            user["id"],
        )
    else:
        swiped_rows = await fetch(
            "SELECT swiped_id FROM swipe_actions WHERE swiper_id = $1",
            user["id"],
        )
    excluded_ids = {r["swiped_id"] for r in swiped_rows}

    # 3. Blocked users (mutual)
    blocked_rows = await fetch(
        """SELECT blocker_id, blocked_id FROM public.blocked_users
           WHERE blocker_id = $1 OR blocked_id = $1""",
        user["id"],
    )
    blocked_ids = set()
    for b in blocked_rows:
        blocked_ids.add(b["blocker_id"])
        blocked_ids.add(b["blocked_id"])

    # 4. Build the candidate query with filters
    query = (
        "SELECT * FROM contestant_profiles"
        " WHERE created_by != $1 AND display_name != ''"
    )
    params = [user["id"]]
    idx = 2

    # Exclude already-swiped profiles (both likes and passes, unless include_passed)
    if excluded_ids:
        placeholders = ", ".join(f"${i}" for i in range(idx, idx + len(excluded_ids)))
        query += f" AND created_by NOT IN ({placeholders})"
        params.extend(excluded_ids)
        idx += len(excluded_ids)

    # Exclude blocked users
    if blocked_ids:
        placeholders = ", ".join(f"${i}" for i in range(idx, idx + len(blocked_ids)))
        query += f" AND created_by NOT IN ({placeholders})"
        params.extend(blocked_ids)
        idx += len(blocked_ids)

    # Optional single-value filters
    for field in ("role", "experience"):
        values = request.query_params.getlist(field)
        if values:
            placeholders = ", ".join(f"${i}" for i in range(idx, idx + len(values)))
            query += f" AND {field} IN ({placeholders})"
            params.extend(values)
            idx += len(values)

    # City filter (partial / prefix matching, plus "khác" = exclusion)
    cities = request.query_params.getlist("city")
    if cities:
        clauses = []
        for c in cities:
            normalized = c.strip().lower()
            if normalized in ("tỉnh/thành phố khác", "khác"):
                clauses.append(
                    "LOWER(city) NOT LIKE '%hà nội%'"
                    " AND LOWER(city) NOT LIKE '%hồ chí minh%'"
                )
            else:
                clauses.append(f"LOWER(city) LIKE ${idx}")
                params.append(f"%{normalized}%")
                idx += 1
        query += " AND (" + " OR ".join(clauses) + ")"

    # JSONB array-containment filters (?| checks if any array element matches)
    for field, qp in (
        ("technical_skills", "technical_skill"),
        ("soft_skills", "soft_skill"),
        ("goals", "goal"),
    ):
        values = request.query_params.getlist(qp)
        if values:
            query += f" AND {field} ?| ${idx}::text[]"
            params.append(values)
            idx += 1

    all_rows = await fetch(query, *params)

    # 5. Score every eligible candidate
    scored = [(score(me, _row_to_profile(r)), r) for r in all_rows]
    scored.sort(key=lambda x: -x[0])

    # 6. Return top-n
    top = scored[:n]
    return {
        "recommendations": [
            {
                "id": r["id"],
                "created_by": r["created_by"],
                "display_name": r["display_name"],
                "role": r["role"],
                "technical_skills": r["technical_skills"],
                "soft_skills": r["soft_skills"],
                "goals": r["goals"],
                "experience": r["experience"],
                "school": r["school"],
                "major": r.get("major", ""),
                "city": r["city"],
                "bio": r["bio"],
                "gender": r.get("gender", ""),
                "birth_year": r.get("birth_year"),
                "profile_image": r.get("profile_image", ""),
                "achievements": r.get("achievements", ""),
                "achievements_other": r.get("achievements_other", ""),
                "cv_url": r.get("cv_url", ""),
                "social_links": r.get("social_links", {}),
            }
            for _, r in top
        ],
        "total_remaining": len(all_rows),
    }
