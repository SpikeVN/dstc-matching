import json
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from database import fetch, fetch_one, execute, generate_id, now
from auth.dependencies import get_current_user
from auth.gotrue import admin_delete_user
from auth.whitelist import is_email_whitelisted, get_all_whitelisted_emails

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
    """Toggle user visibility in matching algorithms.

    Any user can toggle their own visibility. Editing others requires mod+ role
    and appropriate privilege level.
    """
    # Users can toggle their own visibility regardless of role
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

    _require_admin_role(user, "mod")

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


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    user: dict = Depends(get_current_user),
):
    """Delete a user from auth and all related data. Requires manager+ role.

    Cleans up:
      - Removes user from all team member_ids arrays
      - Deletes solo teams (only member was the deleted user)
      - Deletes the GoTrue auth record (FK cascades handle contestant_profiles,
        matches, messages, swipe_actions, leader-owned teams, team_invites,
        blocked_users, reports, notifications, user_preferences)
    """
    _require_admin_role(user, "manager")

    # Cannot delete yourself
    if user_id == user["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")

    # Check target user exists
    target = await fetch_one(
        "SELECT created_by FROM contestant_profiles WHERE created_by = $1", user_id
    )
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    # Check permission: can only delete users with lower privilege
    target_prefs = await fetch_one(
        "SELECT admin_role FROM public.user_preferences WHERE user_id = $1", user_id
    )
    if target_prefs is None:
        target_prefs = {"admin_role": "user"}

    if not _can_manage_user(user, target_prefs):
        raise HTTPException(
            status_code=403,
            detail="You don't have permission to delete this user",
        )

    # ── Team cleanup (JSONB member_ids is not a FK, so no cascade) ─────────

    # 1. Remove the user from all team member_ids arrays
    await execute(
        """UPDATE public.teams
           SET member_ids = COALESCE(
               (SELECT jsonb_agg(elem)
                  FROM jsonb_array_elements(member_ids) elem
                 WHERE elem <> to_jsonb($1::text)),
               '[]'::jsonb
           )
           WHERE member_ids @> to_jsonb($1::text)::jsonb""",
        user_id,
    )

    # 2. Delete teams that ended up with no members (the deleted user was
    #    the only one in member_ids, and the leader deletion cascade will
    #    handle teams where the deleted user was the leader)
    await execute(
        "DELETE FROM public.teams WHERE member_ids = '[]'::jsonb AND leader_id != $1",
        user_id,
    )

    # 3. Clear disband_initiated_by references (FK ON DELETE SET NULL handles
    #    this via the GoTrue cascade, but do it now so there's no FK worry
    #    about the GoTrue call failing)
    await execute(
        "UPDATE public.teams SET disband_initiated_by = NULL WHERE disband_initiated_by = $1",
        user_id,
    )

    # ── Delete from GoTrue auth ────────────────────────────────────────────
    # This removes the row from auth.users, which cascades via FK to:
    #   contestant_profiles, matches, messages, swipe_actions, teams (where
    #   leader), team_invites, blocked_users, reports, notifications,
    #   user_preferences, and SET NULL on email_whitelist.added_by.
    try:
        await admin_delete_user(user_id)
    except HTTPException as exc:
        # If the GoTrue auth record is already gone, our app-side cleanup
        # (team member_ids, etc.) is still valid — treat as success.
        if exc.status_code == 404 and "not found" in exc.detail.lower():
            print(f"[admin.delete_user] GoTrue user {user_id} already deleted — skipping auth deletion")
        else:
            raise

    return {"success": True, "message": f"User {user_id} deleted"}


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
            r.attachment_url,
            r.attachment_name,
            r.attachment_type,
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


# ── Swipe history endpoint ────────────────────────────────────────────────────


@router.get("/users/{user_id}/swipes")
async def get_user_swipe_history(
    user_id: str,
    request: Request,
    user: dict = Depends(get_current_user),
):
    """Get all swipe actions for a user (as swiper or swiped). Requires mod+ role."""
    _require_admin_role(user, "mod")

    search = request.query_params.get("search", "")
    action_filter = request.query_params.get("action", "")

    query = """
        SELECT
            sa.id,
            sa.created_date,
            sa.updated_date,
            sa.swiper_id,
            sa.swiped_id,
            sa.action,
            sa.is_match,
            swiper.display_name AS swiper_name,
            swiper.profile_image AS swiper_image,
            swiper.email AS swiper_email,
            swiped.display_name AS swiped_name,
            swiped.profile_image AS swiped_image,
            swiped.email AS swiped_email
        FROM swipe_actions sa
        LEFT JOIN contestant_profiles swiper ON sa.swiper_id = swiper.created_by
        LEFT JOIN contestant_profiles swiped ON sa.swiped_id = swiped.created_by
        WHERE (sa.swiper_id = $1 OR sa.swiped_id = $1)
    """
    params = [user_id]
    idx = 2

    if action_filter and action_filter in ("like", "pass"):
        query += f" AND sa.action = ${idx}"
        params.append(action_filter)
        idx += 1

    if search:
        query += f""" AND (
            swiper.display_name ILIKE ${idx}
            OR swiped.display_name ILIKE ${idx}
            OR swiper.email ILIKE ${idx}
            OR swiped.email ILIKE ${idx}
        )"""
        params.append(f"%{search}%")
        idx += 1

    query += " ORDER BY sa.created_date DESC"

    # Optional limit (default 500)
    limit = request.query_params.get("limit", "500")
    try:
        limit_val = int(limit)
    except ValueError:
        limit_val = 500
    query += f" LIMIT ${idx}"
    params.append(limit_val)

    return await fetch(query, *params)


