r"""
autostart.py — Register/unregister the collector to launch on Windows login.

Uses the HKCU\Software\Microsoft\Windows\CurrentVersion\Run registry key so no
admin rights are needed. On non-Windows platforms (or if winreg is unavailable)
all functions degrade gracefully to no-ops / False.

Methods:
    enable_autostart(script)  -> adds a Run entry
    disable_autostart()       -> removes the entry
    is_autostart_enabled()    -> bool
"""

import sys
import os
from pathlib import Path

RUN_KEY = r"Software\Microsoft\Windows\CurrentVersion\Run"
APP_NAME = "CogniLoadCollector"

IS_WINDOWS = sys.platform.startswith("win")


def _registry():
    """Return (winreg, key_handle) or (None, None) if unavailable."""
    if not IS_WINDOWS:
        return None, None
    try:
        import winreg
        key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, RUN_KEY, 0, winreg.KEY_SET_VALUE)
        return winreg, key
    except ImportError:
        return None, None
    except OSError:
        return None, None


def _collector_command() -> str:
    """Build the command line that launches the collector as a background daemon."""
    main_py = Path(__file__).resolve().parent / "main.py"
    # `pythonw.exe` runs without a console window on Windows
    python_dir = Path(sys.executable).parent
    pythonw = python_dir / "pythonw.exe"
    exe = str(pythonw) if pythonw.exists() else sys.executable
    return f'"{exe}" "{main_py}"'


def enable_autostart(command: str | None = None) -> bool:
    """Register the collector to start on login. Returns True on success."""
    if not IS_WINDOWS:
        return False
    try:
        import winreg
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, RUN_KEY, 0, winreg.KEY_SET_VALUE) as key:
            winreg.SetValueEx(key, APP_NAME, 0, winreg.REG_SZ, command or _collector_command())
        return True
    except (ImportError, OSError):
        return False


def disable_autostart() -> bool:
    """Remove the autostart entry. Returns True if removed."""
    if not IS_WINDOWS:
        return False
    try:
        import winreg
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, RUN_KEY, 0, winreg.KEY_SET_VALUE) as key:
            winreg.DeleteValue(key, APP_NAME)
        return True
    except (ImportError, OSError):
        return False


def is_autostart_enabled() -> bool:
    """Return True if an autostart entry exists."""
    if not IS_WINDOWS:
        return False
    try:
        import winreg
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, RUN_KEY, 0, winreg.KEY_QUERY_VALUE) as key:
            winreg.QueryValueEx(key, APP_NAME)
        return True
    except (ImportError, OSError):
        return False
