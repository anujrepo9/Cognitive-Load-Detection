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
import webbrowser
import tkinter as tk
from tkinter import messagebox
from pathlib import Path

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
_backend_proc: subprocess.Popen | None = None
_tray_icon = None
_port = 8000


# ─────────────────────────────────────────────────────────────────────────────
# Environment / config helpers
# ─────────────────────────────────────────────────────────────────────────────

def ensure_env(port: int) -> None:
    """Create .env in user data dir if it doesn't exist."""
    if ENV_FILE.exists():
        return

    db_path = (DATA_DIR / "cogniload.db").as_posix()
    model_path = (MODEL_DIR / "model.joblib").as_posix()

    content = f"""# CogniLoad — auto-generated configuration
DATABASE_URL=sqlite:///{db_path}
SECRET_KEY=change-me-in-production-use-a-long-random-string
MODEL_PATH={model_path}
HOST=127.0.0.1
PORT={port}
STATIC_DIR={DIST_DIR.as_posix()}
"""
    ENV_FILE.write_text(content)
    print(f"[ENV] Created {ENV_FILE}")


# ─────────────────────────────────────────────────────────────────────────────
# Backend process management
# ─────────────────────────────────────────────────────────────────────────────

def start_backend(port: int) -> subprocess.Popen:
    """Launch uvicorn in a subprocess."""
    env = os.environ.copy()
    env["COGNILOAD_ENV_FILE"] = str(ENV_FILE)
    env["COGNILOAD_STATIC_DIR"] = str(DIST_DIR)

    cmd = [
        sys.executable, "-m", "uvicorn", "main:app",
        "--host", "127.0.0.1",
        "--port", str(port),
        "--no-access-log",
    ]

    print(f"[BACKEND] Starting on http://127.0.0.1:{port}")

    # On Windows, hide the console window for the subprocess
    kwargs = {}
    if platform.system() == "Windows":
        kwargs["creationflags"] = subprocess.CREATE_NO_WINDOW

    proc = subprocess.Popen(
        cmd,
        cwd=str(BACKEND_DIR),
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        **kwargs,
    )
    return proc


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
    global _backend_proc
    if _backend_proc and _backend_proc.poll() is None:
        print("[BACKEND] Stopping…")
        _backend_proc.terminate()
        try:
            _backend_proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            _backend_proc.kill()
        _backend_proc = None


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
    global _backend_proc, _port

    parser = argparse.ArgumentParser(description="CogniLoad Windows App")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()

    _port = args.port

    # Prepare environment
    ensure_env(args.port)

    # Start backend
    _backend_proc = start_backend(args.port)

    # Show splash window while waiting
    show_splash(args.port)

    # Check backend actually started
    if not wait_for_backend(args.port, timeout=30):
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
            _backend_proc.wait()
        except KeyboardInterrupt:
            pass
        finally:
            stop_backend()


if __name__ == "__main__":
    main()
