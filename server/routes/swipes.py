from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel
from typing import Optional
from database import fetch, fetch_one, execute, generate_id, now, is_disabled
from auth.dependencies import get_current_user
from mailer import fire_match_notification

# Helper to create a notification (imported inline to avoid circular deps)
async def _create_notification(user_id: str, type_: str, title: str, body: str = "", data: dict = None):
    from routes.notifications import create_notification_helper
    await create_notification_helper(user_id, type_, title, body, data or {})


async def _ensure_match(user1_id: str, user2_id: str, now_ts: str) -> str:
    """Create a match record or reactivate an existing one. Returns the match id."""
    existing_match = await fetch_one(
        """SELECT id FROM matches
           WHERE (user1_id = $1 AND user2_id = $2)
              OR (user1_id = $2 AND user2_id = $1)
           LIMIT 1""",
        user1_id, user2_id,
    )
    if existing_match:
        mid = existing_match["id"]
        await execute(
            "UPDATE matches SET status = 'matched', updated_date = $1 WHERE id = $2",
            now_ts, mid,
        )
    else:
        mid = generate_id()
        await execute("""
            INSERT INTO matches (id, created_date, updated_date, user1_id, user2_id, status, user1_confirmed, user2_confirmed)
            VALUES ($1, $2, $3, $4, $5, 'matched', false, false)
        """, mid, now_ts, now_ts, user1_id, user2_id)
    return mid


async def _create_match_notifications(user1_id: str, user2_id: str, match_id: str):
    """Create in-app 'new_match' notifications for both users."""
    for uid, other_id in ((user1_id, user2_id), (user2_id, user1_id)):
        profile = await fetch_one(
            "SELECT display_name FROM contestant_profiles WHERE created_by = $1",
            other_id,
        )
        other_name = profile["display_name"] if profile else "Ai đó"
        await _create_notification(
            uid,
            "new_match",
            f"Match mới với {other_name}",
            f"Bạn đã match với {other_name}",
            {"match_id": match_id, "matched_user_id": other_id},
        )

router = APIRouter(prefix="/api/swipe-actions")


class SwipeCreate(BaseModel):
    swiper_id: str
    swiped_id: str
    action: str
    is_match: bool = False


class SwipeUpdate(BaseModel):
    is_match: Optional[bool] = None


@router.get("")
async def list_swipes(request: Request, user: dict = Depends(get_current_user)):
    query = "SELECT * FROM swipe_actions"
    params = []
    conditions = []
    idx = 1

    for key in request.query_params:
        if key in ('swiper_id', 'swiped_id', 'action', 'is_match'):
            if key == 'is_match':
                conditions.append(f"{key} = ${idx}")
                params.append(request.query_params[key] in ('true', '1'))
            else:
                conditions.append(f"{key} = ${idx}")
                params.append(request.query_params[key])
            idx += 1

    if conditions:
        query += " WHERE " + " AND ".join(conditions)

    query += " ORDER BY created_date DESC"
    return await fetch(query, *params)


@router.get("/{swipe_id}")
async def get_swipe(swipe_id: str, user: dict = Depends(get_current_user)):
    row = await fetch_one("SELECT * FROM swipe_actions WHERE id = $1", swipe_id)
    if row is None:
        raise HTTPException(status_code=404, detail="SwipeAction not found")
    if row["swiper_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized to view this swipe")
    return row


