// collector.rs — Native Windows input collection (replaces Python pynput collector)
//
// Uses `rdev` which hooks into Windows raw-input APIs directly (no subprocess).
// All metrics are accumulated in a Mutex<RawMetrics> buffer.
// When flush_behavior calls drain_and_compute(), the buffer is reset to zero.
//
// Exported:
//   CollectorState          — managed Tauri state
//   run(AppHandle)          — called from main.rs setup in a dedicated thread
//   set_tracking_enabled    — Tauri command
//   get_tracking_status     — Tauri command

use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use std::time::{Duration, Instant};

use rdev::{listen, Event, EventType, Key};
use serde::Serialize;
use tauri::{AppHandle, Manager};

use crate::behavior::BehaviorPayload;

// ── Raw accumulator ────────────────────────────────────────────────────────────

#[derive(Default)]
struct RawMetrics {
    // Keyboard
    key_presses:     u64,
    chars_typed:     u64,
    backspaces:      u64,
    hold_ms_sum:     f64,
    hold_count:      u64,
    flight_ms_sum:   f64,
    flight_count:    u64,
    pause_count:     u64,    // gaps > 500 ms between keystrokes
    pause_ms_sum:    f64,
    ipi_ms_vec:      Vec<f64>, // inter-press intervals for variance

    // Mouse
    last_mouse_pos:  Option<(f64, f64)>,
    distance_px:     f64,
    speed_sum:       f64,
    speed_count:     u64,
    accel_sum:       f64,
    accel_count:     u64,
    clicks:          u64,
    double_clicks:   u64,
    scrolls:         u64,
    hover_ms_sum:    f64,
    hover_count:     u64,
    smoothness_sum:  f64,
    smoothness_count:u64,

    // Timing
    start_time:      Option<Instant>,
    last_key_time:   Option<Instant>,
    last_mouse_time: Option<Instant>,
    last_key_down:   Option<Instant>,
    idle_ms:         f64,
    last_event_time: Option<Instant>,
}

/// Shared state exposed as Tauri managed state.
pub struct CollectorState {
    metrics:  Mutex<RawMetrics>,
    tracking: Arc<AtomicBool>,
}

impl CollectorState {
    fn new(tracking: Arc<AtomicBool>) -> Self {
        Self {
            metrics: Mutex::new(RawMetrics {
                start_time: Some(Instant::now()),
                ..Default::default()
            }),
            tracking,
        }
    }

    /// Drain accumulated raw events → compute 17 normalised features → reset buffer.
    pub fn drain_and_compute(&self) -> BehaviorPayload {
        let mut m = self.metrics
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());

        let elapsed_secs = m
            .start_time
            .map(|t| t.elapsed().as_secs_f64())
            .unwrap_or(1.0)
            .max(1.0);

        let elapsed_min = elapsed_secs / 60.0;

        // ── Keyboard ──────────────────────────────────────────────────────────
        // typing_wpm is None when no characters were typed this window — the DB
        // column and the ML model both expect NULL rather than 0 for "no data".
        let typing_wpm = if m.chars_typed > 0 {
            Some((m.chars_typed as f64 / 5.0) / elapsed_min)
        } else {
            None
        };
        let chars_per_min   = m.chars_typed as f64 / elapsed_min;
        let avg_hold_ms     = if m.hold_count   > 0 { m.hold_ms_sum   / m.hold_count   as f64 } else { 0.0 };
        let avg_flight_ms   = if m.flight_count > 0 { m.flight_ms_sum / m.flight_count as f64 } else { 0.0 };
        let error_rate      = if m.key_presses  > 0 { m.backspaces    as f64 / m.key_presses as f64 } else { 0.0 };
        let pause_count     = m.pause_count as f64;
        let avg_pause_ms    = if m.pause_count  > 0 { m.pause_ms_sum  / m.pause_count  as f64 } else { 0.0 };

        // variance of inter-press intervals
        let typing_variance = if m.ipi_ms_vec.len() > 1 {
            let mean = m.ipi_ms_vec.iter().sum::<f64>() / m.ipi_ms_vec.len() as f64;
            m.ipi_ms_vec.iter().map(|x| (x - mean).powi(2)).sum::<f64>()
                / m.ipi_ms_vec.len() as f64
        } else {
            0.0
        };

        // ── Mouse ─────────────────────────────────────────────────────────────
        let avg_cursor_speed    = if m.speed_count        > 0 { m.speed_sum        / m.speed_count        as f64 } else { 0.0 };
        let movement_distance   = m.distance_px;
        let click_rate          = m.clicks        as f64 / elapsed_min;
        let double_click_rate   = m.double_clicks as f64 / elapsed_min;
        let scroll_rate         = m.scrolls       as f64 / elapsed_min;
        let avg_acceleration    = if m.accel_count        > 0 { m.accel_sum        / m.accel_count        as f64 } else { 0.0 };
        let avg_hover_ms        = if m.hover_count        > 0 { m.hover_ms_sum     / m.hover_count        as f64 } else { 0.0 };
        let movement_smoothness = if m.smoothness_count   > 0 { m.smoothness_sum   / m.smoothness_count   as f64 } else { 0.0 };
        let idle_time_pct       = m.idle_ms / (elapsed_secs * 1000.0) * 100.0;

        // ── Reset ─────────────────────────────────────────────────────────────
        *m = RawMetrics {
            start_time: Some(Instant::now()),
            ..Default::default()
        };

        BehaviorPayload {
            typing_wpm,
            chars_per_min,
            avg_hold_ms,
            avg_flight_ms,
            error_rate,
            pause_count,
            avg_pause_ms,
            typing_variance,
            avg_cursor_speed,
            movement_distance,
            click_rate,
            double_click_rate,
            scroll_rate,
            idle_time_pct,
            avg_hover_ms,
            avg_acceleration,
            movement_smoothness,
        }
    }
}

