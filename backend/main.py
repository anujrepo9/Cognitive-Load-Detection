"""
main.py — FastAPI application entry point.

This is what `uvicorn main:app` (used by both backend/start.py for dev and
cogniload_app.py for the packaged Windows app) actually imports. It merges
the two draft "patch" files that were left in the repo
(backend_main_patch.py and backend/backend_main_patch.py.py) into one
consistent module:

  - Route/DB/logging wiring from backend_main_patch.py.py (matches the
    actual `config`, `core.*`, `database.db`, `services.predictor` modules).
  - The /health endpoint + static-file serving for the packaged desktop
    frontend (frontend/dist) from the root-level backend_main_patch.py.

All API routers are mounted under /api, since the frontend's axios client
(frontend/src/services/api.js) always calls relative paths like
"/api/auth/login".
"""

import os
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from config import CORS_ORIGINS, MAX_BODY_SIZE
from core.logging import get_logger, setup_logging
from core.errors import register_exception_handlers
from core.middleware import RequestIDMiddleware, MaxBodySizeMiddleware
from database.db import init_db, dispose_engine
from services.predictor import get_predictor
from routes import auth, behavior, prediction, dashboard, recommendation, session, reports, analytics
from routes import settings as settings_route
from routes import model as model_route
from routes import ws as ws_route

setup_logging()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initialising database…")
    init_db()
    logger.info("Loading ML model…")
    get_predictor()
    logger.info("Backend ready.")
    try:
        yield
    finally:
        logger.info("Shutting down — disposing database engine.")
        dispose_engine()


app = FastAPI(
    title="CogniLoad API",
    version="1.0.0",
    description="Cognitive Load Detection — REST API",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url=None,
)

# ── Global exception handlers ────────────────────────────────────────────────
register_exception_handlers(app)

# ── Middleware stack (Starlette wraps in LIFO order — last added = outermost) ─
#   CORS → MaxBodySize → RequestID → route handler
app.add_middleware(RequestIDMiddleware)
app.add_middleware(MaxBodySizeMiddleware, max_bytes=MAX_BODY_SIZE)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:4173",
        "http://localhost:8000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:8000",
        *CORS_ORIGINS,
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── API routers — all mounted under /api to match frontend/src/services/api.js ─
app.include_router(auth.router,           prefix="/api")
app.include_router(behavior.router,       prefix="/api")
app.include_router(prediction.router,     prefix="/api")
app.include_router(dashboard.router,      prefix="/api")
app.include_router(recommendation.router, prefix="/api")
app.include_router(session.router,        prefix="/api")
app.include_router(reports.router,        prefix="/api")
app.include_router(analytics.router,      prefix="/api")
app.include_router(settings_route.router, prefix="/api")
app.include_router(model_route.router,    prefix="/api")
app.include_router(ws_route.router)

# ── Health check (polled by cogniload_app.py's launcher) ─────────────────────
@app.get("/health", tags=["meta"])
def health():
    return {"status": "ok", "version": "1.0.0"}

# ── Serve the pre-built React frontend (packaged desktop app only) ───────────
# COGNILOAD_STATIC_DIR is set by cogniload_app.py to frontend/dist.
# In normal dev (`python backend/start.py`), this is unset and skipped —
# the Vite dev server serves the frontend instead.
_static_dir = os.environ.get("COGNILOAD_STATIC_DIR", "")
_static_path = Path(_static_dir) if _static_dir else None

if _static_path and _static_path.exists():
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
