"""
backend_main_patch.py
=====================
Replace (or patch) backend/main.py with this version when building the
Windows desktop app. It adds:
  - Static file serving for the pre-built React frontend (frontend/dist)
  - A /health endpoint the launcher polls to know when the server is ready
  - Reads config from the user-data .env created by cogniload_app.py

Copy this file over backend/main.py in your project before running PyInstaller,
or merge these additions into the existing main.py.
"""

import os
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

# Load env from the location set by the launcher
_env_file = os.environ.get("COGNILOAD_ENV_FILE", ".env")
from dotenv import load_dotenv
load_dotenv(_env_file)

from core.config import settings
from core.middleware import RequestIDMiddleware
from core.errors import setup_exception_handlers
from core.logging import setup_logging
from database.db import init_db
from routes import auth, behavior, prediction, dashboard, analytics, session
from routes import recommendation, reports, settings as settings_router, model, ws


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    init_db()
    yield


app = FastAPI(
    title="CogniLoad API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url=None,
)

# ── CORS (open for same-machine requests) ─────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173",
                   "http://localhost:8000",  "http://127.0.0.1:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RequestIDMiddleware)
setup_exception_handlers(app)

# ── API routes ────────────────────────────────────────────────────────────────
app.include_router(auth.router,           prefix="/api/auth")
app.include_router(behavior.router,       prefix="/api")
app.include_router(prediction.router,     prefix="/api")
app.include_router(dashboard.router,      prefix="/api")
app.include_router(analytics.router,      prefix="/api/analytics")
app.include_router(session.router,        prefix="/api/sessions")
app.include_router(recommendation.router, prefix="/api")
app.include_router(reports.router,        prefix="/api/reports")
app.include_router(settings_router.router,prefix="/api/settings")
app.include_router(model.router,          prefix="/api/model")
app.include_router(ws.router)

# ── Health check (polled by the launcher) ─────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "ok"}

# ── Serve the pre-built React frontend ────────────────────────────────────────
_static_dir = os.environ.get("COGNILOAD_STATIC_DIR", "")
_static_path = Path(_static_dir) if _static_dir else None

if _static_path and _static_path.exists():
    # Serve React assets under /assets (Vite outputs here)
    assets_dir = _static_path / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        """Catch-all: serve index.html so React Router handles navigation."""
        index = _static_path / "index.html"
        if index.exists():
            return FileResponse(str(index))
        return {"error": "Frontend not built. Run: npm run build in frontend/"}
