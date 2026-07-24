import logging
import mimetypes
import os
import uuid

import httpx
from fastapi import APIRouter, UploadFile, File, Depends
from pydantic import BaseModel

from auth.dependencies import get_current_user
from auth.config import SUPABASE_URL, SUPABASE_SERVICE_KEY
from mailer import send_email as _send_email

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")


class EmailRequest(BaseModel):
    from_name: str = ""
    to: str = ""
    subject: str = ""
    body: str = ""


MAX_UPLOAD_SIZE = 5 * 1024 * 1024  # 5 MB
ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".pdf", ".docx", ".odt"}

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp"}

# Bucket names (must exist in Supabase Storage)
BUCKET_PROFILE_PICTURES = "profile_pictures"
BUCKET_CV = "cv"


@router.post("/upload")
async def upload_file(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    ext = _get_ext(file.filename)
    if ext not in ALLOWED_EXTENSIONS:
        return {"file_url": "", "error": f"File type {ext} not allowed"}

    content = await file.read()
    if len(content) > MAX_UPLOAD_SIZE:
        return {"file_url": "", "error": "File too large (max 5 MB)"}

    # Choose bucket based on file type
    if ext in IMAGE_EXTENSIONS:
        bucket = BUCKET_PROFILE_PICTURES
    else:
        bucket = BUCKET_CV

    # Build a unique path inside the bucket
    filename = f"{uuid.uuid4()}{ext}"
    content_type = mimetypes.guess_type(file.filename or f"file{ext}")[0] or "application/octet-stream"

    storage_url = f"{SUPABASE_URL}/storage/v1/object/{bucket}/{filename}"
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    }
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                storage_url,
                headers=headers,
                files={"file": (filename, content, content_type)},
            )
            resp.raise_for_status()
    except httpx.HTTPStatusError as exc:
        logger.error("Storage upload failed: %s — %s", exc.response.status_code, exc.response.text)
        return {"file_url": "", "error": f"Storage upload failed: {exc.response.status_code}"}
    except Exception as exc:
        logger.error("Storage upload failed: %s", exc)
        return {"file_url": "", "error": f"Storage upload failed: {exc}"}

    public_url = f"{SUPABASE_URL}/storage/v1/object/public/{bucket}/{filename}"
    return {"file_url": public_url}


@router.post("/send-email")
async def send_email_route(req: EmailRequest, user: dict = Depends(get_current_user)):
    if not req.to or not req.subject:
        return {"success": False, "message": "Missing 'to' or 'subject'"}
    html = f"<div style='font-family:sans-serif;padding:16px;'>{req.body}</div>"
    ok = await _send_email(to=req.to, subject=req.subject, html=html)
    return {"success": ok}


def _get_ext(filename: str | None) -> str:
    """Extract lowercase file extension (e.g. '.pdf')."""
    if not filename:
        return ".bin"
    return os.path.splitext(filename)[1].lower()
