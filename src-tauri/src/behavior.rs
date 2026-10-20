// behavior.rs — Behavior flush + history commands
//
// The frontend calls flush_behavior() on a timer (every flush_interval_sec).
// Rust reads the metrics snapshot from the collector, writes it to SQLite,
// then triggers predict_load automatically.
//
// Commands:
//   flush_behavior(token, session_id) → BehaviorRecord
//   get_behavior_history(token, session_id, limit) → Vec<BehaviorRecord>

use rusqlite::params;
use serde::{Deserialize, Serialize};

use crate::auth::{decode_access_token, JwtSecret};
use crate::collector::CollectorState;
use crate::db::{open, DbPath};

/// The 17-feature payload — mirrors the DB columns and the ML feature order.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct BehaviorPayload {
    // Keyboard — None means "no keystrokes in this window" → stored as SQL NULL
    pub typing_wpm:          Option<f64>,
    pub chars_per_min:       f64,
    pub avg_hold_ms:         f64,
    pub avg_flight_ms:       f64,
    pub error_rate:          f64,
    pub pause_count:         f64,
    pub avg_pause_ms:        f64,
    pub typing_variance:     f64,
    // Mouse
    pub avg_cursor_speed:    f64,
    pub movement_distance:   f64,
    pub click_rate:          f64,
    pub double_click_rate:   f64,
    pub scroll_rate:         f64,
    pub idle_time_pct:       f64,
    pub avg_hover_ms:        f64,
    pub avg_acceleration:    f64,
    pub movement_smoothness: f64,
}

#[derive(Serialize)]
pub struct BehaviorRecord {
    pub id:         i64,
    pub session_id: i64,
    pub timestamp:  String,
    #[serde(flatten)]
    pub payload:    BehaviorPayload,
    /// Raw key-press count for this flush window (not stored in DB, for UI only)
    pub raw_key_presses:  u64,
    /// Raw mouse click count for this flush window (not stored in DB, for UI only)
    pub raw_mouse_clicks: u64,
}

// ── Commands ───────────────────────────────────────────────────────────────────

/// Called by the frontend on a timer. Drains the collector snapshot → SQLite.
#[tauri::command]
pub async fn flush_behavior(
    state:     tauri::State<'_, DbPath>,
    collector: tauri::State<'_, CollectorState>,
    jwt:       tauri::State<'_, JwtSecret>,
    token:     String,
    session_id: i64,
) -> Result<BehaviorRecord, String> {
    decode_access_token(&token, &jwt.0)?; // auth check

    // Drain and compute metrics from the in-memory collector state
    let (payload, raw_key_presses, raw_mouse_clicks) = collector.drain_and_compute();

    let conn = open(&state.0).map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO behavior_data (
            session_id, timestamp,
            typing_wpm, chars_per_min, avg_hold_ms, avg_flight_ms,
            error_rate, pause_count, avg_pause_ms, typing_variance,
            avg_cursor_speed, movement_distance, click_rate, double_click_rate,
            scroll_rate, idle_time_pct, avg_hover_ms, avg_acceleration, movement_smoothness
         ) VALUES (
            ?1, datetime('now'),
            ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9,
            ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18
         )",
        params![
            session_id,
            payload.typing_wpm,    // Option<f64>: None → SQL NULL, Some(v) → integer
            payload.chars_per_min, payload.avg_hold_ms,
            payload.avg_flight_ms, payload.error_rate,    payload.pause_count,
            payload.avg_pause_ms,  payload.typing_variance,
            payload.avg_cursor_speed, payload.movement_distance, payload.click_rate,
            payload.double_click_rate, payload.scroll_rate, payload.idle_time_pct,
            payload.avg_hover_ms,  payload.avg_acceleration, payload.movement_smoothness,
        ],
    )
    .map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();

    let mut stmt = conn
        .prepare(
            "SELECT id, session_id, timestamp,
                    typing_wpm, chars_per_min, avg_hold_ms, avg_flight_ms,
                    error_rate, pause_count, avg_pause_ms, typing_variance,
                    avg_cursor_speed, movement_distance, click_rate, double_click_rate,
                    scroll_rate, idle_time_pct, avg_hover_ms, avg_acceleration,
                    movement_smoothness
             FROM behavior_data WHERE id = ?1",
        )
        .map_err(|e| e.to_string())?;

    let mut record = stmt
        .query_row(params![id], row_to_record)
        .map_err(|e| e.to_string())?;

    // Attach the raw counts that were drained from the collector this window.
    // These are NOT stored in the DB (they're ephemeral per-flush counts) but
    // the JS reads them from the returned record to populate the UI stat cards.
    record.raw_key_presses  = raw_key_presses;
    record.raw_mouse_clicks = raw_mouse_clicks;

    Ok(record)
}

#[tauri::command]
pub async fn get_behavior_history(
    state:      tauri::State<'_, DbPath>,
    jwt:        tauri::State<'_, JwtSecret>,
    token:      String,
    session_id: i64,
    limit:      Option<i64>,
) -> Result<Vec<BehaviorRecord>, String> {
    decode_access_token(&token, &jwt.0)?;
    let conn  = open(&state.0).map_err(|e| e.to_string())?;
    let limit = limit.unwrap_or(50);

    let mut stmt = conn
        .prepare(
            "SELECT id, session_id, timestamp,
                    typing_wpm, chars_per_min, avg_hold_ms, avg_flight_ms,
                    error_rate, pause_count, avg_pause_ms, typing_variance,
                    avg_cursor_speed, movement_distance, click_rate, double_click_rate,
                    scroll_rate, idle_time_pct, avg_hover_ms, avg_acceleration,
                    movement_smoothness
             FROM behavior_data
             WHERE session_id = ?1
             ORDER BY timestamp DESC LIMIT ?2",
        )
        .map_err(|e| e.to_string())?;

    let records = stmt
        .query_map(params![session_id, limit], row_to_record)
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(records)
}

// ── Row helper ─────────────────────────────────────────────────────────────────

fn row_to_record(row: &rusqlite::Row<'_>) -> rusqlite::Result<BehaviorRecord> {
    Ok(BehaviorRecord {
        id:         row.get(0)?,
        session_id: row.get(1)?,
        timestamp:  row.get(2)?,
        payload: BehaviorPayload {
            typing_wpm:          row.get(3)?,
            chars_per_min:       row.get(4)?,
            avg_hold_ms:         row.get(5)?,
            avg_flight_ms:       row.get(6)?,
            error_rate:          row.get(7)?,
            pause_count:         row.get(8)?,
            avg_pause_ms:        row.get(9)?,
            typing_variance:     row.get(10)?,
            avg_cursor_speed:    row.get(11)?,
            movement_distance:   row.get(12)?,
            click_rate:          row.get(13)?,
            double_click_rate:   row.get(14)?,
            scroll_rate:         row.get(15)?,
            idle_time_pct:       row.get(16)?,
            avg_hover_ms:        row.get(17)?,
            avg_acceleration:    row.get(18)?,
            movement_smoothness: row.get(19)?,
        },
        // Raw counts are not stored in the DB; only flush_behavior fills them
        // from the live collector drain. History reads always get 0 here.
        raw_key_presses:  0,
        raw_mouse_clicks: 0,
    })
}