@router.delete("/users/{user_id}/swipes/passes")
async def clear_user_passes(
    user_id: str,
    user: dict = Depends(get_current_user),
):
    """Delete all 'pass' swipe actions made by a user. Requires mod+ role.

    This lets an admin reset who the user has passed on, so those profiles
    reappear in the user's discovery feed.
    """
    _require_admin_role(user, "mod")

    # Check target user exists
    target = await fetch_one(
        "SELECT created_by FROM contestant_profiles WHERE created_by = $1", user_id
    )
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    await execute(
        "DELETE FROM swipe_actions WHERE swiper_id = $1 AND action = 'pass'",
        user_id,
    )

    # Also invalidate the recommendations query cache hint by updating
    # the user's profile updated_date (prevents stale cache issues)
    await execute(
        "UPDATE contestant_profiles SET updated_date = $1 WHERE created_by = $2",
        now(),
        user_id,
    )

    return {"success": True, "message": f"Cleared pass swipes for user {user_id}"}


@router.delete("/users/{user_id}/swipes/{swipe_id}")
async def delete_user_swipe(
    user_id: str,
    swipe_id: str,
    user: dict = Depends(get_current_user),
):
    """Delete a single swipe action for a user. Requires mod+ role.

    Unlike role/visibility changes, swipe deletion doesn't modify the user's
    account — the hierarchy check is not needed here. mod+ can delete any swipe.
    """
    _require_admin_role(user, "mod")

    # Verify the swipe exists and belongs to this user
    swipe = await fetch_one(
        "SELECT * FROM swipe_actions WHERE id = $1 AND swiper_id = $2",
        swipe_id,
        user_id,
    )
    if not swipe:
        raise HTTPException(status_code=404, detail="Swipe action not found")

    await execute("DELETE FROM swipe_actions WHERE id = $1", swipe_id)
    return {"success": True, "message": f"Swipe {swipe_id} deleted"}


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
    name: str | None = None


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
    """Update a system setting. Requires manager+ role."""
    _require_admin_role(user, "manager")

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


# ── Whitelist endpoints ──────────────────────────────────────────────


class WhitelistAddRequest(BaseModel):
    email: str


class WhitelistBulkAddRequest(BaseModel):
    emails: list[str]


@router.get("/whitelist")
async def list_whitelist(
    request: Request,
    user: dict = Depends(get_current_user),
):
    """List all whitelisted emails. Requires mod+ role."""
    _require_admin_role(user, "mod")

    search = request.query_params.get("search", "")
    return await get_all_whitelisted_emails(search)


@router.post("/whitelist")
async def add_whitelist_email(
    req: WhitelistAddRequest,
    user: dict = Depends(get_current_user),
):
    """Add a single email to the whitelist. Requires manager+ role."""
    _require_admin_role(user, "manager")

    email = req.email.strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Invalid email address")

    # Check for duplicates
    existing = await fetch_one(
        "SELECT id FROM public.email_whitelist WHERE LOWER(email) = LOWER($1)", email
    )
    if existing:
        raise HTTPException(status_code=409, detail="Email already in whitelist")

    new_id = generate_id()
    await execute(
        "INSERT INTO public.email_whitelist (id, email, added_by) VALUES ($1, $2, $3)",
        new_id,
        email,
        user["id"],
    )

    return await fetch_one(
        "SELECT id, email, created_date FROM public.email_whitelist WHERE id = $1",
        new_id,
    )


@router.post("/whitelist/bulk")
async def bulk_add_whitelist(
    req: WhitelistBulkAddRequest,
    user: dict = Depends(get_current_user),
):
    """Bulk add emails to the whitelist. Requires manager+ role."""
    _require_admin_role(user, "manager")

    added = 0
    skipped = 0
    errors = []

    for raw_email in req.emails:
        email = raw_email.strip().lower()
        if not email or "@" not in email:
            errors.append(f"Invalid email: {raw_email}")
            continue

        existing = await fetch_one(
            "SELECT 1 FROM public.email_whitelist WHERE LOWER(email) = LOWER($1)", email
        )
        if existing:
            skipped += 1
            continue

        try:
            await execute(
                "INSERT INTO public.email_whitelist (id, email, added_by) VALUES ($1, $2, $3)",
                generate_id(),
                email,
                user["id"],
            )
            added += 1
        except Exception as exc:
            errors.append(f"Failed to add {email}: {str(exc)}")

    return {"added": added, "skipped": skipped, "errors": errors}


@router.delete("/whitelist/{entry_id}")
async def remove_whitelist_email(
    entry_id: str,
    user: dict = Depends(get_current_user),
):
    """Remove a single email from the whitelist by entry UUID. Requires manager+ role."""
    _require_admin_role(user, "manager")

    existing = await fetch_one(
        "SELECT id, email FROM public.email_whitelist WHERE id = $1", entry_id
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Whitelist entry not found")

    await execute("DELETE FROM public.email_whitelist WHERE id = $1", entry_id)
    return {"success": True, "email": existing["email"]}


@router.delete("/whitelist")
async def clear_whitelist(user: dict = Depends(get_current_user)):
    """Remove ALL emails from the whitelist. Requires manager+ role."""
    _require_admin_role(user, "manager")

    await execute("DELETE FROM public.email_whitelist")
    return {"success": True}
