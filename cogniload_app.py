"""
cogniload_app.py — CogniLoad Windows Desktop Application

This is the main entry point for the packaged Windows app.
It:
  1. Bundles and starts the FastAPI backend (uvicorn)
  2. Builds the React frontend to static files (or uses pre-built dist/)
  3. Serves the frontend via FastAPI's StaticFiles
  4. Opens the app in the system default browser (or embedded WebView2)
  5. Sits in the system tray with a right-click menu

Usage:
    python cogniload_app.py          # normal launch
    python cogniload_app.py --port 8000
"""

import argparse
import os
import platform
import signal
import subprocess
import sys
import threading
import time
import traceback
import webbrowser
import tkinter as tk
from tkinter import messagebox
from pathlib import Path

import uvicorn

# When PyInstaller builds this as a windowed app (console=False), there is
# no console attached, so sys.stdout/sys.stderr are None. Anything that
# writes to them (our own print()s, and uvicorn's default logging setup,
# which calls sys.stdout.isatty() to decide whether to colorize) would
# crash with AttributeError. Give them harmless no-op targets instead.
if sys.stdout is None:
    sys.stdout = open(os.devnull, "w")
if sys.stderr is None:
    sys.stderr = open(os.devnull, "w")

# On Windows the default console encoding is cp1252 (or similar) which cannot
# represent Unicode characters like ✓, —, …, 🧠 used in log output.
# Reconfigure stdout/stderr to UTF-8 so print() never raises UnicodeEncodeError.
# errors="replace" is the final safety net: any character that still can't be
# encoded is replaced with '?' rather than crashing the app.
import io as _io
try:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    else:
        sys.stdout = _io.TextIOWrapper(
            sys.stdout.buffer, encoding="utf-8", errors="replace"
        )
except Exception:
    pass

try:
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    else:
        sys.stderr = _io.TextIOWrapper(
            sys.stderr.buffer, encoding="utf-8", errors="replace"
        )
except Exception:
    pass

# Optional system tray (pystray + Pillow)
try:
    import pystray
    from PIL import Image, ImageDraw
    HAS_TRAY = True
except ImportError:
    HAS_TRAY = False

# ── Resolve base path (works both dev and PyInstaller) ─────────────────────
if getattr(sys, "frozen", False):
    BASE_DIR = Path(sys._MEIPASS)          # PyInstaller temp directory
    APP_DIR  = Path(sys.executable).parent # Directory of the .exe
else:
    BASE_DIR = Path(__file__).parent
    APP_DIR  = BASE_DIR

BACKEND_DIR  = BASE_DIR / "backend"
FRONTEND_DIR = BASE_DIR / "frontend"
DIST_DIR     = FRONTEND_DIR / "dist"       # Pre-built React output
DATA_DIR     = APP_DIR / "data"            # User data (db, logs, .env)
DATA_DIR.mkdir(parents=True, exist_ok=True)

ENV_FILE    = DATA_DIR / ".env"
MODEL_DIR   = APP_DIR / "ml" / "saved_models"

# ── State ───────────────────────────────────────────────────────────────────
_uvicorn_server: uvicorn.Server | None = None
_backend_thread: threading.Thread | None = None
_backend_start_error: str | None = None
_tray_icon = None
_port = 8000


# ─────────────────────────────────────────────────────────────────────────────
# Environment / config helpers
# ─────────────────────────────────────────────────────────────────────────────

def ensure_env(port: int) -> None:
    """Create .env in user data dir if it doesn't exist, then pin all
    critical values into os.environ immediately.

    Pinning into os.environ matters because the backend's config.py uses
    load_dotenv() which does NOT override variables that are already set in
    the process environment.  By writing the absolute DB path directly into
    os.environ here — before any backend module is imported — we guarantee
    that config.py always gets the right DATABASE_URL even when Python's
    module cache returns a previously-imported (and already-configured)
    config module to a later importer.

    Without this, run_migrations() or start_backend() could import config.py
    before COGNILOAD_ENV_FILE is set, causing config.py to fall back to the
    relative path  sqlite:///./cogniload.db  which resolves inside the
    PyInstaller _MEIPASS temp directory — a folder that is wiped on every
    launch — giving every run a fresh empty database and making login
    impossible for any account created in a previous session.
    """
    import secrets as _secrets

    db_path    = (DATA_DIR / "cogniload.db").as_posix()
    model_path = (MODEL_DIR / "model.joblib").as_posix()

    if not ENV_FILE.exists():
        # Generate a proper random secret so JWT tokens survive restarts
        secret_key = _secrets.token_hex(32)
        content = (
            "# CogniLoad - auto-generated configuration\n"
            f"DATABASE_URL=sqlite:///{db_path}\n"
            f"SECRET_KEY={secret_key}\n"
            f"MODEL_PATH={model_path}\n"
            f"HOST=127.0.0.1\n"
            f"PORT={port}\n"
            f"STATIC_DIR={DIST_DIR.as_posix()}\n"
        )
        ENV_FILE.write_text(content, encoding="utf-8")
        print(f"[ENV] Created {ENV_FILE}")

    # ── Pin env vars into the live process environment ────────────────────
    # Read what's actually in the .env file so we honour any user edits.
    # We only set each variable if it isn't already set by the OS/shell,
    # except for COGNILOAD_ENV_FILE and DATABASE_URL which we always force
    # to the absolute path so there is no ambiguity.
    from dotenv import dotenv_values
    env_vals = dotenv_values(ENV_FILE)

    # Always force these two — they must be absolute paths, not relatives
    os.environ["COGNILOAD_ENV_FILE"] = str(ENV_FILE)
    os.environ["DATABASE_URL"]       = env_vals.get("DATABASE_URL") or f"sqlite:///{db_path}"
    os.environ["COGNILOAD_STATIC_DIR"] = str(DIST_DIR)

    # Set remaining values only if not already present
    for key, value in env_vals.items():
        if key not in os.environ and value is not None:
            os.environ[key] = value

    print(f"[ENV] DATABASE_URL = {os.environ['DATABASE_URL']}")


