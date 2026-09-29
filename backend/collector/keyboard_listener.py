"""
keyboard_listener.py — Captures keydown / keyup events system-wide.

On Windows this uses WH_KEYBOARD_LL (every application). Elsewhere it uses
pynput. Key *characters* are never stored — only timing and a coarse class.
"""

import sys
import time
import threading

from buffer import EventBuffer, KeyEvent

# Idle threshold: if no key pressed for this many seconds → mark idle
IDLE_THRESHOLD_S = 2.0


class KeyboardListener:
    def __init__(self, buffer: EventBuffer, raw_writer=None):
        self._buf   = buffer
        self._raw   = raw_writer
        self._down: dict[str, float] = {}   # key class → press time (epoch s)
        self._last_up: float | None  = None  # epoch s of last keyup
        self._idle_timer: threading.Timer | None = None
        self._listener = None
        if sys.platform == "win32":
            from win32_input import Win32KeyboardHook
            self._listener = Win32KeyboardHook(self._on_press, self._on_release)
        else:
            from pynput import keyboard as kb
            self._listener = kb.Listener(
                on_press=self._on_press,
                on_release=self._on_release,
                suppress=False,
            )

    # ── pynput callbacks ──────────────────────────────────────────────────────

    def _on_press(self, key):
        now = time.time()
        key_str = self._key_to_str(key)
        down_id = self._down_id(key, key_str)

        # Ignore auto-repeat while the key is already held
        if down_id in self._down:
            return

        # Cancel any pending idle timer — user is active
        self._cancel_idle()
        self._buf.mark_active(now)

        self._down[down_id] = now

        if self._raw:
            self._raw.write("keydown", key_str, now * 1000)

    def _on_release(self, key):
        now = time.time()
        key_str = self._key_to_str(key)
        down_id = self._down_id(key, key_str)

        press_time = self._down.pop(down_id, None)
        if press_time is None:
            return   # missed the press (e.g. started mid-session)

        hold_ms    = (now - press_time) * 1000
        flight_ms  = (press_time - self._last_up) * 1000 if self._last_up else None
        self._last_up = now

        self._buf.add_key(KeyEvent(
            key=key_str,
            hold_ms=round(hold_ms, 2),
            flight_ms=round(flight_ms, 2) if flight_ms is not None else None,
            is_backspace=(key_str == "backspace"),
            timestamp=now * 1000,
        ))

        if self._raw:
            self._raw.write("keyup", key_str, now * 1000)

        # Schedule idle detection
        self._schedule_idle(now)

    # ── Idle helpers ──────────────────────────────────────────────────────────

    def _schedule_idle(self, last_active: float):
        self._cancel_idle()
        self._idle_timer = threading.Timer(
            IDLE_THRESHOLD_S,
            lambda: self._buf.mark_idle_start(last_active + IDLE_THRESHOLD_S),
        )
        self._idle_timer.daemon = True
        self._idle_timer.start()

    def _cancel_idle(self):
        if self._idle_timer:
            self._idle_timer.cancel()
            self._idle_timer = None

    # ── Lifecycle ─────────────────────────────────────────────────────────────

    def start(self):
        self._listener.start()

    def stop(self):
        self._cancel_idle()
        self._listener.stop()

    # ── Helpers ───────────────────────────────────────────────────────────────

    @staticmethod
    def _down_id(key, key_str: str) -> str:
        vk = getattr(key, "vk", None)
        if vk:
            return f"vk-{vk}"
        return key_str

    @staticmethod
    def _key_to_str(key) -> str:
        """Map a key to a privacy-safe class. Never return the typed character."""
        kind = getattr(key, "kind", None)
        if kind == "space":
            return " "
        if kind in ("backspace", "printable", "other"):
            return kind
        try:
            from pynput import keyboard as kb
            if key == kb.Key.space:
                return " "
            if key == kb.Key.backspace:
                return "backspace"
        except Exception:
            pass
        try:
            if getattr(key, "char", None):
                return "printable"
        except Exception:
            pass
        return "other"
