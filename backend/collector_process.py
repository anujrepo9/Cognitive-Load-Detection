"""
backend/collector_process.py

Starts/stops the Windows system-wide collector as a subprocess.
On Windows, WH_KEYBOARD_LL / WH_MOUSE_LL capture keyboard + mouse in ALL apps.
Import and call start()/stop() from routes/session.py.
"""

import os
import subprocess
import sys
import threading
import time
from pathlib import Path

_COLLECTOR_DIR  = Path(__file__).parent / "collector"
_COLLECTOR_MAIN = _COLLECTOR_DIR / "main.py"
_LOG_PATH       = _COLLECTOR_DIR / "collector.log"

_proc: subprocess.Popen | None = None
_lock = threading.Lock()
_last_start: dict = {}
_last_error: str | None = None


def last_error() -> str | None:
    return _last_error


def start(api_url: str, token: str, flush_interval: int = 15) -> bool:
    global _proc, _last_error, _last_start
    with _lock:
        if _proc is not None and _proc.poll() is None:
            _last_error = None
            return True

        _last_start = {
            "api_url": api_url,
            "token": token,
            "flush_interval": flush_interval,
        }

        if not _COLLECTOR_MAIN.exists():
            _last_error = f"collector main.py not found at {_COLLECTOR_MAIN}"
            print(f"[collector_process] ERROR: {_last_error}")
            return False

        cmd = [
            sys.executable,
            str(_COLLECTOR_MAIN),
            "--api-url",  api_url,
            "--token",    token,
            "--interval", str(flush_interval),
            "--online-predict",
        ]
        try:
            log_file = open(_LOG_PATH, "a", encoding="utf-8")
            log_file.write(
                f"\n--- collector start pid-pending {time.strftime('%Y-%m-%d %H:%M:%S')} ---\n"
            )
            log_file.flush()
            creationflags = 0
            if sys.platform == "win32":
                creationflags = subprocess.CREATE_NO_WINDOW
            _proc = subprocess.Popen(
                cmd,
                cwd=str(_COLLECTOR_DIR),
                stdout=log_file,
                stderr=subprocess.STDOUT,
                creationflags=creationflags,
                env={**os.environ},
            )
            time.sleep(0.6)
            if _proc.poll() is not None:
                _last_error = (
                    f"collector exited immediately (code {_proc.returncode}). "
                    f"See {_LOG_PATH}"
                )
                print(f"[collector_process] {_last_error}")
                _proc = None
                return False
            _last_error = None
            print(f"[collector_process] started PID={_proc.pid} — tracking ALL windows")
            return True
        except Exception as e:
            _last_error = str(e)
            print(f"[collector_process] failed to start: {e}")
            _proc = None
            return False


def stop() -> bool:
    global _proc
    with _lock:
        if _proc is None or _proc.poll() is not None:
            _proc = None
            return False
        try:
            _proc.terminate()
            try:
                _proc.wait(timeout=3)
            except subprocess.TimeoutExpired:
                _proc.kill()
            print("[collector_process] stopped")
        except Exception as e:
            print(f"[collector_process] stop error: {e}")
        finally:
            _proc = None
        return True


def is_running() -> bool:
    with _lock:
        return _proc is not None and _proc.poll() is None


def restart() -> bool:
    with _lock:
        args = dict(_last_start)
    if not args:
        return False
    stop()
    return start(**args)
