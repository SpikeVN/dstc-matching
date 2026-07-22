import os
import uuid
from fastapi import APIRouter, UploadFile, File, Depends
from pydantic import BaseModel

from auth.dependencies import get_current_user
from mailer import send_email as _send_email

router = APIRouter(prefix="/api")

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


class EmailRequest(BaseModel):
    from_name: str = ""
    to: str = ""
    subject: str = ""
    body: str = ""


MAX_UPLOAD_SIZE = 5 * 1024 * 1024  # 5 MB
ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".pdf", ".docx", ".odt"}


@router.post("/upload")
async def upload_file(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    ext = os.path.splitext(file.filename)[1].lower() if file.filename else ".bin"
    if ext not in ALLOWED_EXTENSIONS:
        return {"file_url": "", "error": f"File type {ext} not allowed"}

    content = await file.read()
    if len(content) > MAX_UPLOAD_SIZE:
        return {"file_url": "", "error": "File too large (max 5 MB)"}

    filename = f"{uuid.uuid4()}{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    with open(filepath, "wb") as f:
        f.write(content)

    file_url = f"/uploads/{filename}"
    return {"file_url": file_url}


@router.post("/send-email")
async def send_email_route(req: EmailRequest, user: dict = Depends(get_current_user)):
    if not req.to or not req.subject:
        return {"success": False, "message": "Missing 'to' or 'subject'"}
    # Wrap plain text body in a basic HTML layout
    html = f"<div style='font-family:sans-serif;padding:16px;'>{req.body}</div>"
    ok = await _send_email(to=req.to, subject=req.subject, html=html)
    return {"success": ok}