@router.post("")
async def create_swipe(swipe: SwipeCreate, user: dict = Depends(get_current_user)):
    # Check global matching toggle
    if await is_disabled("matching_disabled"):
        raise HTTPException(status_code=400, detail="Đã hết thời hạn thực hiện matching.")

    # Enforce that the authenticated user is the swiper
    if swipe.swiper_id != user["id"]:
        raise HTTPException(status_code=403, detail="Cannot swipe on behalf of another user")

    # Check for existing swipe from this user to the same target.
    # When looping back passed profiles, a re-pass is idempotent and
    # upgrading a pass to a like is allowed. Duplicate likes are rejected.
    existing = await fetch_one(
        "SELECT * FROM swipe_actions WHERE swiper_id = $1 AND swiped_id = $2",
        swipe.swiper_id, swipe.swiped_id,
    )
    if existing:
        if existing["action"] == swipe.action:
            # Same action again — idempotent, return the existing record
            return existing
        if existing["action"] == "like":
            # Already liked; cannot downgrade to pass
            raise HTTPException(status_code=409, detail="Already liked this user")
        # existing action was 'pass', new action is 'like' — upgrade
        now_ts = now()
        await execute(
            "UPDATE swipe_actions SET action = $1, updated_date = $2 WHERE id = $3",
            "like", now_ts, existing["id"],
        )

        # Check for mutual like
        reciprocal = await fetch_one(
            "SELECT * FROM swipe_actions WHERE swiper_id = $1 AND swiped_id = $2 AND action = 'like'",
            swipe.swiped_id, swipe.swiper_id,
        )
        if reciprocal:
            # Mark both swipes and create/reactivate match
            await execute("UPDATE swipe_actions SET is_match = true WHERE id = $1", existing["id"])
            await execute("UPDATE swipe_actions SET is_match = true WHERE id = $1", reciprocal["id"])
            mid = await _ensure_match(swipe.swiper_id, swipe.swiped_id, now_ts)
            fire_match_notification(swipe.swiper_id, swipe.swiped_id, mid)
            await _create_match_notifications(swipe.swiper_id, swipe.swiped_id, mid)

        return await fetch_one("SELECT * FROM swipe_actions WHERE id = $1", existing["id"])

    # Server determines if this is a match (mutual like)
    is_match = False
    if swipe.action == "like":
        reciprocal = await fetch_one(
            "SELECT * FROM swipe_actions WHERE swiper_id = $1 AND swiped_id = $2 AND action = 'like'",
            swipe.swiped_id, swipe.swiper_id,
        )
        if reciprocal:
            is_match = True

    sid = generate_id()
    now_ts = now()
    await execute("""
        INSERT INTO swipe_actions (id, created_date, updated_date, swiper_id, swiped_id, action, is_match)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
    """, sid, now_ts, now_ts, swipe.swiper_id, swipe.swiped_id, swipe.action, is_match)

    if is_match:
        mid = await _ensure_match(swipe.swiper_id, swipe.swiped_id, now_ts)
        await execute("UPDATE swipe_actions SET is_match = true WHERE id = $1", sid)
        await execute("UPDATE swipe_actions SET is_match = true WHERE swiper_id = $1 AND swiped_id = $2",
                      swipe.swiped_id, swipe.swiper_id)
        fire_match_notification(swipe.swiper_id, swipe.swiped_id, mid)
        await _create_match_notifications(swipe.swiper_id, swipe.swiped_id, mid)

    return await fetch_one("SELECT * FROM swipe_actions WHERE id = $1", sid)


@router.patch("/{swipe_id}")
async def update_swipe(swipe_id: str, update: SwipeUpdate, user: dict = Depends(get_current_user)):
    existing = await fetch_one("SELECT * FROM swipe_actions WHERE id = $1", swipe_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="SwipeAction not found")
    if existing["swiper_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized to update this swipe")

    fields = []
    vals = []
    idx = 1
    for key, value in update.model_dump(exclude_unset=True).items():
        if value is not None:
            fields.append(f"{key} = ${idx}")
            vals.append(value)
            idx += 1

    if fields:
        fields.append(f"updated_date = ${idx}")
        vals.append(now())
        idx += 1
        vals.append(swipe_id)
        await execute(f"UPDATE swipe_actions SET {', '.join(fields)} WHERE id = ${idx}", *vals)

    return await fetch_one("SELECT * FROM swipe_actions WHERE id = $1", swipe_id)


@router.delete("/{swipe_id}")
async def delete_swipe(swipe_id: str, user: dict = Depends(get_current_user)):
    existing = await fetch_one("SELECT * FROM swipe_actions WHERE id = $1", swipe_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="SwipeAction not found")
    if existing["swiper_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized to delete this swipe")
    await execute("DELETE FROM swipe_actions WHERE id = $1", swipe_id)
    return {"success": True}
