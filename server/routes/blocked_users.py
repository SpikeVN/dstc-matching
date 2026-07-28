from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from database import fetch, fetch_one, execute, generate_id, now
from auth.dependencies import get_current_user

router = APIRouter(prefix="/api/blocked-users")


class BlockCreate(BaseModel):
    blocked_id: str


@router.get("")
async def list_blocked_users(user: dict = Depends(get_current_user)):
    """List users blocked by the current user."""
    return await fetch(
        "SELECT * FROM public.blocked_users WHERE blocker_id = $1 ORDER BY created_date DESC",
        user["id"]
    )


@router.post("")
async def block_user(body: BlockCreate, user: dict = Depends(get_current_user)):
    """Block a user. Prevents future discover matches and deletes swipe records."""
    if body.blocked_id == user["id"]:
        raise HTTPException(status_code=400, detail="Cannot block yourself")

    # Check if already blocked
    existing = await fetch_one(
        "SELECT * FROM public.blocked_users WHERE blocker_id = $1 AND blocked_id = $2",
        user["id"], body.blocked_id
    )
    if existing:
        return existing

    # Insert block record
    bid = generate_id()
    ts = now()
    await execute(
        "INSERT INTO public.blocked_users (id, blocker_id, blocked_id, created_date) VALUES ($1, $2, $3, $4)",
        bid, user["id"], body.blocked_id, ts
    )

    # Delete swipe records so blocked user doesn't appear in discover
    await execute(
        "DELETE FROM swipe_actions WHERE (swiper_id = $1 AND swiped_id = $2) OR (swiper_id = $2 AND swiped_id = $1)",
        user["id"], body.blocked_id,
    )

    return await fetch_one("SELECT * FROM public.blocked_users WHERE id = $1", bid)


@router.get("/blocked-by/{user_id}")
async def check_blocked_by(user_id: str, user: dict = Depends(get_current_user)):
    """Check if the current user is blocked by the specified user."""
    blocked = await fetch_one(
        "SELECT 1 FROM public.blocked_users WHERE blocker_id = $1 AND blocked_id = $2",
        user_id, user["id"]
    )
    return {"blocked": blocked is not None}


@router.delete("/{blocked_id}")
async def unblock_user(blocked_id: str, user: dict = Depends(get_current_user)):
    """Unblock a user."""
    existing = await fetch_one(
        "SELECT * FROM public.blocked_users WHERE blocker_id = $1 AND blocked_id = $2",
        user["id"], blocked_id
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Block not found")

    await execute("DELETE FROM public.blocked_users WHERE id = $1", existing["id"])
    return {"success": True}