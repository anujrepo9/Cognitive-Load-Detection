"""
test_collector.py — Fast unit tests (no pynput required).
Tests buffer thread-safety, metric calculation, and CSV writing.

Run: python test_collector.py
"""

import os, sys, time, threading, csv, tempfile
sys.path.insert(0, os.path.dirname(__file__))

from buffer import EventBuffer, KeyEvent, MouseMoveEvent, MouseHoverEvent
from metrics import calculate
from csv_writer import CSVWriter
from offline_queue import PushQueue
from config import CollectorConfig, load_config, save_config
import secure_store


# ── Buffer tests ──────────────────────────────────────────────────────────────

def test_key_events():
    buf = EventBuffer()
    buf.set_window_start(time.time())

    buf.add_key(KeyEvent("a",  hold_ms=100, flight_ms=None,  is_backspace=False, timestamp=0))
    buf.add_key(KeyEvent("b",  hold_ms=120, flight_ms=80,    is_backspace=False, timestamp=100))
    buf.add_key(KeyEvent("\b", hold_ms=90,  flight_ms=70,    is_backspace=True,  timestamp=200))

    snap = buf.snapshot_and_reset(time.time())
    assert len(snap.key_events) == 3
    assert snap.key_events[2].is_backspace
    print("  ✓ key events stored correctly")

def test_mouse_events():
    buf = EventBuffer()
    buf.set_window_start(time.time())

    buf.add_mouse_move(MouseMoveEvent(100, 200, speed_px_s=300.0, distance_px=50.0, timestamp=0))
    buf.add_mouse_move(MouseMoveEvent(150, 250, speed_px_s=280.0, distance_px=70.0, timestamp=50))
    buf.add_click(double=False)
    buf.add_click(double=True)
    buf.add_scroll(3.0)

    snap = buf.snapshot_and_reset(time.time())
    assert len(snap.mouse_moves) == 2
    assert snap.clicks == 2
    assert snap.double_clicks == 1
    assert snap.scrolls == 1
    print("  ✓ mouse events stored correctly")

def test_thread_safety():
    buf = EventBuffer()
    buf.set_window_start(time.time())
    results = []

    def writer():
        for i in range(100):
            buf.add_key(KeyEvent(str(i), hold_ms=100, flight_ms=80,
                                 is_backspace=False, timestamp=i))

    threads = [threading.Thread(target=writer) for _ in range(5)]
    for t in threads: t.start()
    for t in threads: t.join()

    snap = buf.snapshot_and_reset(time.time())
    assert len(snap.key_events) == 500, f"Expected 500, got {len(snap.key_events)}"
    print("  ✓ thread-safe (500 events from 5 threads)")


# ── Metrics tests ─────────────────────────────────────────────────────────────

def _make_state():
    from buffer import BufferState
    s = BufferState(window_start=time.time())
    # Simulate typing: 30 keys in 5 seconds → ~6 wpm (with 6 spaces)
    keys = []
    for i in range(30):
        ch = " " if i % 5 == 0 else chr(ord("a") + i % 26)
        keys.append(KeyEvent(ch, hold_ms=100 + i, flight_ms=80 + i,
                             is_backspace=(i == 10), timestamp=i * 166))
    s.key_events = keys
    s.mouse_moves = [
        MouseMoveEvent(i*10, i*5, speed_px_s=200 + i*5, distance_px=10.0, timestamp=i*1000)
        for i in range(10)
    ]
    s.clicks = 4
    s.scrolls = 3
    s.idle_total_ms = 800
    return s

def test_metrics_keys():
    row = calculate(_make_state(), window_sec=5.0)
    assert row["keys_pressed"] == 30
    assert row["backspaces"] == 1
    assert 0 <= row["error_rate"] <= 1
    assert row["avg_hold_ms"] > 0
    assert row["avg_flight_ms"] > 0
    print(f"  ✓ keyboard metrics  WPM={row['typing_wpm']}  hold={row['avg_hold_ms']}ms")

def test_metrics_mouse():
    row = calculate(_make_state(), window_sec=5.0)
    assert row["avg_cursor_speed"] > 0
    assert row["click_rate"] > 0
    assert 0.1 <= row["movement_smoothness"] <= 1.0
    assert 0 <= row["idle_time_pct"] <= 0.95
    print(f"  ✓ mouse metrics  speed={row['avg_cursor_speed']}px/s  smooth={row['movement_smoothness']}")

def test_metrics_empty():
    from buffer import BufferState
    row = calculate(BufferState(), window_sec=5.0)
    assert row["typing_wpm"] == 0
    assert row["avg_cursor_speed"] == 0
    print("  ✓ empty buffer returns zero-filled metrics")


# ── CSV writer tests ──────────────────────────────────────────────────────────

def test_csv_write():
    with tempfile.TemporaryDirectory() as td:
        path = os.path.join(td, "test.csv")
        w = CSVWriter(path)

        row = calculate(_make_state(), window_sec=5.0)
        row["label"] = "medium"
        w.write(row)
        w.write(row)
        w.close()

        with open(path) as f:
            rows = list(csv.DictReader(f))
        assert len(rows) == 2
        assert rows[0]["label"] == "medium"
        print(f"  ✓ CSV write: 2 rows, headers correct")


# ── Phase 4: hover + acceleration metrics ─────────────────────────────────────

