import json
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from database import fetch, fetch_one, execute, generate_id, now
from auth.dependencies import get_current_user

router = APIRouter(prefix="/api/admin")

# ── Role hierarchy constants ─────────────────────────────────────────────────
ROLE_HIERARCHY = {"owner": 0, "manager": 1, "mod": 2, "user": 3}


def _require_admin_role(user: dict, min_role: str = "mod"):
    """Check if user has at least the specified admin role."""
    user_role = user.get("admin_role", "user")
    if ROLE_HIERARCHY.get(user_role, 3) > ROLE_HIERARCHY.get(min_role, 3):
        raise HTTPException(
            status_code=403,
            detail=f"Requires {min_role} role or higher. Your role: {user_role}",
        )


def _can_manage_user(current_user: dict, target_prefs: dict) -> bool:
    """Check if current_user can modify target's role based on their user_preferences."""
    current_role = current_user.get("admin_role", "user")
    target_role = target_prefs.get("admin_role", "user")

    current_level = ROLE_HIERARCHY.get(current_role, 3)
    target_level = ROLE_HIERARCHY.get(target_role, 3)

    # Can only manage users with strictly lower privilege (higher numeric level)
    return current_level < target_level


# ── Request models ────────────────────────────────────────────────────────────


class RoleUpdateRequest(BaseModel):
    admin_role: str


class VisibilityUpdateRequest(BaseModel):
    admin_visible: bool


# ── Admin endpoints ───────────────────────────────────────────────────────────


@router.get("/users")
async def list_users(
    request: Request,
    user: dict = Depends(get_current_user),
):
    """List all users with their admin roles. Requires mod+ role."""
    _require_admin_role(user, "mod")

    query = """
        SELECT
            cp.created_by as id,
            cp.display_name,
            cp.username,
            cp.email,
            cp.profile_image,
            COALESCE(up.admin_role, 'user') as admin_role,
            COALESCE(up.admin_visible, true) as admin_visible,
            up.assigned_date,
            cp.created_date
        FROM contestant_profiles cp
        LEFT JOIN user_preferences up ON cp.created_by = up.user_id
    """
    params = []
    conditions = []
    idx = 1

    # Filter by role if specified
    role_filter = request.query_params.get("role")
    if role_filter:
        if role_filter == "user":
            conditions.append(f"up.admin_role IS NULL OR up.admin_role = ${idx}")
        else:
            conditions.append(f"up.admin_role = ${idx}")
        params.append(role_filter)
        idx += 1

    # Filter by search term
    search = request.query_params.get("search")
    if search:
        conditions.append(
            f"(cp.email ILIKE ${idx} OR cp.username ILIKE ${idx} OR cp.display_name ILIKE ${idx})"
        )
        params.append(f"%{search}%")
        idx += 1

    if conditions:
        query += " WHERE " + " AND ".join(conditions)

    query += " ORDER BY cp.created_date DESC"
    return await fetch(query, *params)


@router.get("/users/{user_id}")
async def get_user(user_id: str, user: dict = Depends(get_current_user)):
    """Get a specific user's admin details. Requires manager+ role."""
    _require_admin_role(user, "mod")

    target = await fetch_one(
        """
        SELECT
            cp.created_by as id,
            cp.display_name,
            cp.username,
            cp.email,
            cp.profile_image,
            COALESCE(up.admin_role, 'user') as admin_role,
            COALESCE(up.admin_visible, true) as admin_visible,
            up.assigned_date,
            cp.created_date
        FROM contestant_profiles cp
        LEFT JOIN user_preferences up ON cp.created_by = up.user_id
        WHERE cp.created_by = $1
        """,
        user_id,
    )
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    return target


