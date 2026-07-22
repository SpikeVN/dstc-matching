import os
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# Add server directory to path so imports work
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from auth.config import CORS_ORIGINS
from database import close_pool
from routes.auth import router as auth_router
from routes.profiles import router as profiles_router
from routes.matches import router as matches_router
from routes.messages import router as messages_router
from routes.swipes import router as swipes_router
from routes.teams import router as teams_router
from routes.invites import router as invites_router
from routes.integrations import router as integrations_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: pool is created lazily on first request
    print("DSTC Matching API starting...")
    yield
    # Shutdown: close the connection pool
    await close_pool()
    print("Database pool closed")


app = FastAPI(title="DSTC Matching API", lifespan=lifespan)

# CORS - allow frontend origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Mount uploads directory for serving files
uploads_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
os.makedirs(uploads_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")

# Mount GoTrue email templates (served so GoTrue can fetch them via URL)
templates_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "templates")
app.mount("/templates", StaticFiles(directory=templates_dir), name="templates")

# Register routers
app.include_router(auth_router)
app.include_router(profiles_router)
app.include_router(matches_router)
app.include_router(messages_router)
app.include_router(swipes_router)
app.include_router(teams_router)
app.include_router(invites_router)
app.include_router(integrations_router)


@app.get("/health")
async def health():
    return {"status": "ok"}