def test_metrics_hover_accel():
    from buffer import BufferState
    s = BufferState(window_start=time.time())
    # Two hovers
    s.hovers = [
        MouseHoverEvent(duration_ms=250.0, timestamp=0),
        MouseHoverEvent(duration_ms=350.0, timestamp=100),
    ]
    # Three moves with increasing speed → positive acceleration
    s.mouse_moves = [
        MouseMoveEvent(0, 0, speed_px_s=100.0, distance_px=10.0, timestamp=0),
        MouseMoveEvent(10, 0, speed_px_s=200.0, distance_px=10.0, timestamp=1000),
        MouseMoveEvent(20, 0, speed_px_s=300.0, distance_px=10.0, timestamp=2000),
    ]
    row = calculate(s, window_sec=5.0)
    assert row["avg_hover_ms"] == 300.0, f"Expected 300, got {row['avg_hover_ms']}"
    assert row["avg_acceleration"] > 0,  f"Expected >0 accel, got {row['avg_acceleration']}"
    print(f"  ✓ hover={row['avg_hover_ms']}ms  accel={row['avg_acceleration']}px/s²")


def test_metrics_hover_empty():
    from buffer import BufferState
    row = calculate(BufferState(), window_sec=5.0)
    assert row["avg_hover_ms"] == 0.0
    assert row["avg_acceleration"] == 0.0
    print("  ✓ empty buffer → hover=0, accel=0")


# ── Phase 4: offline queue ────────────────────────────────────────────────────

def test_queue_push_pop():
    with tempfile.TemporaryDirectory() as td:
        q = PushQueue(os.path.join(td, "q.jsonl"))
        q.push({"a": 1})
        q.push({"b": 2})
        assert q.pending_count() == 2
        rows = q.pop_all()
        assert len(rows) == 2
        assert q.pending_count() == 0
        print("  ✓ queue push/pop")


def test_queue_retry_failed():
    with tempfile.TemporaryDirectory() as td:
        q = PushQueue(os.path.join(td, "q.jsonl"))
        q.push({"a": 1})
        fetched = q.pop_all()
        assert len(fetched) == 1
        q.retry_failed(fetched)  # simulate a failed send
        assert q.pending_count() == 1
        print("  ✓ queue retry_failed")


def test_queue_persistence():
    with tempfile.TemporaryDirectory() as td:
        path = os.path.join(td, "q.jsonl")
        q = PushQueue(path)
        q.push({"x": 5})
        q.push({"y": 6})
        # Re-open the same file (simulating a restart)
        q2 = PushQueue(path)
        assert q2.pending_count() == 2
        print("  ✓ queue persists across restarts")


# ── Phase 4: config ───────────────────────────────────────────────────────────

def test_config_roundtrip():
    with tempfile.TemporaryDirectory() as td:
        path = os.path.join(td, "cfg.json")
        cfg = CollectorConfig(flush_interval=30, api_url="http://x:9000",
                              offline_mode=True)
        save_config(cfg, path)
        loaded = load_config(path)
        assert loaded.flush_interval == 30
        assert loaded.api_url == "http://x:9000"
        assert loaded.offline_mode is True
        print("  ✓ config save/load roundtrip")


def test_config_defaults():
    cfg = CollectorConfig()
    assert cfg.flush_interval == 15
    assert cfg.behavior_url == "http://localhost:8000/behavior"
    print("  ✓ config defaults")


# ── Phase 4: secure store ─────────────────────────────────────────────────────

def test_secure_store_roundtrip():
    # Use a temp fallback file so we don't touch the real token store
    from pathlib import Path as _P
    import tempfile as _t
    with _t.TemporaryDirectory() as td:
        old = secure_store._FALLBACK_FILE
        secure_store._FALLBACK_FILE = _P(td) / "tok"
        try:
            secure_store.save_token("secret.jwt.token")
            assert secure_store.load_token() == "secret.jwt.token"
            secure_store.delete_token()
            assert secure_store.load_token() == ""
        finally:
            secure_store._FALLBACK_FILE = old
    print("  ✓ secure store roundtrip")


# ── Run all ───────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    tests = [
        ("Buffer: key events",    test_key_events),
        ("Buffer: mouse events",  test_mouse_events),
        ("Buffer: thread safety", test_thread_safety),
        ("Metrics: keyboard",     test_metrics_keys),
        ("Metrics: mouse",        test_metrics_mouse),
        ("Metrics: empty buffer", test_metrics_empty),
        ("Metrics: hover+accel",  test_metrics_hover_accel),
        ("Metrics: hover empty",  test_metrics_hover_empty),
        ("Queue: push/pop",       test_queue_push_pop),
        ("Queue: retry_failed",   test_queue_retry_failed),
        ("Queue: persistence",    test_queue_persistence),
        ("Config: roundtrip",     test_config_roundtrip),
        ("Config: defaults",      test_config_defaults),
        ("Secure store",          test_secure_store_roundtrip),
        ("CSV writer",            test_csv_write),
    ]
    passed = failed = 0
    for name, fn in tests:
        print(f"\n{name}")
        try:
            fn()
            passed += 1
        except Exception as e:
            print(f"  ✗ FAILED: {e}")
            failed += 1

    print(f"\n{'='*40}")
    print(f"  {passed} passed · {failed} failed")
    print(f"{'='*40}")
    sys.exit(1 if failed else 0)
