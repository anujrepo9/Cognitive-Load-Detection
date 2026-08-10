"""
secure_store.py — Secure storage of the API token.

On Windows, uses `keyring` which backs onto the Windows Credential Locker
(DPAPI). If keyring is not installed/available, falls back to a plaintext
local file (obfuscated with base64) so the collector still works offline.

Functions:
    save_token(token)  -> stores it
    load_token()       -> returns the token or ""
    delete_token()     -> removes it
"""

import base64
import os
from pathlib import Path

SERVICE = "CogniLoad"
USERNAME = "collector"
_FALLBACK_FILE = Path(__file__).resolve().parent / ".token_store"


def _keyring_available() -> bool:
    try:
        import keyring  # noqa: F401
        return True
    except ImportError:
        return False


def save_token(token: str) -> bool:
    """Persist the token. Returns True if stored via keyring (secure)."""
    if not token:
        return False
    if _keyring_available():
        try:
            import keyring
            keyring.set_password(SERVICE, USERNAME, token)
            return True
        except Exception:
            pass  # fall through to file backup

    _write_fallback(token)
    return False


def load_token() -> str:
    """Return the stored token, or '' if none."""
    if _keyring_available():
        try:
            import keyring
            token = keyring.get_password(SERVICE, USERNAME)
            if token:
                return token
        except Exception:
            pass
    return _read_fallback()


def delete_token() -> None:
    if _keyring_available():
        try:
            import keyring
            keyring.delete_password(SERVICE, USERNAME)
        except Exception:
            pass
    if _FALLBACK_FILE.exists():
        _FALLBACK_FILE.unlink()


# ── Fallback file (base64-obfuscated, NOT strong encryption) ─────────────────

def _write_fallback(token: str):
    _FALLBACK_FILE.write_bytes(base64.b64encode(token.encode("utf-8")))
    # Restrict access to the current user only (Windows + POSIX)
    try:
        import stat
        os.chmod(_FALLBACK_FILE, stat.S_IRUSR | stat.S_IWUSR)
    except OSError:
        pass


def _read_fallback() -> str:
    if not _FALLBACK_FILE.exists():
        return ""
    try:
        raw = _FALLBACK_FILE.read_bytes()
        return base64.b64decode(raw).decode("utf-8")
    except Exception:
        return ""