@router.patch("/users/{user_id}/role")
async def update_user_role(
    user_id: str,
    req: RoleUpdateRequest,
    user: dict = Depends(get_current_user),
):
    """Update a user's admin role. Requires mod+ role."""
    _require_admin_role(user, "mod")

    # Validate role
    if req.admin_role not in ROLE_HIERARCHY:
        raise HTTPException(status_code=400, detail="Invalid role")

    # Can't assign owner role
    if req.admin_role == "owner":
        raise HTTPException(status_code=400, detail="Cannot assign owner role")

    # Can't assign a role equal to or higher than your own
    assigner_level = ROLE_HIERARCHY.get(user.get("admin_role", "user"), 3)
    target_level = ROLE_HIERARCHY.get(req.admin_role, 3)
    if target_level <= assigner_level:
        raise HTTPException(status_code=403, detail="Cannot assign a role equal to or higher than your own")

    # Get target's current preferences
    target_prefs = await fetch_one(
        "SELECT admin_role FROM public.user_preferences WHERE user_id = $1", user_id
    )
    # If no preferences row, treat as "user" role
    if target_prefs is None:
        target_prefs = {"admin_role": "user"}

    # Check permission to modify this user
    if not _can_manage_user(user, target_prefs):
        raise HTTPException(
            status_code=403,
            detail="You don't have permission to modify this user's role",
        )

    # Upsert user_preferences with the new role
    existing = await fetch_one(
        "SELECT id FROM public.user_preferences WHERE user_id = $1", user_id
    )

    if existing:
        await execute(
            "UPDATE public.user_preferences SET admin_role = $1, assigned_by = $2, assigned_date = $3, updated_date = $4 WHERE user_id = $5",
            req.admin_role,
            user["id"] if req.admin_role != "user" else None,
            now() if req.admin_role != "user" else None,
            now(),
            user_id,
        )
    elif req.admin_role != "user":
        await execute(
            """INSERT INTO public.user_preferences (id, user_id, admin_role, assigned_by, assigned_date)
               VALUES ($1, $2, $3, $4, $5)""",
            generate_id(),
            user_id,
            req.admin_role,
            user["id"],
            now(),
        )

    # Return updated user info
    updated_prefs = await fetch_one(
        "SELECT admin_role, admin_visible FROM public.user_preferences WHERE user_id = $1",
        user_id,
    )
    return {
        "id": user_id,
        "admin_role": updated_prefs["admin_role"] if updated_prefs else "user",
        "admin_visible": updated_prefs["admin_visible"] if updated_prefs else True,
    }


@router.patch("/users/{user_id}/visibility")
async def update_user_visibility(
    user_id: str,
    req: VisibilityUpdateRequest,
    user: dict = Depends(get_current_user),
):
    """Toggle user visibility in matching algorithms. Requires manager+ role."""
    _require_admin_role(user, "mod")

    # Users can toggle their own visibility
    if user_id == user["id"]:
        existing = await fetch_one(
            "SELECT id FROM public.user_preferences WHERE user_id = $1", user_id
        )
        if existing:
            await execute(
                "UPDATE public.user_preferences SET admin_visible = $1, updated_date = $2 WHERE user_id = $3",
                req.admin_visible,
                now(),
                user_id,
            )
        else:
            await execute(
                """INSERT INTO public.user_preferences (id, user_id, admin_visible)
                   VALUES ($1, $2, $3)""",
                generate_id(),
                user_id,
                req.admin_visible,
            )
        return {"id": user_id, "admin_visible": req.admin_visible}

    # Check permission for other users
    target_prefs = await fetch_one(
        "SELECT admin_role FROM public.user_preferences WHERE user_id = $1", user_id
    )
    if target_prefs is None:
        target_prefs = {"admin_role": "user"}

    if not _can_manage_user(user, target_prefs):
        raise HTTPException(
            status_code=403,
            detail="You don't have permission to modify this user's visibility",
        )

    existing = await fetch_one(
        "SELECT id FROM public.user_preferences WHERE user_id = $1", user_id
    )
    if existing:
        await execute(
            "UPDATE public.user_preferences SET admin_visible = $1, updated_date = $2 WHERE user_id = $3",
            req.admin_visible,
            now(),
            user_id,
        )
    else:
        await execute(
            """INSERT INTO public.user_preferences (id, user_id, admin_visible)
               VALUES ($1, $2, $3)""",
            generate_id(),
            user_id,
            req.admin_visible,
        )

    return {"id": user_id, "admin_visible": req.admin_visible}


