from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from database import fetch, fetch_one, execute, generate_id, now
from auth.dependencies import get_current_user

router = APIRouter(prefix="/api/reports")


class ReportCreate(BaseModel):
    reported_id: str
    match_id: Optional[str] = None
    reason: str = ""
    attachment_url: Optional[str] = None
    attachment_name: Optional[str] = None
    attachment_type: Optional[str] = None


@router.post("")
async def create_report(body: ReportCreate, user: dict = Depends(get_current_user)):
    """Report a user. Also automatically blocks them."""
    if body.reported_id == user["id"]:
        raise HTTPException(status_code=400, detail="Cannot report yourself")

    rid = generate_id()
    ts = now()
    await execute(
        """INSERT INTO public.reports (id, reporter_id, reported_id, match_id, reason, attachment_url, attachment_name, attachment_type, created_date)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)""",
        rid, user["id"], body.reported_id, body.match_id, body.reason,
        body.attachment_url, body.attachment_name, body.attachment_type, ts
    )

    # Auto-block the reported user
    existing_block = await fetch_one(
        "SELECT * FROM public.blocked_users WHERE blocker_id = $1 AND blocked_id = $2",
        user["id"], body.reported_id
    )
    if not existing_block:
        bid = generate_id()
        await execute(
            "INSERT INTO public.blocked_users (id, blocker_id, blocked_id, created_date) VALUES ($1, $2, $3, $4)",
            bid, user["id"], body.reported_id, ts
        )

    # Update any match between these two users to 'blocked' status
    await execute(
        """UPDATE public.matches SET status = 'blocked', updated_date = $1
           WHERE ((user1_id = $2 AND user2_id = $3) OR (user1_id = $3 AND user2_id = $2))
             AND (status = 'matched' OR status = 'pending')""",
        ts, user["id"], body.reported_id
    )

    # Delete swipe records so they don't appear in discover
    await execute(
        "DELETE FROM swipe_actions WHERE (swiper_id = $1 AND swiped_id = $2) OR (swiper_id = $2 AND swiped_id = $1)",
        user["id"], body.reported_id,
    )

    return await fetch_one("SELECT * FROM public.reports WHERE id = $1", rid)