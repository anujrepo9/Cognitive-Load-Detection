// session.rs — Session management Tauri commands
//
// Commands:
//   start_session(token)           → Session
//   end_session(token, session_id) → Session
//   get_sessions(token)            → Vec<Session>
//   get_session(token, session_id) → Session

use rusqlite::params;
use serde::Serialize;

use crate::auth::{decode_access_token, JwtSecret};
use crate::db::{open, DbPath};

#[derive(Serialize, Clone)]
pub struct Session {
    pub id:         i64,
    pub user_id:    i64,
    pub start_time: String,
    pub end_time:   Option<String>,
}

// ── Commands ───────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn start_session(
    state: tauri::State<'_, DbPath>,
    jwt:   tauri::State<'_, JwtSecret>,
    token: String,
) -> Result<Session, String> {
    let user_id = decode_access_token(&token, &jwt.0)?;
    let conn    = open(&state.0).map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO sessions (user_id, start_time) VALUES (?1, datetime('now'))",
        params![user_id],
    )
    .map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();

    let mut stmt = conn
        .prepare("SELECT id, user_id, start_time, end_time FROM sessions WHERE id = ?1")
        .map_err(|e| e.to_string())?;
    let s = stmt
        .query_row(params![id], row_to_session)
        .map_err(|e| e.to_string())?;

    Ok(s)
}

#[tauri::command]
pub async fn end_session(
    state: tauri::State<'_, DbPath>,
    jwt:   tauri::State<'_, JwtSecret>,
    token: String,
    session_id: i64,
) -> Result<Session, String> {
    let user_id = decode_access_token(&token, &jwt.0)?;
    let conn    = open(&state.0).map_err(|e| e.to_string())?;

    // First check ownership (whether ended or not)
    let exists: bool = conn.query_row(
        "SELECT COUNT(*) FROM sessions WHERE id = ?1 AND user_id = ?2",
        params![session_id, user_id],
        |r| r.get::<_, i64>(0),
    ).unwrap_or(0) > 0;

    if !exists {
        return Err("Session not found".into());
    }

    // Mark ended — idempotent: if already ended, this is a no-op (rows == 0 is OK)
    conn.execute(
        "UPDATE sessions SET end_time = datetime('now') WHERE id = ?1 AND user_id = ?2 AND end_time IS NULL",
        params![session_id, user_id],
    ).map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare("SELECT id, user_id, start_time, end_time FROM sessions WHERE id = ?1")
        .map_err(|e| e.to_string())?;
    let s = stmt
        .query_row(params![session_id], row_to_session)
        .map_err(|e| e.to_string())?;

    Ok(s)
}

#[tauri::command]
pub async fn get_sessions(
    state: tauri::State<'_, DbPath>,
    jwt:   tauri::State<'_, JwtSecret>,
    token: String,
) -> Result<Vec<Session>, String> {
    let user_id = decode_access_token(&token, &jwt.0)?;
    let conn    = open(&state.0).map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT id, user_id, start_time, end_time FROM sessions
             WHERE user_id = ?1 ORDER BY start_time DESC LIMIT 100",
        )
        .map_err(|e| e.to_string())?;

    let sessions = stmt
        .query_map(params![user_id], row_to_session)
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(sessions)
}

#[tauri::command]
pub async fn get_session(
    state: tauri::State<'_, DbPath>,
    jwt:   tauri::State<'_, JwtSecret>,
    token: String,
    session_id: i64,
) -> Result<Session, String> {
    let user_id = decode_access_token(&token, &jwt.0)?;
    let conn    = open(&state.0).map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT id, user_id, start_time, end_time FROM sessions
             WHERE id = ?1 AND user_id = ?2",
        )
        .map_err(|e| e.to_string())?;

    let s = stmt
        .query_row(params![session_id, user_id], row_to_session)
        .map_err(|_| "Session not found".to_string())?;

    Ok(s)
}

/// Returns the most recent open (not yet ended) session for this user, or null.
/// Mirrors the HTTP GET /session/current endpoint used by the browser build.
#[tauri::command]
pub async fn get_current_session(
    state: tauri::State<'_, DbPath>,
    jwt:   tauri::State<'_, JwtSecret>,
    token: String,
) -> Result<Option<Session>, String> {
    let user_id = decode_access_token(&token, &jwt.0)?;
    let conn    = open(&state.0).map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT id, user_id, start_time, end_time FROM sessions
             WHERE user_id = ?1 AND end_time IS NULL
             ORDER BY start_time DESC LIMIT 1",
        )
        .map_err(|e| e.to_string())?;

    let result = stmt.query_row(params![user_id], row_to_session);
    match result {
        Ok(s)                           => Ok(Some(s)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e)                          => Err(e.to_string()),
    }
}

/// Tauri shim for pause — the collector is paused via set_tracking_enabled(false)
/// from JS, but the session route exists in the HTTP build so we expose it here
/// for completeness.  No-op at the DB level (HTTP build stores paused state
/// server-side; Tauri keeps it in CollectorState).
#[tauri::command]
pub async fn pause_session(
    _state: tauri::State<'_, DbPath>,
    jwt:    tauri::State<'_, JwtSecret>,
    token: String,
) -> Result<(), String> {
    decode_access_token(&token, &jwt.0)?;
    Ok(())
}

/// Tauri shim for resume — symmetric with pause_session.
#[tauri::command]
pub async fn resume_session(
    _state: tauri::State<'_, DbPath>,
    jwt:    tauri::State<'_, JwtSecret>,
    token: String,
) -> Result<(), String> {
    decode_access_token(&token, &jwt.0)?;
    Ok(())
}

// ── Row helper ─────────────────────────────────────────────────────────────────
//
// FIX: SQLite datetime('now') returns "2024-01-15 10:30:00" with no timezone
// suffix. JavaScript's new Date("2024-01-15 10:30:00") treats that as LOCAL
// time, so on IST (UTC+5:30) the session appears to have started 5h30m = 330
// minutes ago — which is exactly the bug reported.
//
// Fix: append "Z" so the string becomes "2024-01-15 10:30:00Z", which JS
// always parses as UTC regardless of the user's local timezone.

fn append_z(s: String) -> String {
    if s.ends_with('Z') || s.ends_with('+') || s.contains('+') {
        s
    } else {
        format!("{}Z", s)
    }
}

fn row_to_session(row: &rusqlite::Row<'_>) -> rusqlite::Result<Session> {
    Ok(Session {
        id:         row.get(0)?,
        user_id:    row.get(1)?,
        start_time: append_z(row.get::<_, String>(2)?),
        end_time:   row.get::<_, Option<String>>(3)?.map(append_z),
    })
}