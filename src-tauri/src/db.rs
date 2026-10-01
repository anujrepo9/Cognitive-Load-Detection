// db.rs — SQLite initialisation and schema creation
//
// Mirrors the existing PostgreSQL models exactly:
//   users, refresh_tokens, sessions, behavior_data, predictions, user_settings

use rusqlite::{Connection, Result, params};

/// Managed state — holds the resolved path to cogniload.db
pub struct DbPath(pub String);

/// Open a connection to the SQLite database at `path`.
pub fn open(path: &str) -> Result<Connection> {
    let conn = Connection::open(path)?;
    // Enable WAL mode for better concurrent read performance
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;
    Ok(conn)
}

/// Create all tables if they don't exist yet.
/// Called once at app startup from main.rs setup().
pub fn init_db(path: &str) -> Result<()> {
    let conn = open(path)?;

    conn.execute_batch("
        -- ── Users ──────────────────────────────────────────────────────────
        CREATE TABLE IF NOT EXISTS users (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            name       TEXT    NOT NULL,
            email      TEXT    NOT NULL UNIQUE,
            password   TEXT    NOT NULL,   -- bcrypt hash
            is_active  INTEGER NOT NULL DEFAULT 1,
            created_at TEXT    NOT NULL DEFAULT (datetime('now'))
        );

        -- ── Refresh tokens ───────────────────────────────────────────────────
        CREATE TABLE IF NOT EXISTS refresh_tokens (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            token_hash TEXT    NOT NULL UNIQUE,   -- SHA-256
            expires_at TEXT    NOT NULL,
            revoked    INTEGER NOT NULL DEFAULT 0,
            created_at TEXT    NOT NULL DEFAULT (datetime('now')),
            revoked_at TEXT
        );

        -- ── Sessions ─────────────────────────────────────────────────────────
        CREATE TABLE IF NOT EXISTS sessions (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            start_time TEXT    NOT NULL DEFAULT (datetime('now')),
            end_time   TEXT
        );

        -- ── Behavior data ────────────────────────────────────────────────────
        CREATE TABLE IF NOT EXISTS behavior_data (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id          INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
            timestamp           TEXT    NOT NULL DEFAULT (datetime('now')),
            created_at          TEXT    NOT NULL DEFAULT (datetime('now')),

            -- Keyboard features
            typing_wpm          INTEGER,
            chars_per_min       INTEGER NOT NULL DEFAULT 0,
            avg_hold_ms         REAL    NOT NULL DEFAULT 0.0,
            avg_flight_ms       REAL    NOT NULL DEFAULT 0.0,
            error_rate          REAL    NOT NULL DEFAULT 0.0,
            pause_count         INTEGER NOT NULL DEFAULT 0,
            avg_pause_ms        REAL    NOT NULL DEFAULT 0.0,
            typing_variance     REAL    NOT NULL DEFAULT 0.0,

            -- Mouse features
            avg_cursor_speed    REAL    NOT NULL DEFAULT 0.0,
            movement_distance   REAL    NOT NULL DEFAULT 0.0,
            click_rate          REAL    NOT NULL DEFAULT 0.0,
            double_click_rate   REAL    NOT NULL DEFAULT 0.0,
            scroll_rate         REAL    NOT NULL DEFAULT 0.0,
            idle_time_pct       REAL    NOT NULL DEFAULT 0.0,
            avg_hover_ms        REAL    NOT NULL DEFAULT 0.0,
            avg_acceleration    REAL    NOT NULL DEFAULT 0.0,
            movement_smoothness REAL    NOT NULL DEFAULT 0.0,

            -- Window context
            active_window       TEXT,
            active_process      TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_behavior_session
            ON behavior_data(session_id);
        CREATE INDEX IF NOT EXISTS idx_behavior_timestamp
            ON behavior_data(timestamp);

        -- ── Predictions ──────────────────────────────────────────────────────
        CREATE TABLE IF NOT EXISTS predictions (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id  INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
            behavior_id INTEGER REFERENCES behavior_data(id),
            load_level  TEXT    NOT NULL,   -- low | medium | high
            confidence  REAL    NOT NULL,
            raw_scores  TEXT,               -- JSON: {low:.., medium:.., high:..}
            created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_predictions_session
            ON predictions(session_id);

        -- ── User settings ────────────────────────────────────────────────────
        CREATE TABLE IF NOT EXISTS user_settings (
            id                    INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id               INTEGER NOT NULL UNIQUE
                                          REFERENCES users(id) ON DELETE CASCADE,
            tracking_enabled      INTEGER NOT NULL DEFAULT 1,
            flush_interval_sec    INTEGER NOT NULL DEFAULT 15,
            notifications_enabled INTEGER NOT NULL DEFAULT 1,
            theme                 TEXT    NOT NULL DEFAULT 'system',
            updated_at            TEXT    NOT NULL DEFAULT (datetime('now'))
        );
    ")?;

    Ok(())
}

/// Helper — get a single user row by id.
/// Returns (id, name, email, is_active).
pub fn get_user_by_id(
    conn: &Connection,
    user_id: i64,
) -> Result<Option<(i64, String, String, bool)>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, email, is_active FROM users WHERE id = ?1 LIMIT 1"
    )?;
    let mut rows = stmt.query(params![user_id])?;
    if let Some(row) = rows.next()? {
        Ok(Some((
            row.get(0)?,
            row.get(1)?,
            row.get(2)?,
            row.get::<_, i64>(3)? == 1,
        )))
    } else {
        Ok(None)
    }
}

/// Helper — get a single user row by email.
/// Returns (id, name, email, password_hash, is_active).
pub fn get_user_by_email(
    conn: &Connection,
    email: &str,
) -> Result<Option<(i64, String, String, String, bool)>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, email, password, is_active FROM users WHERE email = ?1 LIMIT 1"
    )?;
    let mut rows = stmt.query(params![email])?;
    if let Some(row) = rows.next()? {
        Ok(Some((
            row.get(0)?,
            row.get(1)?,
            row.get(2)?,
            row.get(3)?,
            row.get::<_, i64>(4)? == 1,
        )))
    } else {
        Ok(None)
    }
}