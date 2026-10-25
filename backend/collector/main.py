"""
main.py — Entry point for the behavioral data collector.

Pipeline:
    Keyboard + Mouse events (system-wide via pynput)
    + Window focus events   (system-wide via WindowTracker)
        → EventBuffer (RAM)
        → every flush_interval seconds
        → metrics.calculate()
        → CSVWriter.write()          (local dataset)
        → PushQueue + API.send()     (offline-buffered live prediction)
        → AppUsage API.send()        (per-app foreground duration)

Usage:
    python main.py                          # default config
    python main.py --interval 10
    python main.py --config path/to/config.json
    python main.py --api-url http://host:8000 --token <JWT>
    python main.py --offline                # queue locally, never push
    python main.py --daemon                 # background, no console
    python main.py --start-on-login         # register autostart
    python main.py --no-window-tracker      # disable active-window tracking
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
from window_tracker import WindowTracker
from metrics import calculate
from csv_writer import CSVWriter, RawEventWriter
from config import CollectorConfig, load_config, save_config
from offline_queue import PushQueue
import secure_store
import autostart
from pathlib import Path

# When launched by the desktop app, COGNILOAD_DATA_DIR points at a writable
# folder. The install dir (Program Files / PyInstaller bundle) is not writable.
_DATA_DIR = Path(os.environ["COGNILOAD_DATA_DIR"]) if os.environ.get("COGNILOAD_DATA_DIR") else None

# ── Feature columns sent to the API ──────────────────────────────────────────
API_FEATURES = [
    "typing_wpm", "chars_per_min", "avg_hold_ms", "avg_flight_ms",
    "error_rate", "pause_count", "avg_pause_ms", "typing_variance",
    "avg_cursor_speed", "movement_distance", "click_rate", "double_click_rate",
    "scroll_rate", "idle_time_pct", "avg_hover_ms", "avg_acceleration",
    "movement_smoothness",
]

_INT_FIELDS = {"chars_per_min", "pause_count", "avg_pause_ms"}


# ── Helpers ───────────────────────────────────────────────────────────────────

def ask_label() -> str | None:
    valid = {"l": "low", "m": "medium", "h": "high", "": None}
    try:
        raw = input("  Label this window [l=low / m=medium / h=high / Enter=skip]: ").strip().lower()
        return valid.get(raw, None)
    except (EOFError, KeyboardInterrupt):
        return None


def build_payload(row: dict) -> dict:
    payload = {}
    for k in API_FEATURES:
        val = row.get(k, 0)
        if k == "typing_wpm":
            payload[k] = int(val) if val is not None else None
        elif k in _INT_FIELDS:
            payload[k] = int(val) if val is not None else 0
        else:
            payload[k] = float(val) if val is not None else 0.0
    # Display-only counts for the live dashboard
    payload["keys_pressed"] = int(row.get("keys_pressed", 0) or 0)
    payload["mouse_events"] = int(row.get("mouse_events", 0) or 0)
    return payload


def send_rows_to_api(rows: list, cfg: CollectorConfig) -> tuple[list, list]:
    successes, failures = [], []
    headers = {"Content-Type": "application/json"}
    if cfg.api_token:
        headers["Authorization"] = f"Bearer {cfg.api_token}"
    url = cfg.predict_url if cfg.online_predict else cfg.behavior_url
    _printed_err = False
    for row in rows:
        payload = build_payload(row)
        try:
            resp = requests.post(url, json=payload, headers=headers, timeout=5)
            if resp.status_code in (200, 201):
                successes.append(row)
            elif resp.status_code == 401:
                if not _printed_err:
                    print("  [api] 401 — token rejected. Check your token.", flush=True)
                    _printed_err = True
                failures.append(row)
            else:
                if not _printed_err:
                    print(f"  [api] HTTP {resp.status_code} {url} {resp.text[:200]}", flush=True)
                    _printed_err = True
                failures.append(row)
        except requests.RequestException as exc:
            if not _printed_err:
                print(f"  [api] request failed: {exc}", flush=True)
                _printed_err = True
            failures.append(row)
    if successes:
        print(f"  [api] sent {len(successes)} row(s) OK -> {url}", flush=True)
    if failures:
        print(f"  [api] {len(failures)} row(s) failed, queued for retry", flush=True)
    return successes, failures


def send_app_usage_to_api(durations: list, cfg: CollectorConfig) -> None:
    """POST per-app foreground durations to /api/app-usage for the current flush window."""
    if not durations:
        return
    headers = {"Content-Type": "application/json"}
    if cfg.api_token:
        headers["Authorization"] = f"Bearer {cfg.api_token}"

    url = f"{cfg.api_url.rstrip('/')}/app-usage"
    payload = {
        "usages": [
            {
                "process":      d.process,
                "window_title": d.window_title,
                "duration_sec": round(d.duration_sec, 2),
            }
            for d in durations
        ]
    }
    try:
        resp = requests.post(url, json=payload, headers=headers, timeout=5)
        if resp.status_code not in (200, 201):
            print(f"  [api] app-usage HTTP {resp.status_code}: {resp.text[:120]}", flush=True)
    except requests.RequestException as exc:
        print(f"  [api] app-usage request failed: {exc}", flush=True)


def print_row(row: dict):
    wpm_str = f"{row['typing_wpm']:>3}" if row["typing_wpm"] is not None else "  —"
    active_win = row.get("active_window", "")
    win_str = f"  Window={active_win[:30]!r}" if active_win else ""
    print(
        f"  [{row['timestamp']}]  "
        f"WPM={wpm_str}  "
        f"Hold={row['avg_hold_ms']:>6} ms  "
        f"Error={row['error_rate']:.2%}  "
        f"Idle={row['idle_time_pct']:.0%}  "
        f"Speed={row['avg_cursor_speed']:>5} px/s  "
        f"Hover={row['avg_hover_ms']:>5} ms  "
        f"Accel={row.get('avg_acceleration', 0):>6}  "
        f"label={row['label'] or '—'}"
        f"{win_str}"
    )


# ── Flush loop ────────────────────────────────────────────────────────────────

def flush_loop(
    buf: EventBuffer,
    csv_writer: CSVWriter,
    queue: PushQueue,
    cfg: CollectorConfig,
    with_label: bool,
    stop_event: threading.Event,
    win_tracker: WindowTracker | None,
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

        # Attach most-recent active window info (from window_events in state)
        if state.window_events:
            last = state.window_events[-1]
            row["active_window"]  = last.title
            row["active_process"] = last.process
        elif win_tracker is not None:
            row["active_window"]  = getattr(win_tracker, "_last_title", "") or ""
            row["active_process"] = getattr(win_tracker, "_last_proc",  "") or ""
        else:
            row["active_window"]  = ""
            row["active_process"] = ""

        # Drain per-app durations from the tracker for this flush window
        app_durations = win_tracker.drain_app_durations() if win_tracker else []

        if with_label:
            print()
            row["label"] = ask_label()

        csv_writer.write(row)
        print_row(row)

        # Print top apps to console
        if app_durations:
            top = sorted(app_durations, key=lambda d: d.duration_sec, reverse=True)
            print(
                "  [apps] " + ", ".join(
                    f"{d.process}={d.duration_sec:.1f}s" for d in top[:5]
                ),
                flush=True,
            )

        if cfg.offline_mode:
            queue.push(build_payload(row))
        else:
            pending = queue.pop_all()
            pending.append(build_payload(row))
            _, failures = send_rows_to_api(pending, cfg)
            if failures:
                queue.retry_failed(failures)
            # Send app usage (best-effort — not queued on failure)
            send_app_usage_to_api(app_durations, cfg)

        window_start = now


# ── Tray icon (optional) ──────────────────────────────────────────────────────

def _start_tray(stop_event: threading.Event):
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
            menu=Menu(MenuItem("Quit CogniLoad", on_quit)),
        )
        icon.run()
    except Exception as e:
        print(f"  [tray] unavailable: {e}")


# ── Entry point ───────────────────────────────────────────────────────────────

def parse_args(argv=None):
    parser = argparse.ArgumentParser(description="Cognitive Load Behavioral Collector")
    parser.add_argument("--interval",        type=float, default=None)
    parser.add_argument("--config",          type=str,   default=None)
    parser.add_argument("--api-url",         type=str,   default=None)
    parser.add_argument("--token",           type=str,   default=None)
    parser.add_argument("--offline",         action="store_true")
    parser.add_argument("--daemon",          action="store_true")
    parser.add_argument("--start-on-login",  action="store_true")
    parser.add_argument("--stop-on-login",   action="store_true")
    parser.add_argument("--label",           action="store_true")
    parser.add_argument("--raw",             action="store_true")
    parser.add_argument("--online-predict",  action="store_true")
    parser.add_argument("--tray",            action="store_true")
    parser.add_argument("--save-token",      type=str, default=None)
    parser.add_argument(
        "--no-window-tracker",
        action="store_true",
        help="Disable system-wide active-window tracking",
    )
    return parser.parse_args(argv)


def main(argv=None):
    args = parse_args(argv)

    if args.save_token:
        secure_store.save_token(args.save_token)
        print("  Token saved.")
        return

    if args.config is None and _DATA_DIR:
        args.config = str(_DATA_DIR / "collector_config.json")
    cfg = load_config(args.config)
    if args.interval  is not None: cfg.flush_interval = args.interval
    if args.api_url   is not None: cfg.api_url = args.api_url
    if args.token     is not None: cfg.api_token = args.token
    else: cfg.api_token = cfg.api_token or secure_store.load_token()
    if args.offline:        cfg.offline_mode = True
    if args.daemon:         cfg.daemon = True
    if args.start_on_login: cfg.start_on_login = True
    if args.online_predict: cfg.online_predict = True

    if args.stop_on_login:
        ok = autostart.disable_autostart()
        print(f"  Autostart {'removed' if ok else 'not present / unavailable'}.")
        return
    if cfg.start_on_login:
        ok = autostart.enable_autostart()
        print(f"  Autostart {'enabled' if ok else 'failed / unavailable'}.")

    save_config(cfg, args.config)

    use_win_tracker = not args.no_window_tracker

    print("=" * 60)
    print("  CogniLoad — Behavioral Data Collector")
    print(f"  Flush interval    : {cfg.flush_interval}s")
    print(f"  API URL           : {cfg.behavior_url}")
    print(f"  Offline mode      : {'yes' if cfg.offline_mode else 'no'}")
    print(f"  Live predict      : {'yes (/predict)' if cfg.online_predict else 'no (/behavior)'}")
    print(f"  Labels            : {'yes' if args.label else 'no'}")
    print(f"  Raw events        : {'yes' if args.raw else 'no'}")
    print(f"  Daemon            : {'yes' if cfg.daemon else 'no'}")
    print(f"  Window tracker    : {'yes (system-wide)' if use_win_tracker else 'no'}")
    print("  Tracking: keyboard + mouse across ALL apps and windows.")
    print("  Press Ctrl+C to stop.")
    print("=" * 60)

    buf   = EventBuffer()
    stop  = threading.Event()
    queue = PushQueue(str(_DATA_DIR / "pending_queue.jsonl")) if _DATA_DIR else PushQueue()
    raw_w = RawEventWriter(str(_DATA_DIR / "output" / "raw_events.csv")) if (args.raw and _DATA_DIR) else (RawEventWriter() if args.raw else None)

    kb_listener  = KeyboardListener(buf, raw_writer=raw_w)
    ms_listener  = MouseListener(buf,   raw_writer=raw_w)
    win_tracker  = WindowTracker(buf) if use_win_tracker else None

    with (CSVWriter(str(_DATA_DIR / "output" / "behavior_data.csv")) if _DATA_DIR else CSVWriter()) as csv_w:
        kb_listener.start()
        ms_listener.start()
        if win_tracker:
            win_tracker.start()

        tray_thread = None
        if args.tray:
            tray_thread = threading.Thread(
                target=_start_tray, args=(stop,), daemon=True
            )
            tray_thread.start()

        def _sigint(sig, frame):
            print("\n  Stopping collector…")
            stop.set()

        if not cfg.daemon:
            signal.signal(signal.SIGINT, _sigint)

        try:
            flush_loop(buf, csv_w, queue, cfg, args.label, stop, win_tracker)
        finally:
            kb_listener.stop()
            ms_listener.stop()
            if win_tracker:
                win_tracker.stop()
            if raw_w:
                raw_w.close()
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