def run_migrations() -> None:
    """Run database migrations before the backend starts.

    Adds any missing tables/columns to an existing database so that users
    who installed an older build can still log in without losing their data.
    Safe to call on every startup — checks existence before altering.
    """
    backend_dir = str(BACKEND_DIR)
    if backend_dir not in sys.path:
        sys.path.insert(0, backend_dir)

    try:
        import importlib
        # Force a fresh import so we always get the current migrate.py,
        # not a stale cached version from a previous run in the same process.
        if "migrate" in sys.modules:
            del sys.modules["migrate"]
        # Also clear cached config so it re-reads the now-pinned env vars
        for mod in ("config", "core.config"):
            if mod in sys.modules:
                del sys.modules[mod]

        migrate = importlib.import_module("migrate")
        migrate.run()
        print("[DB] Migrations applied.")
    except Exception:
        print("[DB] Migration warning (non-fatal):")
        print(traceback.format_exc())


# ─────────────────────────────────────────────────────────────────────────────
# Backend process management
# ─────────────────────────────────────────────────────────────────────────────

def start_backend(port: int) -> threading.Thread:
    """Launch uvicorn in-process, on a background thread.

    IMPORTANT: we deliberately do NOT subprocess.Popen([sys.executable, ...])
    here. That pattern only works when sys.executable is a real Python
    interpreter. Once this script is frozen by PyInstaller, sys.executable
    points at CogniLoad.exe itself — so that subprocess would just try to
    re-launch the app with "-m uvicorn main:app ..." as arguments, which
    this app's own argparse doesn't understand, causing an instant silent
    exit (stderr went to an unread pipe). Running uvicorn directly in this
    process avoids the whole problem, and lets real startup errors surface
    instead of vanishing.
    """
    global _backend_start_error
    _backend_start_error = None

    # env vars (COGNILOAD_ENV_FILE, DATABASE_URL, COGNILOAD_STATIC_DIR) were
    # already pinned into os.environ by ensure_env() in main(). No need to
    # set them again here.

    # Make `main.py` (and the config/core/routes/... modules it imports)
    # importable, the same way cwd=BACKEND_DIR made them importable for the
    # old `python -m uvicorn main:app` subprocess.
    backend_dir = str(BACKEND_DIR)
    if backend_dir not in sys.path:
        sys.path.insert(0, backend_dir)

    print(f"[BACKEND] Starting on http://127.0.0.1:{port}")

    def _run():
        global _uvicorn_server, _backend_start_error
        try:
            app_module = __import__("main")
            config = uvicorn.Config(
                app_module.app,
                host="127.0.0.1",
                port=port,
                log_level="info",
                access_log=False,
                use_colors=False,
            )
            _uvicorn_server = uvicorn.Server(config)
            _uvicorn_server.run()
        except Exception:
            _backend_start_error = traceback.format_exc()
            print("[BACKEND] Failed to start:")
            print(_backend_start_error)

    thread = threading.Thread(target=_run, daemon=True)
    thread.start()
    return thread


def wait_for_backend(port: int, timeout: float = 20.0) -> bool:
    """Poll until the backend is ready (returns True) or times out (False)."""
    import urllib.request
    import urllib.error

    url = f"http://127.0.0.1:{port}/health"
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            urllib.request.urlopen(url, timeout=1)
            return True
        except Exception:
            time.sleep(0.4)
    return False


