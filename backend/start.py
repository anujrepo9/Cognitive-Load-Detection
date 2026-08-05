"""
start.py — One command to start the entire CogniLoad stack.

Usage (from project root):
    python backend/start.py            # backend only
    python backend/start.py --full     # backend + frontend (npm run dev)
    python backend/start.py --port 8080  # custom port

What it does:
    1. Checks .env exists (copies .env.example if not)
    2. Starts FastAPI backend via uvicorn
    3. (--full) Starts React frontend via npm run dev in a separate process
    4. Opens http://localhost:5173 in your browser automatically
    5. On Ctrl+C, shuts everything down cleanly
"""

import argparse
import os
import platform
import signal
import subprocess
import sys
import time
import webbrowser
from pathlib import Path

# ── Paths ─────────────────────────────────────────────────────────────────────
BACKEND_DIR  = Path(__file__).parent
PROJECT_ROOT = BACKEND_DIR.parent
FRONTEND_DIR = PROJECT_ROOT / "frontend"
ENV_FILE     = BACKEND_DIR / ".env"
ENV_EXAMPLE  = BACKEND_DIR / ".env.example"

# ── Colors (Windows-safe) ─────────────────────────────────────────────────────
USE_COLOR = platform.system() != "Windows" or os.environ.get("WT_SESSION")
GREEN  = "\033[92m" if USE_COLOR else ""
YELLOW = "\033[93m" if USE_COLOR else ""
RED    = "\033[91m" if USE_COLOR else ""
CYAN   = "\033[96m" if USE_COLOR else ""
RESET  = "\033[0m"  if USE_COLOR else ""

processes: list[subprocess.Popen] = []


def log(color: str, tag: str, msg: str):
    print(f"{color}[{tag}]{RESET} {msg}")


def ensure_env():
    if not ENV_FILE.exists():
        if ENV_EXAMPLE.exists():
            import shutil
            shutil.copy(ENV_EXAMPLE, ENV_FILE)
            log(YELLOW, "ENV", f".env not found — copied from .env.example")
            log(YELLOW, "ENV", "Edit backend/.env with your DATABASE_URL before running again.")
        else:
            log(RED, "ENV", "No .env or .env.example found in backend/. Create one first.")
            sys.exit(1)


def start_backend(port: int, reload: bool) -> subprocess.Popen:
    cmd = [
        sys.executable, "-m", "uvicorn", "main:app",
        "--host", "0.0.0.0",
        "--port", str(port),
    ]
    if reload:
        cmd.append("--reload")

    log(GREEN, "BACKEND", f"Starting FastAPI on http://localhost:{port}")
    log(GREEN, "BACKEND", f"Swagger docs → http://localhost:{port}/docs")

    proc = subprocess.Popen(
        cmd,
        cwd=str(BACKEND_DIR),
        # Don't capture output — let it stream to terminal
    )
    processes.append(proc)
    return proc


def start_frontend() -> subprocess.Popen | None:
    if not FRONTEND_DIR.exists():
        log(YELLOW, "FRONTEND", f"frontend/ not found at {FRONTEND_DIR} — skipping")
        return None

    npm = "npm.cmd" if platform.system() == "Windows" else "npm"
    log(CYAN, "FRONTEND", f"Starting React dev server in {FRONTEND_DIR}")

    proc = subprocess.Popen(
        [npm, "run", "dev"],
        cwd=str(FRONTEND_DIR),
    )
    processes.append(proc)
    return proc


def open_browser(url: str, delay: float = 2.5):
    """Open browser after a short delay so servers have time to start."""
    time.sleep(delay)
    log(CYAN, "BROWSER", f"Opening {url}")
    webbrowser.open(url)


def shutdown(sig=None, frame=None):
    log(YELLOW, "SHUTDOWN", "Stopping all processes…")
    for p in processes:
        try:
            if platform.system() == "Windows":
                p.terminate()
            else:
                os.killpg(os.getpgid(p.pid), signal.SIGTERM)
        except Exception:
            try:
                p.terminate()
            except Exception:
                pass
    sys.exit(0)


def main():
    parser = argparse.ArgumentParser(description="CogniLoad unified launcher")
    parser.add_argument("--full",   action="store_true",
                        help="Also start the React frontend (npm run dev)")
    parser.add_argument("--port",   type=int, default=8000,
                        help="Backend port (default 8000)")
    parser.add_argument("--no-reload", action="store_true",
                        help="Disable uvicorn --reload (use in production)")
    parser.add_argument("--no-browser", action="store_true",
                        help="Don't auto-open browser")
    args = parser.parse_args()

    # Ensure .env exists
    ensure_env()

    print()
    print(f"{GREEN}{'='*52}{RESET}")
    print(f"{GREEN}  CogniLoad — Starting{RESET}")
    print(f"{GREEN}{'='*52}{RESET}")
    print()

    # Register shutdown handler
    signal.signal(signal.SIGINT,  shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    # Start backend
    start_backend(port=args.port, reload=not args.no_reload)

    # Optionally start frontend
    fe_proc = None
    if args.full:
        time.sleep(1)   # give backend a head start
        fe_proc = start_frontend()

    # Open browser
    if not args.no_browser:
        url = "http://localhost:5173" if args.full else f"http://localhost:{args.port}/docs"
        import threading
        t = threading.Thread(target=open_browser, args=(url,), daemon=True)
        t.start()

    print()
    log(GREEN, "READY", "Press Ctrl+C to stop all services.")
    print()

    # Wait for processes
    try:
        for p in processes:
            p.wait()
    except KeyboardInterrupt:
        shutdown()


if __name__ == "__main__":
    main()
