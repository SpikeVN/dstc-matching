import logging
import mimetypes
import os
import uuid

from fastapi import APIRouter, UploadFile, File, Depends
from pydantic import BaseModel

from auth.dependencies import get_current_user
from auth.supabase_client import get_supabase
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

    sb = get_supabase()
    try:
        await sb.storage.from_(bucket).upload(
            path=filename,
            file=content,
            file_options={"content-type": content_type, "upsert": "false"},
        )
    except Exception as exc:
        # Debug: print storage client headers to diagnose RLS issues
        import traceback; traceback.print_exc()
        try:
            h = dict(sb.storage._client.headers)
            print(f"[UPLOAD DEBUG] apikey present: {'apikey' in h}")
            print(f"[UPLOAD DEBUG] auth present: {'authorization' in h}")
            print(f"[UPLOAD DEBUG] base_url: {sb.storage._base_url}")
        except Exception as dbg:
            print(f"[UPLOAD DEBUG] could not dump headers: {dbg}")
        return {"file_url": "", "error": f"Storage upload failed: {exc}"}

    public_url = await sb.storage.from_(bucket).get_public_url(filename)
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
