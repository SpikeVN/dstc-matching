import logging
import mimetypes
import os
import uuid

import httpx
from fastapi import APIRouter, UploadFile, File, Form, Depends
from pydantic import BaseModel

from auth.dependencies import get_current_user
from auth.config import SUPABASE_URL, SUPABASE_PUBLIC_URL, SUPABASE_SERVICE_KEY
from mailer import send_email as _send_email

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")


class EmailRequest(BaseModel):
    from_name: str = ""
    to: str = ""
    subject: str = ""
    body: str = ""


MAX_UPLOAD_SIZE = 5 * 1024 * 1024  # 5 MB

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".tiff"}
DOCUMENT_EXTENSIONS = {".pdf", ".docx", ".odt", ".txt", ".md", ".rtf"}
CODE_EXTENSIONS = {
    ".py", ".js", ".ts", ".jsx", ".tsx", ".java", ".cpp", ".c", ".h",
    ".go", ".rs", ".rb", ".php", ".sql", ".sh", ".json", ".yaml", ".yml",
    ".toml", ".xml", ".html", ".css", ".scss", ".vue", ".svelte",
}
NOTEBOOK_EXTENSIONS = {".ipynb"}
ARCHIVE_EXTENSIONS = {".zip", ".tar", ".gz", ".tgz", ".bz2", ".xz", ".7z", ".rar"}

ALLOWED_EXTENSIONS = (
    IMAGE_EXTENSIONS | DOCUMENT_EXTENSIONS | CODE_EXTENSIONS
    | NOTEBOOK_EXTENSIONS | ARCHIVE_EXTENSIONS
)

# Bucket names (must exist in Supabase Storage)
BUCKET_PROFILE_PICTURES = "profile_pictures"
BUCKET_CV = "cv"
BUCKET_UPLOADS = "uploads"


def _classify_file(ext: str) -> str:
    """Classify a file extension into a category for the frontend."""
    if ext in IMAGE_EXTENSIONS:
        return "image"
    if ext in DOCUMENT_EXTENSIONS:
        return "document"
    if ext in CODE_EXTENSIONS:
        return "code"
    if ext in NOTEBOOK_EXTENSIONS:
        return "notebook"
    if ext in ARCHIVE_EXTENSIONS:
        return "archive"
    return "file"


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    bucket: str = Form(default=""),
    user: dict = Depends(get_current_user),
):
    ext = _get_ext(file.filename)
    if ext not in ALLOWED_EXTENSIONS:
        return {"file_url": "", "error": f"File type {ext} not allowed"}

    content = await file.read()
    if len(content) > MAX_UPLOAD_SIZE:
        return {"file_url": "", "error": "File too large (max 5 MB)"}

    # Choose bucket: explicit override or default based on file type
    if bucket == "uploads":
        bucket = BUCKET_UPLOADS
    elif ext in IMAGE_EXTENSIONS:
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

    public_url = f"{SUPABASE_PUBLIC_URL}/storage/v1/object/public/{bucket}/{filename}"
    return {"file_url": public_url, "file_category": _classify_file(ext)}


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
