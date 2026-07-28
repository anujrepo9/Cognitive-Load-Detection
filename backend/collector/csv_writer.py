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
    "scroll_rate", "idle_time_pct", "avg_hover_ms", "movement_smoothness",
    "label",
]


class CSVWriter:
    def __init__(self, path: str = "output/behavior_data.csv"):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)

        file_exists = self.path.exists() and self.path.stat().st_size > 0

        # Open once in append mode — stays open for the whole session
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