@router.get("/roles")
async def get_role_info(user: dict = Depends(get_current_user)):
    """Get role hierarchy info. Requires manager+ role."""
    _require_admin_role(user, "mod")

    return {
        "hierarchy": ROLE_HIERARCHY,
        "roles": [
            {"name": "owner", "description": "Full access, can assign any role", "level": 0},
            {"name": "manager", "description": "Quản lý — can manage giám sát and users", "level": 1},
            {"name": "mod", "description": "Giám sát — can manage users only", "level": 2},
            {"name": "user", "description": "Regular user", "level": 3},
        ],
    }


@router.get("/stats")
async def get_admin_stats(user: dict = Depends(get_current_user)):
    """Get admin dashboard statistics. Requires manager+ role."""
    _require_admin_role(user, "mod")

    total_users = await fetch_one("SELECT COUNT(*) as count FROM contestant_profiles")
    total_admins = await fetch_one(
        "SELECT COUNT(*) as count FROM user_preferences WHERE admin_role != 'user'"
    )
    total_visible = await fetch_one(
        """SELECT COUNT(*) as count FROM contestant_profiles cp
           LEFT JOIN user_preferences up ON cp.created_by = up.user_id
           WHERE COALESCE(up.admin_visible, true) = true"""
    )

    return {
        "total_users": total_users["count"] if total_users else 0,
        "total_admins": total_admins["count"] if total_admins else 0,
        "total_visible": total_visible["count"] if total_visible else 0,
    }


# ── Reports endpoints ─────────────────────────────────────────────────────────


@router.get("/reports")
async def list_reports(user: dict = Depends(get_current_user)):
    """List all user reports with profile info. Requires mod+ role."""
    _require_admin_role(user, "mod")

    return await fetch("""
        SELECT
            r.id,
            r.reporter_id,
            r.reported_id,
            r.match_id,
            r.reason,
            r.created_date,
            reporter.display_name AS reporter_name,
            reporter.profile_image AS reporter_image,
            reporter.email AS reporter_email,
            reported.display_name AS reported_name,
            reported.profile_image AS reported_image,
            reported.email AS reported_email,
            (SELECT COUNT(*) FROM messages WHERE match_id = r.match_id) AS message_count
        FROM public.reports r
        LEFT JOIN public.contestant_profiles reporter ON r.reporter_id = reporter.created_by
        LEFT JOIN public.contestant_profiles reported ON r.reported_id = reported.created_by
        ORDER BY r.created_date DESC
    """)


