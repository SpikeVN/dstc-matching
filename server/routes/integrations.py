import os
import uuid
from fastapi import APIRouter, UploadFile, File, Depends
from pydantic import BaseModel

from auth.dependencies import get_current_user

router = APIRouter(prefix="/api")

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


class EmailRequest(BaseModel):
    from_name: str = ""
    to: str = ""
    subject: str = ""
    body: str = ""


MAX_UPLOAD_SIZE = 5 * 1024 * 1024  # 5 MB
ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".pdf"}


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
async def send_email(req: EmailRequest):
    # Stub: log to console instead of actually sending
    print(f"[EMAIL] From: {req.from_name} <{req.to}>")
    print(f"[EMAIL] Subject: {req.subject}")
    print(f"[EMAIL] Body:\n{req.body}")
    print(f"[EMAIL] --- Email logged (not sent) ---")
    return {"success": True, "message": "Email logged to console (stub)"}