// ── Entry point (run in dedicated OS thread, NOT tokio) ───────────────────────

// Module-level static for double-click detection — must live outside the closure
// because a static defined inside a non-Sync closure is unsound.
//
// FIX (Bug 4): Use unwrap_or_else(|p| p.into_inner()) everywhere this mutex is
// locked so that a panic inside the listen closure does not permanently poison
// the static and break all future double-click detection.
static LAST_CLICK: Mutex<Option<Instant>> = Mutex::new(None);

pub fn run(app: AppHandle) {
    let tracking = Arc::new(AtomicBool::new(true));
    let state    = CollectorState::new(Arc::clone(&tracking));
    app.manage(state);

    // rdev::listen blocks forever; closures receive every input event.
    // We get a reference to the managed state via AppHandle.
    let _ = listen(move |event: Event| {
        // Skip if tracking paused
        let col: tauri::State<'_, CollectorState> = app.state();
        if !col.tracking.load(Ordering::Relaxed) {
            return;
        }

        let mut m = col.metrics
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let now   = Instant::now();

        // Track idle time: if > 2 s gap since last event, count as idle
        if let Some(last) = m.last_event_time {
            let gap_ms = last.elapsed().as_secs_f64() * 1000.0;
            if gap_ms > 2000.0 {
                m.idle_ms += gap_ms;
            }
        }
        m.last_event_time = Some(now);

        match event.event_type {
            // ── Keyboard ───────────────────────────────────────────────────
            EventType::KeyPress(key) => {
                m.key_presses += 1;

                // IPI (inter-press interval)
                if let Some(last) = m.last_key_time {
                    let ipi_ms = last.elapsed().as_secs_f64() * 1000.0;
                    // Pause detection: > 500 ms gap
                    if ipi_ms > 500.0 {
                        m.pause_count += 1;
                        m.pause_ms_sum += ipi_ms;
                    }
                    m.ipi_ms_vec.push(ipi_ms);
                    // Flight time = time from last key-up to this key-down
                    m.flight_ms_sum += ipi_ms;
                    m.flight_count  += 1;
                }
                m.last_key_time  = Some(now);
                m.last_key_down  = Some(now);

                // Count printable chars + backspace errors
                match key {
                    Key::Backspace => { m.backspaces += 1; }
                    Key::Return | Key::Tab => {}
                    _ => { m.chars_typed += 1; }
                }
            }

            EventType::KeyRelease(_) => {
                // Hold time = key-down → key-up
                if let Some(down) = m.last_key_down {
                    let hold_ms = down.elapsed().as_secs_f64() * 1000.0;
                    m.hold_ms_sum  += hold_ms;
                    m.hold_count   += 1;
                    m.last_key_down = None;
                }
            }

            // ── Mouse move ────────────────────────────────────────────────
            EventType::MouseMove { x, y } => {
                let (fx, fy) = (x as f64, y as f64);

                // Snapshot old position and time BEFORE overwriting them
                let prev_pos  = m.last_mouse_pos;
                let prev_time = m.last_mouse_time;

                if let Some((px, py)) = prev_pos {
                    let dx   = fx - px;
                    let dy   = fy - py;
                    let dist = (dx * dx + dy * dy).sqrt();
                    m.distance_px += dist;

                    if let Some(last_t) = prev_time {
                        let dt_s = last_t.elapsed().as_secs_f64().max(0.001);
                        let speed = dist / dt_s;
                        m.speed_sum    += speed;
                        m.speed_count  += 1;

                        // Acceleration: Δspeed / Δt
                        if m.speed_count > 1 {
                            let prev_speed = m.speed_sum / (m.speed_count - 1) as f64;
                            let accel = (speed - prev_speed).abs() / dt_s;
                            m.accel_sum   += accel;
                            m.accel_count += 1;
                        }

                        // Smoothness approximation via inverse distance change
                        m.smoothness_sum   += 1.0 / (1.0 + dist.max(0.01));
                        m.smoothness_count += 1;

                        // Hover: cursor barely moved — measure dwell from last event
                        if dist < 5.0 {
                            let dwell_ms = dt_s * 1000.0;
                            if dwell_ms > 200.0 {
                                m.hover_ms_sum += dwell_ms;
                                m.hover_count  += 1;
                            }
                        }
                    }
                }

                m.last_mouse_pos  = Some((fx, fy));
                m.last_mouse_time = Some(now);
            }

            // ── Mouse buttons ─────────────────────────────────────────────
            EventType::ButtonPress(_) => {
                m.clicks += 1;
                // Naive double-click: two clicks within 400 ms
                // (rdev doesn't expose double-click natively)
                //
                // FIX (Bug 4): recover from mutex poison instead of panicking.
                let mut lc = LAST_CLICK
                    .lock()
                    .unwrap_or_else(|poisoned| poisoned.into_inner());
                if let Some(prev) = *lc {
                    if prev.elapsed() < Duration::from_millis(400) {
                        m.double_clicks += 1;
                    }
                }
                *lc = Some(now);
            }

            EventType::Wheel { .. } => {
                m.scrolls += 1;
            }

            _ => {}
        }
    });
}

// ── Control commands ───────────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct TrackingStatus {
    pub enabled: bool,
}

#[tauri::command]
pub fn set_tracking_enabled(
    state:   tauri::State<'_, CollectorState>,
    enabled: bool,
) {
    state.tracking.store(enabled, Ordering::Relaxed);
}

#[tauri::command]
pub fn get_tracking_status(
    state: tauri::State<'_, CollectorState>,
) -> TrackingStatus {
    TrackingStatus {
        enabled: state.tracking.load(Ordering::Relaxed),
    }
}
