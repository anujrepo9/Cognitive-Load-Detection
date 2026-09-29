"""
window_tracker.py — Tracks the active window title + process name system-wide.

Polls every 0.5 s and emits a WindowFocusEvent into the buffer whenever the
active window changes.  Supported platforms:
  - Windows  : win32gui / win32process
  - macOS    : AppKit / Quartz
  - Linux/X11: xprop / wmctrl (subprocess fallback)

Import and start this alongside KeyboardListener / MouseListener in main.py.
"""

import sys
import time
import threading
from dataclasses import dataclass, field


# ── Data class ────────────────────────────────────────────────────────────────

@dataclass
class WindowFocusEvent:
    title:      str
    process:    str
    timestamp:  float          # epoch ms


# ── Platform helpers ──────────────────────────────────────────────────────────

def _get_active_window_windows():
    """Return (title, process_name) on Windows using ctypes (no pywin32 required)."""
    try:
        import ctypes
        from ctypes import wintypes

        user32 = ctypes.WinDLL("user32", use_last_error=True)
        hwnd = user32.GetForegroundWindow()
        if not hwnd:
            return "", "unknown"
        length = user32.GetWindowTextLengthW(hwnd) + 1
        buf = ctypes.create_unicode_buffer(length)
        user32.GetWindowTextW(hwnd, buf, length)
        title = buf.value or ""
        pid = wintypes.DWORD()
        user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
        process = "unknown"
        if pid.value:
            try:
                import psutil
                process = psutil.Process(pid.value).name()
            except Exception:
                process = f"pid-{pid.value}"
        return title, process
    except Exception:
        return "", "unknown"


def _get_active_window_mac():
    """Return (title, process_name) on macOS via AppKit."""
    try:
        from AppKit import NSWorkspace
        ws = NSWorkspace.sharedWorkspace()
        app = ws.frontmostApplication()
        process = app.localizedName() or "unknown"
        title = process   # window title needs Quartz — process name is enough
        try:
            import Quartz
            wins = Quartz.CGWindowListCopyWindowInfo(
                Quartz.kCGWindowListOptionOnScreenOnly |
                Quartz.kCGWindowListExcludeDesktopElements,
                Quartz.kCGNullWindowID,
            )
            for w in wins:
                if w.get("kCGWindowOwnerName") == process and w.get("kCGWindowName"):
                    title = w["kCGWindowName"]
                    break
        except Exception:
            pass
        return title, process
    except Exception:
        return "", "unknown"


def _get_active_window_linux():
    """Return (title, process_name) on Linux via xdotool / xprop (subprocess)."""
    import subprocess
    try:
        # xdotool is the most reliable single tool
        wid = subprocess.check_output(
            ["xdotool", "getactivewindow"], stderr=subprocess.DEVNULL
        ).decode().strip()
        title = subprocess.check_output(
            ["xdotool", "getwindowname", wid], stderr=subprocess.DEVNULL
        ).decode().strip()
        pid_raw = subprocess.check_output(
            ["xdotool", "getwindowpid", wid], stderr=subprocess.DEVNULL
        ).decode().strip()
        process = "unknown"
        if pid_raw.isdigit():
            try:
                import psutil
                process = psutil.Process(int(pid_raw)).name()
            except Exception:
                with open(f"/proc/{pid_raw}/comm") as f:
                    process = f.read().strip()
        return title, process
    except Exception:
        pass

    # Fallback: xprop
    try:
        wid = subprocess.check_output(
            ["xprop", "-root", "_NET_ACTIVE_WINDOW"], stderr=subprocess.DEVNULL
        ).decode()
        wid = wid.split()[-1]
        raw = subprocess.check_output(
            ["xprop", "-id", wid, "WM_NAME"], stderr=subprocess.DEVNULL
        ).decode()
        title = raw.split("=", 1)[-1].strip().strip('"')
        return title, "unknown"
    except Exception:
        return "", "unknown"


# Pick the platform implementation once at import time
if sys.platform == "win32":
    _get_active_window = _get_active_window_windows
elif sys.platform == "darwin":
    _get_active_window = _get_active_window_mac
else:
    _get_active_window = _get_active_window_linux


# ── Tracker class ─────────────────────────────────────────────────────────────

POLL_INTERVAL_S = 0.5    # how often to check the active window


class WindowTracker:
    """
    Polls the OS for the active window at POLL_INTERVAL_S intervals.
    On every change it:
      1. Emits a WindowFocusEvent into the EventBuffer.
      2. Calls an optional on_change callback(title, process).

    The buffer is expected to have an add_window_focus(event) method.
    If it doesn't (older buffer), events are silently dropped.
    """

    def __init__(self, buffer, on_change=None):
        self._buf        = buffer
        self._on_change  = on_change
        self._last_title = None
        self._last_proc  = None
        self._stop       = threading.Event()
        self._thread     = threading.Thread(target=self._run, name="window-tracker", daemon=True)

    def start(self):
        self._thread.start()

    def stop(self):
        self._stop.set()
        self._thread.join(timeout=2)

    def _run(self):
        while not self._stop.is_set():
            try:
                title, process = _get_active_window()
                if title != self._last_title or process != self._last_proc:
                    self._last_title = title
                    self._last_proc  = process
                    ev = WindowFocusEvent(
                        title=title,
                        process=process,
                        timestamp=time.time() * 1000,
                    )
                    # Push to buffer if supported
                    if hasattr(self._buf, "add_window_focus"):
                        self._buf.add_window_focus(ev)
                    # Call optional hook (e.g. for logging / CSV)
                    if self._on_change:
                        self._on_change(title, process)
            except Exception:
                pass   # never crash the tracker thread
            self._stop.wait(POLL_INTERVAL_S)