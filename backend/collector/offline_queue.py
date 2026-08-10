"""
offline_queue.py — Persistent offline queue for buffering feature rows.

When the collector runs in offline_mode (or the backend is unreachable),
feature rows are appended to a JSONL file on disk so no data is lost.
On the next successful flush the queued rows are retried and removed.

Name note: this module is intentionally NOT called `queue.py` to avoid
shadowing Python's standard-library `queue` module (which libraries like
requests/urllib3 depend on).

Design:
    * Append-only JSON Lines file (one dict per line) → crash-safe.
    * Thread-safe via a lock.
    * `push()` appends a row.
    * `pop_all()` returns and atomically removes all pending rows.
    * `retry_failed()` re-appends rows that failed to send (back to queue).
"""

import json
import threading
from pathlib import Path
from typing import List


class PushQueue:
    """A minimal persistent FIFO-ish queue backed by a JSONL file."""

    def __init__(self, path=None):
        self.path = Path(path) if path else Path(__file__).resolve().parent / "pending_queue.jsonl"
        self._lock = threading.Lock()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        if not self.path.exists():
            self.path.touch(exist_ok=True)

    # ── Mutators ──────────────────────────────────────────────────────────────

    def push(self, row: dict) -> None:
        """Append a single feature row to the queue."""
        with self._lock:
            with open(self.path, "a", encoding="utf-8") as f:
                f.write(json.dumps(row) + "\n")

    def push_many(self, rows: list) -> None:
        """Append several rows atomically-ish (lock + single open)."""
        if not rows:
            return
        with self._lock:
            with open(self.path, "a", encoding="utf-8") as f:
                for row in rows:
                    f.write(json.dumps(row) + "\n")

    def pop_all(self) -> List[dict]:
        """
        Return all pending rows and clear the file.
        Reading + truncating is done under lock so no push is lost.
        """
        with self._lock:
            rows = self._read_all()
            if rows:
                # Truncate to empty
                self.path.write_text("", encoding="utf-8")
            return rows

    def retry_failed(self, rows: list) -> int:
        """Re-append previously fetched rows that failed to send."""
        if not rows:
            return 0
        self.push_many(rows)
        return len(rows)

    def clear(self) -> None:
        with self._lock:
            self.path.write_text("", encoding="utf-8")

    def pending_count(self) -> int:
        with self._lock:
            return len(self._read_all())

    # ── Internal ──────────────────────────────────────────────────────────────

    def _read_all(self) -> List[dict]:
        rows: List[dict] = []
        if not self.path.exists() or self.path.stat().st_size == 0:
            return rows
        with open(self.path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    rows.append(json.loads(line))
                except json.JSONDecodeError:
                    # Skip corrupt line rather than crash
                    continue
        return rows
