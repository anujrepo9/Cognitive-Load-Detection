"""
main.py — Entry point for the behavioral data collector.

Pipeline:
    Keyboard + Mouse events
        → EventBuffer (RAM)
        → every FLUSH_INTERVAL_S seconds
        → metrics.calculate()
        → CSVWriter.write()          (local dataset)
        → API.send()                 (optional, live prediction)

Usage:
    python main.py                   # 5-second windows, no label prompts
    python main.py --interval 10     # 10-second windows
    python main.py --label           # ask for label every flush (dataset building)
    python main.py --raw             # also write raw_events.csv
    python main.py --api             # send to FastAPI for live predictions
"""

import argparse
import signal
import sys
import time
import threading

import requests

from buffer import EventBuffer
from keyboard_listener import KeyboardListener
from mouse_listener import MouseListener
from metrics import calculate
from csv_writer import CSVWriter, RawEventWriter


# ── Config ────────────────────────────────────────────────────────────────────

DEFAULT_INTERVAL = 5      # seconds per flush window
API_URL = "http://localhost:8000/behavior"
PREDICT_URL = "http://localhost:8000/predict"


# ── Helpers ───────────────────────────────────────────────────────────────────

def ask_label() -> str | None:
    """Non-blocking label prompt printed to terminal."""
    valid = {"l": "low", "m": "medium", "h": "high", "": None}
    try:
        raw = input("  Label this window [l=low / m=medium / h=high / Enter=skip]: ").strip().lower()
        return valid.get(raw, None)
    except (EOFError, KeyboardInterrupt):
        return None


def send_to_api(url: str, payload: dict):
    """Fire-and-forget POST to FastAPI."""
    try:
        requests.post(url, json=payload, timeout=3)
    except Exception:
        pass   # silently skip if backend isn't up


def print_row(row: dict):
    """Print a compact summary line to the terminal."""
    print(
        f"  [{row['timestamp']}]  "
        f"WPM={row['typing_wpm']:>3}  "
        f"Hold={row['avg_hold_ms']:>6} ms  "
        f"Error={row['error_rate']:.2%}  "
        f"Idle={row['idle_time_pct']:.0%}  "
        f"Speed={row['avg_cursor_speed']:>5} px/s  "
        f"label={row['label'] or '—'}"
    )


# ── Main flush loop ───────────────────────────────────────────────────────────

def flush_loop(
    buf: EventBuffer,
    csv_writer: CSVWriter,
    interval: float,
    with_label: bool,
    with_api: bool,
    stop_event: threading.Event,
):
    window_start = time.time()
    buf.set_window_start(window_start)

    while not stop_event.is_set():
        stop_event.wait(timeout=interval)
        now = time.time()
        elapsed = now - window_start

        # Snapshot + reset buffer
        state = buf.snapshot_and_reset(new_window_start=now)

        # Calculate features
        row = calculate(state, window_sec=elapsed)

        # Optional: ask user to label (for dataset building)
        if with_label:
            print()
            row["label"] = ask_label()

        # Write to CSV
        csv_writer.write(row)
        print_row(row)

        # Optional: send to FastAPI
        if with_api:
            payload = {k: v for k, v in row.items()
                       if k not in ("timestamp", "duration_s", "label")}
            send_to_api(API_URL, payload)

        window_start = now


# ── Entry point ───────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Cognitive Load Behavioral Collector")
    parser.add_argument("--interval", type=float, default=DEFAULT_INTERVAL,
                        help="Flush interval in seconds (default 5)")
    parser.add_argument("--label",  action="store_true",
                        help="Prompt for cognitive load label each window")
    parser.add_argument("--raw",    action="store_true",
                        help="Also write every raw event to raw_events.csv")
    parser.add_argument("--api",    action="store_true",
                        help="Send feature vectors to FastAPI backend")
    args = parser.parse_args()

    print("=" * 60)
    print("  CogniLoad — Behavioral Data Collector")
    print(f"  Flush interval : {args.interval}s")
    print(f"  Labels         : {'yes' if args.label else 'no'}")
    print(f"  Raw events     : {'yes' if args.raw else 'no'}")
    print(f"  API push       : {'yes' if args.api else 'no'}")
    print("  Press Ctrl+C to stop.")
    print("=" * 60)

    buf       = EventBuffer()
    stop      = threading.Event()
    raw_w     = RawEventWriter() if args.raw else None

    kb_listener  = KeyboardListener(buf, raw_writer=raw_w)
    ms_listener  = MouseListener(buf,   raw_writer=raw_w)

    with CSVWriter() as csv_w:
        # Start listeners in background threads
        kb_listener.start()
        ms_listener.start()

        # Flush loop runs on main thread
        def _sigint(sig, frame):
            print("\n  Stopping collector…")
            stop.set()

        signal.signal(signal.SIGINT, _sigint)

        try:
            flush_loop(buf, csv_w, args.interval, args.label, args.api, stop)
        finally:
            kb_listener.stop()
            ms_listener.stop()
            if raw_w:
                raw_w.close()
            print(f"\n  Data saved → output/behavior_data.csv")
            if args.raw:
                print(f"  Raw events → output/raw_events.csv")


if __name__ == "__main__":
    main()
