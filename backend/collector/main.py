"""
main.py — Entry point for the behavioral data collector.

Pipeline:
    Keyboard + Mouse events
        → EventBuffer (RAM)
        → every flush_interval seconds
        → metrics.calculate()
        → CSVWriter.write()          (local dataset)
        → PushQueue + API.send()     (offline-buffered live prediction)

Phase 4 features:
    * Config file (collector_config.json) + CLI overrides
    * Persistent offline queue with retry
    * Secure token storage (keyring/DPAPI)
    * Windows autostart (registry Run key)
    * `--daemon` mode (no console window via pythonw)
    * Optional tray icon (pystray)
    * Mouse hover-time + path / acceleration tracking

Usage:
    python main.py                          # default config
    python main.py --interval 10
    python main.py --config path/to/config.json
    python main.py --api-url http://host:8000 --token <JWT>
    python main.py --offline                # queue locally, never push
    python main.py --daemon                 # background, no console
    python main.py --start-on-login         # register autostart
"""

import argparse
import json
import os
import signal
import sys
import threading
import time

import requests

from buffer import EventBuffer
from keyboard_listener import KeyboardListener
from mouse_listener import MouseListener
from metrics import calculate
from csv_writer import CSVWriter, RawEventWriter
from config import CollectorConfig, load_config, save_config
from offline_queue import PushQueue
import secure_store
import autostart

# ── Feature columns sent to the API (excludes metadata + label) ──────────────
# NOTE: backend BehaviorPayload currently has 16 features. `avg_acceleration`
# is logged to CSV but not yet part of the API schema.
API_FEATURES = [
    "typing_wpm", "chars_per_min", "avg_hold_ms", "avg_flight_ms",
    "error_rate", "pause_count", "avg_pause_ms", "typing_variance",
    "avg_cursor_speed", "movement_distance", "click_rate", "double_click_rate",
    "scroll_rate", "idle_time_pct", "avg_hover_ms", "movement_smoothness",
]


# ── Helpers ───────────────────────────────────────────────────────────────────

def ask_label() -> str | None:
    """Non-blocking label prompt printed to terminal."""
    valid = {"l": "low", "m": "medium", "h": "high", "": None}
    try:
        raw = input("  Label this window [l=low / m=medium / h=high / Enter=skip]: ").strip().lower()
        return valid.get(raw, None)
    except (EOFError, KeyboardInterrupt):
        return None


def build_payload(row: dict) -> dict:
    """Extract only the API feature fields (drop metadata/label)."""
    return {k: row.get(k, 0) for k in API_FEATURES}


def send_rows_to_api(rows: list, cfg: CollectorConfig) -> tuple[list, list]:
    """
    Attempt to POST each feature row to the backend.
    Returns (successes, failures) where failures are rows that must be retried.
    """
    successes, failures = [], []
    headers = {"Content-Type": "application/json"}
    if cfg.api_token:
        headers["Authorization"] = f"Bearer {cfg.api_token}"

    for row in rows:
        payload = build_payload(row)
        try:
            resp = requests.post(cfg.behavior_url, json=payload,
                                 headers=headers, timeout=5)
            if resp.status_code in (200, 201):
                successes.append(row)
            elif resp.status_code == 401:
                # Token invalid/expired — keep for retry, flag token issue
                print("  [api] 401 — token rejected. Check your token.")
                failures.append(row)
            else:
                print(f"  [api] HTTP {resp.status_code}")
                failures.append(row)
        except requests.RequestException:
            # Network / backend unreachable → keep for retry
            failures.append(row)
    return successes, failures


def print_row(row: dict):
    """Print a compact summary line to the terminal."""
    print(
        f"  [{row['timestamp']}]  "
        f"WPM={row['typing_wpm']:>3}  "
        f"Hold={row['avg_hold_ms']:>6} ms  "
        f"Error={row['error_rate']:.2%}  "
        f"Idle={row['idle_time_pct']:.0%}  "
        f"Speed={row['avg_cursor_speed']:>5} px/s  "
        f"Hover={row['avg_hover_ms']:>5} ms  "
        f"Accel={row.get('avg_acceleration', 0):>6}  "
        f"label={row['label'] or '—'}"
    )


# ── Main flush loop ───────────────────────────────────────────────────────────

def flush_loop(
    buf: EventBuffer,
    csv_writer: CSVWriter,
    queue: PushQueue,
    cfg: CollectorConfig,
    with_label: bool,
    stop_event: threading.Event,
):
    window_start = time.time()
    buf.set_window_start(window_start)
    interval = cfg.flush_interval

    while not stop_event.is_set():
        stop_event.wait(timeout=interval)
        now = time.time()
        elapsed = now - window_start

        state = buf.snapshot_and_reset(new_window_start=now)
        row = calculate(state, window_sec=elapsed)

        if with_label:
            print()
            row["label"] = ask_label()

        # Always write to local CSV (dataset building + offline record)
        csv_writer.write(row)
        print_row(row)

        # If offline mode, just queue locally
        if cfg.offline_mode:
            queue.push(build_payload(row))
        else:
            # Try to flush any previously queued rows + this new row
            pending = queue.pop_all()
            pending.append(build_payload(row))
            _, failures = send_rows_to_api(pending, cfg)
            if failures:
                queue.retry_failed(failures)

        window_start = now


# ── Tray icon (optional) ─────────────────────────────────────────────────────

