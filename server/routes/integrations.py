import os
import uuid
from fastapi import APIRouter, UploadFile, File
from pydantic import BaseModel

router = APIRouter(prefix="/api")

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


class EmailRequest(BaseModel):
    from_name: str = ""
    to: str = ""
    subject: str = ""
    body: str = ""


@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    ext = os.path.splitext(file.filename)[1] if file.filename else ".bin"
    filename = f"{uuid.uuid4()}{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    content = await file.read()
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
