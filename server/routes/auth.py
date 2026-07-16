from fastapi import APIRouter
from pydantic import BaseModel
from database import get_connection, row_to_dict, generate_id, now

router = APIRouter(prefix="/auth")


class LoginRequest(BaseModel):
    email: str
    full_name: str = ""
    role: str = "user"


@router.get("/me")
def get_me():
    conn = get_connection()
    # Return the first user (simplified auth for local dev)
    user = conn.execute("SELECT * FROM users ORDER BY created_date ASC LIMIT 1").fetchone()
    conn.close()
    if user is None:
        return None
    return row_to_dict(user)


@router.post("/login")
def login(req: LoginRequest):
    conn = get_connection()
    user = conn.execute("SELECT * FROM users WHERE email = ?", (req.email,)).fetchone()
    if user is None:
        uid = generate_id()
        now_ts = now()
        conn.execute(
            "INSERT INTO users (id, email, role, full_name, created_date, updated_date) VALUES (?, ?, ?, ?, ?, ?)",
            (uid, req.email, req.role, req.full_name, now_ts, now_ts)
        )
        conn.commit()
        user = conn.execute("SELECT * FROM users WHERE id = ?", (uid,)).fetchone()
    conn.close()
    return row_to_dict(user)


@router.post("/logout")
def logout():
    return {"success": True}


@router.get("/login-url")
def login_url():
    return {"url": "/login"}