def stop_backend() -> None:
    global _uvicorn_server
    if _uvicorn_server is not None:
        print("[BACKEND] Stopping…")
        _uvicorn_server.should_exit = True
        _uvicorn_server = None


# ─────────────────────────────────────────────────────────────────────────────
# System tray icon
# ─────────────────────────────────────────────────────────────────────────────

def _make_tray_icon() -> Image.Image:
    """Draw a simple brain-like icon for the tray."""
    size = 64
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Outer circle (blue)
    d.ellipse([4, 4, size - 4, size - 4], fill=(99, 102, 241))
    # Inner white shape to suggest a brain / neural pattern
    d.ellipse([16, 16, size - 16, size - 16], fill=(255, 255, 255))
    d.ellipse([22, 22, size - 22, size - 22], fill=(99, 102, 241))
    return img


def open_app_in_browser() -> None:
    webbrowser.open(f"http://127.0.0.1:{_port}")


def quit_app(icon=None, item=None) -> None:
    print("[APP] Quit requested")
    stop_backend()
    if icon:
        icon.stop()
    os._exit(0)


def run_tray(port: int) -> None:
    global _tray_icon, _port
    _port = port

    if not HAS_TRAY:
        return

    icon_img = _make_tray_icon()
    menu = pystray.Menu(
        pystray.MenuItem("Open CogniLoad", open_app_in_browser, default=True),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem("Quit", quit_app),
    )
    _tray_icon = pystray.Icon("CogniLoad", icon_img, "CogniLoad", menu)
    _tray_icon.run()          # blocks until quit_app calls icon.stop()


# ─────────────────────────────────────────────────────────────────────────────
# Splash / loading window
# ─────────────────────────────────────────────────────────────────────────────

def show_splash(port: int) -> None:
    """Show a simple splash window while the backend starts up."""
    root = tk.Tk()
    root.title("CogniLoad — Starting…")
    root.geometry("380x200")
    root.resizable(False, False)
    root.configure(bg="#1e1b4b")

    try:
        root.iconbitmap(BASE_DIR / "resources" / "icon.ico")
    except Exception:
        pass

    tk.Label(root, text="🧠  CogniLoad", font=("Segoe UI", 20, "bold"),
             bg="#1e1b4b", fg="#a5b4fc").pack(pady=(30, 4))
    tk.Label(root, text="Cognitive Load Detection", font=("Segoe UI", 11),
             bg="#1e1b4b", fg="#818cf8").pack()

    status_var = tk.StringVar(value="Starting backend…")
    tk.Label(root, textvariable=status_var, font=("Segoe UI", 9),
             bg="#1e1b4b", fg="#94a3b8").pack(pady=(20, 0))

    def _poll():
        if wait_for_backend(port, timeout=0.1):
            status_var.set("Ready! Opening app…")
            root.after(600, root.destroy)
        else:
            root.after(400, _poll)

    root.after(500, _poll)
    root.mainloop()


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

def main() -> None:
    global _backend_thread, _port

    parser = argparse.ArgumentParser(description="CogniLoad Windows App")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()

    _port = args.port

    # Prepare environment — creates .env if needed AND pins DATABASE_URL,
    # COGNILOAD_ENV_FILE etc. into os.environ before any backend import.
    ensure_env(args.port)

    # Apply any pending DB schema migrations (add missing tables/columns).
    # Must run after ensure_env() so DATABASE_URL is already pinned.
    run_migrations()

    # Start backend
    _backend_thread = start_backend(args.port)


    # Show splash window while waiting
    show_splash(args.port)

    # Check backend actually started
    if not wait_for_backend(args.port, timeout=30):
        if _backend_start_error:
            # Surface the real exception instead of a generic message.
            detail = _backend_start_error.strip().splitlines()[-1]
            messagebox.showerror(
                "CogniLoad — Error",
                "Backend failed to start:\n\n" + detail +
                f"\n\nFull traceback logged to:\n{DATA_DIR / 'backend_error.log'}"
            )
            (DATA_DIR / "backend_error.log").write_text(_backend_start_error, encoding="utf-8")
        else:
            messagebox.showerror(
                "CogniLoad — Error",
                "Backend failed to start within 30 seconds.\n"
                "Check that port 8000 is free and try again."
            )
        stop_backend()
        sys.exit(1)

    # Open the app in browser
    if not args.no_browser:
        webbrowser.open(f"http://127.0.0.1:{args.port}")

    # Run tray icon (blocks until user quits)
    if HAS_TRAY:
        run_tray(args.port)
    else:
        # Fallback: keep alive in main thread
        print("[APP] Running. Close this window or press Ctrl+C to quit.")
        try:
            _backend_thread.join()
        except KeyboardInterrupt:
            pass
        finally:
            stop_backend()


if __name__ == "__main__":
    main()