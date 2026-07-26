from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from database import fetch, fetch_one, execute, generate_id, now
from auth.dependencies import get_current_user

router = APIRouter(prefix="/api/admin")

# ── Role hierarchy constants ─────────────────────────────────────────────────
ROLE_HIERARCHY = {"owner": 0, "mod": 1, "manager": 2, "user": 3}


def _require_admin_role(user: dict, min_role: str = "manager"):
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

    # Owner can manage anyone
    if current_role == "owner":
        return True

    # Mod can manage managers and users (not other mods or owners)
    if current_role == "mod":
        return ROLE_HIERARCHY.get(target_role, 3) >= ROLE_HIERARCHY.get("manager", 2)

    return False


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
    """List all users with their admin roles. Requires manager+ role."""
    _require_admin_role(user, "manager")

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
    _require_admin_role(user, "manager")

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
    _require_admin_role(user, "manager")

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
    _require_admin_role(user, "manager")

    return {
        "hierarchy": ROLE_HIERARCHY,
        "roles": [
            {"name": "owner", "description": "Full access, can assign mods", "level": 0},
            {"name": "mod", "description": "Can manage managers and users", "level": 1},
            {"name": "manager", "description": "Access to admin panel", "level": 2},
            {"name": "user", "description": "Regular user", "level": 3},
        ],
    }


@router.get("/stats")
async def get_admin_stats(user: dict = Depends(get_current_user)):
    """Get admin dashboard statistics. Requires manager+ role."""
    _require_admin_role(user, "manager")

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
