"""
keyboard_listener.py — Captures keydown / keyup events via pynput.
Computes hold time and flight time, then pushes KeyEvent into the buffer.
"""

import time
import threading
from pynput import keyboard as kb

from buffer import EventBuffer, KeyEvent

# Idle threshold: if no key pressed for this many seconds → mark idle
IDLE_THRESHOLD_S = 2.0


class KeyboardListener:
    def __init__(self, buffer: EventBuffer, raw_writer=None):
        self._buf   = buffer
        self._raw   = raw_writer
        self._down: dict[str, float] = {}   # key → press time (epoch s)
        self._last_up: float | None  = None  # epoch s of last keyup
        self._idle_timer: threading.Timer | None = None
        self._listener = kb.Listener(
            on_press=self._on_press,
            on_release=self._on_release,
            suppress=False,
        )

    # ── pynput callbacks ──────────────────────────────────────────────────────

    def _on_press(self, key: kb.Key | kb.KeyCode):
        now = time.time()
        key_str = self._key_to_str(key)

        # Cancel any pending idle timer — user is active
        self._cancel_idle()
        self._buf.mark_active(now)

        self._down[key_str] = now

        if self._raw:
            self._raw.write("keydown", key_str, now * 1000)

    def _on_release(self, key: kb.Key | kb.KeyCode):
        now = time.time()
        key_str = self._key_to_str(key)

        press_time = self._down.pop(key_str, None)
        if press_time is None:
            return   # missed the press (e.g. started mid-session)

        hold_ms    = (now - press_time) * 1000
        flight_ms  = (press_time - self._last_up) * 1000 if self._last_up else None
        self._last_up = now

        self._buf.add_key(KeyEvent(
            key=key_str,
            hold_ms=round(hold_ms, 2),
            flight_ms=round(flight_ms, 2) if flight_ms is not None else None,
            is_backspace=(key == kb.Key.backspace),
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
    def _key_to_str(key) -> str:
        # Normalize the space key to a plain space character so that
        # metrics.py can count words via `k.key == " "` correctly.
        if key == kb.Key.space:
            return " "
        try:
            return key.char or str(key)
        except AttributeError:
            return str(key)
