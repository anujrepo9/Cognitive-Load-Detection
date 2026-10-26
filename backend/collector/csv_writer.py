"""
csv_writer.py — Opens behavior_data.csv once and appends one row every flush.
Never rewrites the whole file. Safe for long-running sessions.
"""

import csv
import os
from pathlib import Path

COLUMNS = [
    "timestamp", "duration_s", "keys_pressed", "backspaces",
    "typing_wpm", "chars_per_min", "avg_hold_ms", "avg_flight_ms",
    "error_rate", "pause_count", "avg_pause_ms", "typing_variance",
    "avg_cursor_speed", "movement_distance", "click_rate", "double_click_rate",
    "scroll_rate", "idle_time_pct", "avg_hover_ms", "avg_acceleration",
    "movement_smoothness", "label",
]


class CSVWriter:
    def __init__(self, path: str = "output/behavior_data.csv"):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)

        file_exists = self.path.exists() and self.path.stat().st_size > 0

        # ── Migrate stale header if columns changed ───────────────────────
        if file_exists:
            with open(self.path, "r", newline="", encoding="utf-8") as f:
                existing_header = f.readline().strip().split(",")
            if existing_header != COLUMNS:
                # Rename old file, start fresh so header is always correct
                backup = self.path.with_suffix(".bak.csv")
                self.path.rename(backup)
                print(f"  [csv_writer] Column mismatch — old data backed up to {backup.name}")
                file_exists = False

        self._file = open(self.path, "a", newline="", encoding="utf-8")
        self._writer = csv.DictWriter(
            self._file, fieldnames=COLUMNS, extrasaction="ignore"
        )
        if not file_exists:
            self._writer.writeheader()
            self._file.flush()    

    def write(self, row: dict):
        """Append one summary row. Only the columns in COLUMNS are written."""
        self._writer.writerow(row)
        self._file.flush()   # ensure data hits disk without closing

    def close(self):
        self._file.close()

    # Context manager support
    def __enter__(self):
        return self

    def __exit__(self, *_):
        self.close()


class RawEventWriter:
    """Optional: write every raw event for debugging / research."""

    RAW_COLUMNS = ["timestamp_ms", "event_type", "value"]

    def __init__(self, path: str = "output/raw_events.csv"):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        file_exists = self.path.exists() and self.path.stat().st_size > 0
        self._file = open(self.path, "a", newline="", encoding="utf-8")
        self._writer = csv.DictWriter(self._file, fieldnames=self.RAW_COLUMNS)
        if not file_exists:
            self._writer.writeheader()
            self._file.flush()

    def write(self, event_type: str, value: str, timestamp_ms: float):
        self._writer.writerow({
            "timestamp_ms": round(timestamp_ms, 1),
            "event_type":   event_type,
            "value":        value,
        })
        # Raw events: flush every 50 rows to avoid too many syscalls
        if self._file.tell() % 50 == 0:
            self._file.flush()

    def close(self):
        self._file.flush()
        self._file.close()

    def __enter__(self):
        return self

    def __exit__(self, *_):
        self.close()


# ── App Usage CSV ─────────────────────────────────────────────────────────────

APP_USAGE_COLUMNS = [
    "session_id",       # backend session ID (empty when offline / not yet known)
    "flush_start",      # ISO timestamp — start of the flush window
    "flush_end",        # ISO timestamp — end of the flush window (≈ recorded_at)
    "process",          # e.g. "Code.exe", "chrome.exe", "steam.exe"
    "window_title",     # last seen window title for this process in the window
    "duration_sec",     # total foreground seconds within the flush window
]


class AppUsageCSVWriter:
    """
    Appends one row per app per flush window to app_usage.csv.

    Columns:
        flush_start   — window start (ISO 8601 UTC)
        flush_end     — window end   (ISO 8601 UTC)
        process       — process name reported by the OS
        window_title  — last active window title for this process
        duration_sec  — foreground seconds accumulated in this window

    Usage (mirrors CSVWriter):
        writer = AppUsageCSVWriter("output/app_usage.csv")
        writer.write(flush_start_iso, flush_end_iso, app_durations)
        writer.close()

        # or as a context manager:
        with AppUsageCSVWriter(...) as w:
            w.write(...)
    """

    def __init__(self, path: str = "output/app_usage.csv"):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)

        file_exists = self.path.exists() and self.path.stat().st_size > 0

        # Migrate if header changed
        if file_exists:
            with open(self.path, "r", newline="", encoding="utf-8") as f:
                existing_header = f.readline().strip().split(",")
            if existing_header != APP_USAGE_COLUMNS:
                backup = self.path.with_suffix(".bak.csv")
                self.path.rename(backup)
                print(f"  [app_usage_csv] Column mismatch — old data backed up to {backup.name}")
                file_exists = False

        self._file   = open(self.path, "a", newline="", encoding="utf-8")
        self._writer = csv.DictWriter(self._file, fieldnames=APP_USAGE_COLUMNS)
        if not file_exists:
            self._writer.writeheader()
            self._file.flush()

    def write(self, session_id: str, flush_start: str, flush_end: str, durations: list) -> None:
        """
        Append one row per AppDuration in `durations`.

        Args:
            flush_start: ISO 8601 string for the start of the flush window.
            flush_end:   ISO 8601 string for the end   of the flush window.
            durations:   list of AppDuration objects (from window_tracker).
        """
        for d in durations:
            if d.duration_sec <= 0:
                continue
            self._writer.writerow({
                "session_id":   session_id,
                "flush_start":  flush_start,
                "flush_end":    flush_end,
                "process":      d.process,
                "window_title": d.window_title or "",
                "duration_sec": round(d.duration_sec, 2),
            })
        self._file.flush()

    def close(self):
        self._file.close()

    def __enter__(self):
        return self

    def __exit__(self, *_):
        self.close()