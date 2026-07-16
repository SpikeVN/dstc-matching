import os
import sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# Add server directory to path so imports work
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import init_db
from routes.auth import router as auth_router
from routes.profiles import router as profiles_router
from routes.matches import router as matches_router
from routes.messages import router as messages_router
from routes.swipes import router as swipes_router
from routes.teams import router as teams_router
from routes.invites import router as invites_router
from routes.integrations import router as integrations_router

app = FastAPI(title="DSTC Matching API")

# CORS - allow frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount uploads directory for serving files
uploads_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
os.makedirs(uploads_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")

# Register routers
app.include_router(auth_router)
app.include_router(profiles_router)
app.include_router(matches_router)
app.include_router(messages_router)
app.include_router(swipes_router)
app.include_router(teams_router)
app.include_router(invites_router)
app.include_router(integrations_router)


@app.on_event("startup")
def on_startup():
    init_db()
    print("Database initialized successfully")


@app.get("/health")
def health():
    return {"status": "ok"}