def _start_tray(stop_event: threading.Event):
    """Launch a pystray tray icon; non-fatal if unavailable."""
    try:
        from pystray import Icon, Menu, MenuItem
        from PIL import Image, ImageDraw

        def make_image():
            img = Image.new("RGB", (64, 64), "black")
            d = ImageDraw.Draw(img)
            d.ellipse([8, 8, 56, 56], fill="dodgerblue")
            return img

        def on_quit(icon, item):
            icon.stop()
            stop_event.set()

        icon = Icon(
            "CogniLoad",
            make_image(),
            menu=Menu(
                MenuItem("Quit CogniLoad", on_quit),
            ),
        )
        icon.run()
    except Exception as e:  # pragma: no cover
        print(f"  [tray] unavailable: {e}")


# ── Entry point ───────────────────────────────────────────────────────────────

def parse_args(argv=None):
    parser = argparse.ArgumentParser(description="Cognitive Load Behavioral Collector")
    parser.add_argument("--interval", type=float, default=None,
                        help="Flush interval in seconds (default from config: 15)")
    parser.add_argument("--config", type=str, default=None,
                        help="Path to collector_config.json")
    parser.add_argument("--api-url", type=str, default=None,
                        help="Backend base URL (e.g. http://localhost:8000)")
    parser.add_argument("--token", type=str, default=None,
                        help="JWT access token for API auth")
    parser.add_argument("--offline", action="store_true",
                        help="Run in offline mode (queue locally, no push)")
    parser.add_argument("--daemon", action="store_true",
                        help="Run as background process (no console on Windows)")
    parser.add_argument("--start-on-login", action="store_true",
                        help="Register Windows autostart entry")
    parser.add_argument("--stop-on-login", action="store_true",
                        help="Remove Windows autostart entry")
    parser.add_argument("--label", action="store_true",
                        help="Prompt for cognitive load label each window")
    parser.add_argument("--raw", action="store_true",
                        help="Also write every raw event to raw_events.csv")
    parser.add_argument("--online-predict", action="store_true",
                        help="Also send to /predict for a live prediction")
    parser.add_argument("--tray", action="store_true",
                        help="Show a system tray icon (requires pystray)")
    parser.add_argument("--save-token", type=str, default=None,
                        help="Securely store a JWT token and exit")
    return parser.parse_args(argv)


def main(argv=None):
    args = parse_args(argv)

    # Handle standalone token-store command
    if args.save_token:
        secure_store.save_token(args.save_token)
        print("  Token saved.")
        return

    # Load config (file + env), then apply CLI overrides
    cfg = load_config(args.config)
    if args.interval is not None:
        cfg.flush_interval = args.interval
    if args.api_url is not None:
        cfg.api_url = args.api_url
    if args.token is not None:
        cfg.api_token = args.token
    else:
        cfg.api_token = cfg.api_token or secure_store.load_token()
    if args.offline:
        cfg.offline_mode = True
    if args.daemon:
        cfg.daemon = True
    if args.start_on_login:
        cfg.start_on_login = True

    # Autostart handling
    if args.stop_on_login:
        ok = autostart.disable_autostart()
        print(f"  Autostart {'removed' if ok else 'not present / unavailable'}.")
        return
    if cfg.start_on_login:
        ok = autostart.enable_autostart()
        print(f"  Autostart {'enabled' if ok else 'failed / unavailable'}.")

    # Re-save config so a subsequent run picks up CLI choices
    save_config(cfg, args.config)

    print("=" * 60)
    print("  CogniLoad — Behavioral Data Collector")
    print(f"  Flush interval : {cfg.flush_interval}s")
    print(f"  API URL        : {cfg.behavior_url}")
    print(f"  Offline mode   : {'yes' if cfg.offline_mode else 'no'}")
    print(f"  Labels         : {'yes' if args.label else 'no'}")
    print(f"  Raw events     : {'yes' if args.raw else 'no'}")
    print(f"  Daemon         : {'yes' if cfg.daemon else 'no'}")
    print(f"  Online predict : {'yes' if args.online_predict else 'no'}")
    print("  Press Ctrl+C to stop.")
    print("=" * 60)

    buf   = EventBuffer()
    stop  = threading.Event()
    queue = PushQueue()
    raw_w = RawEventWriter() if args.raw else None

    kb_listener = KeyboardListener(buf, raw_writer=raw_w)
    ms_listener = MouseListener(buf,   raw_writer=raw_w)

    with CSVWriter() as csv_w:
        kb_listener.start()
        ms_listener.start()

        # Optional tray icon thread
        tray_thread = None
        if args.tray:
            tray_thread = threading.Thread(target=_start_tray, args=(stop,), daemon=True)
            tray_thread.start()

        def _sigint(sig, frame):
            print("\n  Stopping collector…")
            stop.set()

        # In daemon mode we don't attach a Ctrl+C handler (no console anyway)
        if not cfg.daemon:
            signal.signal(signal.SIGINT, _sigint)

        try:
            flush_loop(buf, csv_w, queue, cfg, args.label, stop)
        finally:
            kb_listener.stop()
            ms_listener.stop()
            if raw_w:
                raw_w.close()
            # Final retry of anything still queued
            if not cfg.offline_mode:
                pending = queue.pop_all()
                if pending:
                    _, failures = send_rows_to_api(pending, cfg)
                    if failures:
                        queue.retry_failed(failures)
            print(f"\n  Data saved → output/behavior_data.csv")
            print(f"  Pending queue rows → {queue.pending_count()}")
            if args.raw:
                print(f"  Raw events → output/raw_events.csv")


if __name__ == "__main__":
    main()
