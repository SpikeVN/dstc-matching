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


@router.post("")
async def create_report(body: ReportCreate, user: dict = Depends(get_current_user)):
    """Report a user."""
    if body.reported_id == user["id"]:
        raise HTTPException(status_code=400, detail="Cannot report yourself")

    rid = generate_id()
    ts = now()
    await execute(
        """INSERT INTO public.reports (id, reporter_id, reported_id, match_id, reason, created_date)
           VALUES ($1, $2, $3, $4, $5, $6)""",
        rid, user["id"], body.reported_id, body.match_id, body.reason, ts
    )

    return await fetch_one("SELECT * FROM public.reports WHERE id = $1", rid)