@router.get("/reports/{report_id}/messages")
async def get_report_messages(report_id: str, user: dict = Depends(get_current_user)):
    """Get messages from the match associated with a report. Requires mod+ role."""
    _require_admin_role(user, "mod")

    report = await fetch_one("SELECT match_id FROM public.reports WHERE id = $1", report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    if not report["match_id"]:
        return []

    return await fetch("""
        SELECT
            m.id,
            m.match_id,
            m.sender_id,
            m.content,
            m.created_date,
            m.attachment_url,
            m.attachment_type,
            m.attachment_name,
            sender.display_name AS sender_name,
            sender.profile_image AS sender_image
        FROM messages m
        LEFT JOIN public.contestant_profiles sender ON m.sender_id = sender.created_by
        WHERE m.match_id = $1
        ORDER BY m.created_date ASC
    """, report["match_id"])


# ── Blocks endpoints ─────────────────────────────────────────────────────────


@router.get("/blocks")
async def list_blocks(user: dict = Depends(get_current_user)):
    """List all blocked users with profile info. Requires mod+ role."""
    _require_admin_role(user, "mod")

    return await fetch("""
        SELECT
            b.id,
            b.blocker_id,
            b.blocked_id,
            b.created_date,
            blocker.display_name AS blocker_name,
            blocker.profile_image AS blocker_image,
            blocker.email AS blocker_email,
            blocked.display_name AS blocked_name,
            blocked.profile_image AS blocked_image,
            blocked.email AS blocked_email
        FROM public.blocked_users b
        LEFT JOIN public.contestant_profiles blocker ON b.blocker_id = blocker.created_by
        LEFT JOIN public.contestant_profiles blocked ON b.blocked_id = blocked.created_by
        ORDER BY b.created_date DESC
    """)


# ── Team management endpoints ───────────────────────────────────────


class AdminTeamUpdateRequest(BaseModel):
    name: Optional[str] = None


class AdminSettingUpdateRequest(BaseModel):
    key: str
    value: bool | int


@router.get("/teams")
async def admin_list_teams(user: dict = Depends(get_current_user)):
    """List all teams with leader profile info. Requires mod+ role."""
    _require_admin_role(user, "mod")

    return await fetch("""
        SELECT
            t.id,
            t.created_date,
            t.updated_date,
            t.name,
            t.leader_id,
            t.member_ids,
            t.max_members,
            t.status,
            t.disband_initiated_by,
            cp.display_name AS leader_name,
            cp.profile_image AS leader_image,
            cp.email AS leader_email,
            COALESCE(
                (SELECT cp2.display_name FROM contestant_profiles cp2
                 WHERE cp2.created_by = t.disband_initiated_by),
                NULL
            ) AS disband_initiator_name
        FROM teams t
        LEFT JOIN contestant_profiles cp ON t.leader_id = cp.created_by
        ORDER BY t.created_date DESC
    """)


@router.patch("/teams/{team_id}")
async def admin_update_team(
    team_id: str,
    req: AdminTeamUpdateRequest,
    user: dict = Depends(get_current_user),
):
    """Admin update a team (e.g. rename). Requires mod+ role."""
    _require_admin_role(user, "mod")

    existing = await fetch_one("SELECT * FROM teams WHERE id = $1", team_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Team not found")

    fields = []
    vals = []
    idx = 1
    if req.name is not None:
        fields.append(f"name = ${idx}")
        vals.append(req.name)
        idx += 1

    if fields:
        fields.append(f"updated_date = ${idx}")
        vals.append(now())
        idx += 1
        vals.append(team_id)
        await execute(f"UPDATE teams SET {', '.join(fields)} WHERE id = ${idx}", *vals)

    return await fetch_one("SELECT * FROM teams WHERE id = $1", team_id)


@router.delete("/teams/{team_id}")
async def admin_delete_team(team_id: str, user: dict = Depends(get_current_user)):
    """Admin delete any team (skips consent flow). Requires mod+ role."""
    _require_admin_role(user, "mod")

    existing = await fetch_one("SELECT * FROM teams WHERE id = $1", team_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Team not found")

    await execute("DELETE FROM teams WHERE id = $1", team_id)
    return {"success": True}


# ── Settings endpoints ──────────────────────────────────────────────


@router.get("/settings")
async def admin_get_settings(user: dict = Depends(get_current_user)):
    """Get all system settings. Requires mod+ role."""
    _require_admin_role(user, "mod")

    rows = await fetch("SELECT key, value FROM system_settings ORDER BY key")
    settings = {}
    for row in rows:
        settings[row["key"]] = row["value"]
    return settings


@router.patch("/settings")
async def admin_update_setting(
    req: AdminSettingUpdateRequest,
    user: dict = Depends(get_current_user),
):
    """Update a system setting. Requires mod+ role."""
    _require_admin_role(user, "mod")

    await execute(
        """
        INSERT INTO system_settings (key, value, updated_date)
        VALUES ($1, $2::jsonb, $3)
        ON CONFLICT (key) DO UPDATE SET value = $2::jsonb, updated_date = $3
        """,
        req.key,
        json.dumps(req.value),
        now(),
    )
    return {"key": req.key, "value": req.value}
