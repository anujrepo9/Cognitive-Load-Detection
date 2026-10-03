// session.rs — Session management Tauri commands
//
// Commands:
//   start_session(token)           → Session
//   end_session(token, session_id) → Session
//   get_sessions(token)            → Vec<Session>
//   get_session(token, session_id) → Session

use rusqlite::params;
use serde::Serialize;

use crate::auth::decode_access_token;
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
    token: String,
) -> Result<Session, String> {
    let user_id = decode_access_token(&token)?;
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
    token: String,
    session_id: i64,
) -> Result<Session, String> {
    let user_id = decode_access_token(&token)?;
    let conn    = open(&state.0).map_err(|e| e.to_string())?;

    let rows = conn
        .execute(
            "UPDATE sessions SET end_time = datetime('now')
             WHERE id = ?1 AND user_id = ?2 AND end_time IS NULL",
            params![session_id, user_id],
        )
        .map_err(|e| e.to_string())?;

    if rows == 0 {
        return Err("Session not found or already ended".into());
    }

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
    token: String,
) -> Result<Vec<Session>, String> {
    let user_id = decode_access_token(&token)?;
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
    token: String,
    session_id: i64,
) -> Result<Session, String> {
    let user_id = decode_access_token(&token)?;
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

// ── Row helper ─────────────────────────────────────────────────────────────────

fn row_to_session(row: &rusqlite::Row<'_>) -> rusqlite::Result<Session> {
    Ok(Session {
        id:         row.get(0)?,
        user_id:    row.get(1)?,
        start_time: row.get(2)?,
        end_time:   row.get(3)?,
    })
}