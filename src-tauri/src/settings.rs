// settings.rs — User settings, profile, password, dashboard overview, CSV export
//
// Commands:
//   get_settings(token)          → Settings
//   update_settings(token, ...)  → Settings
//   get_autostart()              → AutostartStatus
//   set_autostart(enabled)       → ()
//   update_profile(token, name, email) → UserInfo
//   change_password(token, current_password, new_password) → ()
//   get_overview(token)          → Overview
//   get_model_info()             → ModelInfo
//   get_recommendation(token)    → Recommendations
//   export_csv(token)            → String (CSV content)

use tauri::Manager;
use bcrypt::{hash, verify, DEFAULT_COST};
use rusqlite::params;
use serde::{Deserialize, Serialize};

use crate::auth::{decode_access_token, UserInfo};
use crate::db::{open, DbPath};

// ── Settings ──────────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize)]
pub struct Settings {
    pub tracking_enabled:      bool,
    pub flush_interval_sec:    i64,
    pub notifications_enabled: bool,
    pub theme:                 String,
}

#[tauri::command]
pub async fn get_settings(
    state: tauri::State<'_, DbPath>,
    token: String,
) -> Result<Settings, String> {
    let user_id = decode_access_token(&token)?;
    let conn    = open(&state.0).map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT tracking_enabled, flush_interval_sec, notifications_enabled, theme
             FROM user_settings WHERE user_id = ?1",
        )
        .map_err(|e| e.to_string())?;

    let s = stmt
        .query_row(params![user_id], |row| {
            Ok(Settings {
                tracking_enabled:      row.get::<_, i64>(0)? == 1,
                flush_interval_sec:    row.get(1)?,
                notifications_enabled: row.get::<_, i64>(2)? == 1,
                theme:                 row.get(3)?,
            })
        })
        .map_err(|_| "Settings not found".to_string())?;

    Ok(s)
}

#[tauri::command]
pub async fn update_settings(
    state:                 tauri::State<'_, DbPath>,
    token:                 String,
    tracking_enabled:      Option<bool>,
    flush_interval_sec:    Option<i64>,
    notifications_enabled: Option<bool>,
    theme:                 Option<String>,
) -> Result<Settings, String> {
    let user_id = decode_access_token(&token)?;
    let conn    = open(&state.0).map_err(|e| e.to_string())?;

    // Read current, apply patches
    let mut stmt = conn
        .prepare(
            "SELECT tracking_enabled, flush_interval_sec, notifications_enabled, theme
             FROM user_settings WHERE user_id = ?1",
        )
        .map_err(|e| e.to_string())?;

    let current = stmt
        .query_row(params![user_id], |row| {
            Ok(Settings {
                tracking_enabled:      row.get::<_, i64>(0)? == 1,
                flush_interval_sec:    row.get(1)?,
                notifications_enabled: row.get::<_, i64>(2)? == 1,
                theme:                 row.get(3)?,
            })
        })
        .map_err(|_| "Settings not found".to_string())?;

    let new = Settings {
        tracking_enabled:      tracking_enabled.unwrap_or(current.tracking_enabled),
        flush_interval_sec:    flush_interval_sec.unwrap_or(current.flush_interval_sec),
        notifications_enabled: notifications_enabled.unwrap_or(current.notifications_enabled),
        theme:                 theme.unwrap_or(current.theme),
    };

    conn.execute(
        "UPDATE user_settings
         SET tracking_enabled = ?1, flush_interval_sec = ?2,
             notifications_enabled = ?3, theme = ?4, updated_at = datetime('now')
         WHERE user_id = ?5",
        params![
            new.tracking_enabled as i64,
            new.flush_interval_sec,
            new.notifications_enabled as i64,
            new.theme,
            user_id,
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(new)
}

// ── Autostart (Windows registry via HKCU\Software\Microsoft\Windows\CurrentVersion\Run) ──

#[derive(Serialize)]
pub struct AutostartStatus {
    pub enabled: bool,
}

const AUTOSTART_KEY: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";
const AUTOSTART_APP: &str = "CogniLoad";

#[tauri::command]
pub fn get_autostart() -> AutostartStatus {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        // Query the registry key; exit code 0 = exists
        let out = Command::new("reg")
            .args(["query", &format!("HKCU\\{}", AUTOSTART_KEY), "/v", AUTOSTART_APP])
            .output();
        let enabled = out.map(|o| o.status.success()).unwrap_or(false);
        return AutostartStatus { enabled };
    }
    #[allow(unreachable_code)]
    AutostartStatus { enabled: false }
}

#[tauri::command]
pub fn set_autostart(enabled: bool) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        // Get current exe path
        let exe = std::env::current_exe()
            .map_err(|e| e.to_string())?
            .to_string_lossy()
            .to_string();

        if enabled {
            Command::new("reg")
                .args([
                    "add",
                    &format!("HKCU\\{}", AUTOSTART_KEY),
                    "/v", AUTOSTART_APP,
                    "/t", "REG_SZ",
                    "/d", &format!("\"{}\"", exe),
                    "/f",
                ])
                .output()
                .map_err(|e| e.to_string())?;
        } else {
            Command::new("reg")
                .args([
                    "delete",
                    &format!("HKCU\\{}", AUTOSTART_KEY),
                    "/v", AUTOSTART_APP,
                    "/f",
                ])
                .output()
                .map_err(|e| e.to_string())?;
        }
        return Ok(());
    }
    #[allow(unreachable_code)]
    Ok(())
}

// ── Profile ───────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn update_profile(
    state: tauri::State<'_, DbPath>,
    token: String,
    name:  String,
    email: String,
) -> Result<UserInfo, String> {
    let user_id = decode_access_token(&token)?;
    let email   = email.trim().to_lowercase();
    let name    = name.trim().to_string();

    if name.is_empty()  { return Err("Name cannot be empty".into()); }
    if email.is_empty() { return Err("Email cannot be empty".into()); }

    let conn = open(&state.0).map_err(|e| e.to_string())?;

    // Check email not taken by someone else
    let mut stmt = conn
        .prepare("SELECT id FROM users WHERE email = ?1 AND id != ?2 LIMIT 1")
        .map_err(|e| e.to_string())?;
    let taken = stmt
        .query_row(params![email, user_id], |_| Ok(()))
        .is_ok();
    if taken {
        return Err("Email already in use by another account".into());
    }

    conn.execute(
        "UPDATE users SET name = ?1, email = ?2 WHERE id = ?3",
        params![name, email, user_id],
    )
    .map_err(|e| e.to_string())?;

    Ok(UserInfo { id: user_id, name, email })
}

#[tauri::command]
pub async fn change_password(
    state:            tauri::State<'_, DbPath>,
    token:            String,
    current_password: String,
    new_password:     String,
) -> Result<(), String> {
    let user_id = decode_access_token(&token)?;
    let conn    = open(&state.0).map_err(|e| e.to_string())?;

    // Fetch current hash
    let mut stmt = conn
        .prepare("SELECT password FROM users WHERE id = ?1")
        .map_err(|e| e.to_string())?;
    let pw_hash: String = stmt
        .query_row(params![user_id], |r| r.get(0))
        .map_err(|_| "User not found".to_string())?;

    if !verify(&current_password, &pw_hash).map_err(|e| e.to_string())? {
        return Err("Current password is incorrect".into());
    }
    if new_password.len() < 6 {
        return Err("New password must be at least 6 characters".into());
    }

    let new_hash = hash(&new_password, DEFAULT_COST).map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE users SET password = ?1 WHERE id = ?2",
        params![new_hash, user_id],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

// ── Dashboard overview ────────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct Overview {
    pub sessions_today: i64,
    pub avg_load:       Option<String>,
    pub typing_events:  i64,
    pub mouse_events:   i64,
    pub avg_wpm:        Option<i64>,
}

#[tauri::command]
pub async fn get_overview(
    state: tauri::State<'_, DbPath>,
    token: String,
) -> Result<Overview, String> {
    let user_id = decode_access_token(&token)?;
    let conn    = open(&state.0).map_err(|e| e.to_string())?;

    // Sessions today
    let sessions_today: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM sessions
             WHERE user_id = ?1 AND date(start_time) = date('now')",
            params![user_id],
            |r| r.get(0),
        )
        .unwrap_or(0);

    // Most common load level today
    let avg_load: Option<String> = conn
        .query_row(
            "SELECT p.load_level FROM predictions p
             JOIN sessions s ON p.session_id = s.id
             WHERE s.user_id = ?1 AND date(p.created_at) = date('now')
             GROUP BY p.load_level ORDER BY COUNT(*) DESC LIMIT 1",
            params![user_id],
            |r| r.get(0),
        )
        .ok();

    // Typing events today (key_presses approximated by chars_per_min * flush window)
    let typing_events: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(chars_per_min), 0) FROM behavior_data b
             JOIN sessions s ON b.session_id = s.id
             WHERE s.user_id = ?1 AND date(b.timestamp) = date('now')",
            params![user_id],
            |r| r.get(0),
        )
        .unwrap_or(0);

    // Click events today
    let mouse_events: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(CAST(click_rate AS INTEGER)), 0) FROM behavior_data b
             JOIN sessions s ON b.session_id = s.id
             WHERE s.user_id = ?1 AND date(b.timestamp) = date('now')",
            params![user_id],
            |r| r.get(0),
        )
        .unwrap_or(0);

    // Average WPM today (non-null rows only)
    let avg_wpm: Option<i64> = conn
        .query_row(
            "SELECT AVG(typing_wpm) FROM behavior_data b
             JOIN sessions s ON b.session_id = s.id
             WHERE s.user_id = ?1 AND typing_wpm IS NOT NULL
               AND date(b.timestamp) = date('now')",
            params![user_id],
            |r| r.get::<_, Option<f64>>(0),
        )
        .ok()
        .flatten()
        .map(|v| v.round() as i64);

    Ok(Overview {
        sessions_today,
        avg_load,
        typing_events,
        mouse_events,
        avg_wpm,
    })
}

// ── Model info ────────────────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct ModelInfo {
    pub version:    String,
    pub model_type: String,
    pub features:   u32,
    pub labels:     Vec<String>,
}

#[tauri::command]
pub fn get_model_info(app: tauri::AppHandle) -> ModelInfo {
    let data_dir = app.path().app_data_dir().ok();
    let has_onnx = data_dir
        .as_ref()
        .map(|d| d.join("model.onnx").exists())
        .unwrap_or(false);

    ModelInfo {
        version:    if has_onnx { "1".into() } else { "0".into() },
        model_type: if has_onnx { "RandomForest (ONNX)".into() } else { "rule-based".into() },
        features:   17,
        labels:     vec!["low".into(), "medium".into(), "high".into()],
    }
}

// ── Recommendations ───────────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct Recommendation {
    pub r#type:  String,
    pub title:   String,
    pub reason:  String,
}

#[derive(Serialize)]
pub struct RecommendationResponse {
    pub recommendations: Vec<Recommendation>,
}

#[tauri::command]
pub async fn get_recommendation(
    state: tauri::State<'_, DbPath>,
    token: String,
) -> Result<RecommendationResponse, String> {
    let user_id = decode_access_token(&token)?;
    let conn    = open(&state.0).map_err(|e| e.to_string())?;

    // Get the last 10 predictions for context
    let mut stmt = conn
        .prepare(
            "SELECT p.load_level, p.confidence FROM predictions p
             JOIN sessions s ON p.session_id = s.id
             WHERE s.user_id = ?1
             ORDER BY p.created_at DESC LIMIT 10",
        )
        .map_err(|e| e.to_string())?;

    let rows: Vec<(String, f64)> = stmt
        .query_map(params![user_id], |r| Ok((r.get(0)?, r.get(1)?)))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    let high_count = rows.iter().filter(|(l, _)| l == "high").count();
    let avg_conf: f64 = if rows.is_empty() {
        0.0
    } else {
        rows.iter().map(|(_, c)| c).sum::<f64>() / rows.len() as f64
    };

    let mut recs = Vec::new();

    if high_count >= 3 {
        recs.push(Recommendation {
            r#type: "break".into(),
            title:  "Take a short break".into(),
            reason: "Your cognitive load has been high repeatedly. A 5-minute break can reset focus.".into(),
        });
        recs.push(Recommendation {
            r#type: "water".into(),
            title:  "Stay hydrated".into(),
            reason: "Dehydration amplifies mental fatigue. Drink a glass of water now.".into(),
        });
    }

    if avg_conf < 0.6 && !rows.is_empty() {
        recs.push(Recommendation {
            r#type: "focus".into(),
            title:  "Reduce distractions".into(),
            reason: "Low prediction confidence suggests irregular activity patterns. Try a dedicated focus window.".into(),
        });
    }

    if rows.iter().any(|(l, _)| l == "medium") {
        recs.push(Recommendation {
            r#type: "simplify".into(),
            title:  "Simplify your current task".into(),
            reason: "Sustained medium load can creep upward. Break your task into smaller steps.".into(),
        });
    }

    if recs.is_empty() {
        recs.push(Recommendation {
            r#type: "focus".into(),
            title:  "Keep it up!".into(),
            reason: "Your cognitive load looks balanced. Maintain your current pace.".into(),
        });
    }

    Ok(RecommendationResponse { recommendations: recs })
}

// ── CSV export ────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn export_csv(
    state: tauri::State<'_, DbPath>,
    token: String,
) -> Result<String, String> {
    let user_id = decode_access_token(&token)?;
    let conn    = open(&state.0).map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT s.id, s.start_time, s.end_time,
                    COUNT(p.id) as prediction_count,
                    (SELECT p2.load_level FROM predictions p2
                     WHERE p2.session_id = s.id
                     GROUP BY p2.load_level ORDER BY COUNT(*) DESC LIMIT 1) as avg_load
             FROM sessions s
             LEFT JOIN predictions p ON p.session_id = s.id
             WHERE s.user_id = ?1
             GROUP BY s.id
             ORDER BY s.start_time DESC",
        )
        .map_err(|e| e.to_string())?;

    let mut csv = String::from("session_id,start_time,end_time,prediction_count,avg_load\n");

    let rows = stmt
        .query_map(params![user_id], |r| {
            Ok((
                r.get::<_, i64>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, Option<String>>(2)?,
                r.get::<_, i64>(3)?,
                r.get::<_, Option<String>>(4)?,
            ))
        })
        .map_err(|e| e.to_string())?;

    for row in rows.filter_map(|r| r.ok()) {
        csv.push_str(&format!(
            "{},{},{},{},{}\n",
            row.0,
            row.1,
            row.2.unwrap_or_default(),
            row.3,
            row.4.unwrap_or_else(|| "unknown".into()),
        ));
    }

    Ok(csv)
}

// ── Session history (paginated) ───────────────────────────────────────────────

#[derive(Serialize)]
pub struct SessionRow {
    pub session_id:       i64,
    pub start_time:       String,
    pub end_time:         Option<String>,
    pub duration:         Option<String>,
    pub avg_load:         Option<String>,
    pub prediction_count: i64,
}

#[derive(Serialize)]
pub struct HistoryResponse {
    pub sessions:    Vec<SessionRow>,
    pub total:       i64,
    pub total_pages: i64,
}

#[tauri::command]
pub async fn get_history(
    state:     tauri::State<'_, DbPath>,
    token:     String,
    page:      Option<i64>,
    per_page:  Option<i64>,
    from_date: Option<String>,
    to_date:   Option<String>,
) -> Result<HistoryResponse, String> {
    let user_id  = decode_access_token(&token)?;
    let page     = page.unwrap_or(1).max(1);
    let per_page = per_page.unwrap_or(10).clamp(1, 100);
    let offset   = (page - 1) * per_page;

    let conn = open(&state.0).map_err(|e| e.to_string())?;

    // Build optional date filters
    let from_clause = from_date
        .as_deref()
        .map(|_| " AND date(s.start_time) >= ?3")
        .unwrap_or("");
    let to_clause = to_date
        .as_deref()
        .map(|_| " AND date(s.start_time) <= ?4")
        .unwrap_or("");

    let count_sql = format!(
        "SELECT COUNT(*) FROM sessions s WHERE s.user_id = ?1{from_clause}{to_clause}"
    );
    let data_sql = format!(
        "SELECT s.id, s.start_time, s.end_time,
                COUNT(p.id) as prediction_count,
                (SELECT p2.load_level FROM predictions p2
                 WHERE p2.session_id = s.id
                 GROUP BY p2.load_level ORDER BY COUNT(*) DESC LIMIT 1) as avg_load
         FROM sessions s
         LEFT JOIN predictions p ON p.session_id = s.id
         WHERE s.user_id = ?1{from_clause}{to_clause}
         GROUP BY s.id
         ORDER BY s.start_time DESC
         LIMIT ?2 OFFSET {offset}"
    );



    // Count
    let total: i64 = match (&from_date, &to_date) {
        (Some(f), Some(t)) => conn
            .query_row(&count_sql, params![user_id, f, t], |r| r.get(0))
            .unwrap_or(0),
        (Some(f), None) => conn
            .query_row(&count_sql, params![user_id, f], |r| r.get(0))
            .unwrap_or(0),
        (None, Some(t)) => conn
            .query_row(&count_sql, params![user_id, t], |r| r.get(0))
            .unwrap_or(0),
        (None, None) => conn
            .query_row(&count_sql, params![user_id], |r| r.get(0))
            .unwrap_or(0),
    };

    let total_pages = ((total as f64) / (per_page as f64)).ceil() as i64;

    // Data — row mapper closure
    let map_row = |row: &rusqlite::Row<'_>| -> rusqlite::Result<SessionRow> {
        let id: i64              = row.get(0)?;
        let start: String        = row.get(1)?;
        let end: Option<String>  = row.get(2)?;
        let pcount: i64          = row.get(3)?;
        let avg: Option<String>  = row.get(4)?;

        // Human-readable duration
        let duration = end.as_deref().and_then(|e| {
            let s = chrono::DateTime::parse_from_rfc3339(&format!("{}Z", start.replace(' ', "T"))).ok()?;
            let e = chrono::DateTime::parse_from_rfc3339(&format!("{}Z", e.replace(' ', "T"))).ok()?;
            let secs = (e - s).num_seconds().max(0);
            let h = secs / 3600;
            let m = (secs % 3600) / 60;
            let s = secs % 60;
            Some(if h > 0 { format!("{h}h {m}m") } else { format!("{m}m {s:02}s") })
        });

        Ok(SessionRow {
            session_id: id,
            start_time: start,
            end_time: end,
            duration,
            avg_load: avg,
            prediction_count: pcount,
        })
    };

    let sessions: Vec<SessionRow> = match (&from_date, &to_date) {
        (Some(f), Some(t)) => {
            let mut s = conn.prepare(&data_sql).map_err(|e| e.to_string())?;

            let rows = s
                .query_map(params![user_id, per_page, f, t], map_row)
                .map_err(|e| e.to_string())?;

            rows
                .filter_map(|r| r.ok())
                .collect()
        }

        (Some(f), None) => {
            let mut s = conn.prepare(&data_sql).map_err(|e| e.to_string())?;

            let rows = s
                .query_map(params![user_id, per_page, f], map_row)
                .map_err(|e| e.to_string())?;

            rows
                .filter_map(|r| r.ok())
                .collect()
        }

        (None, Some(t)) => {
            let mut s = conn.prepare(&data_sql).map_err(|e| e.to_string())?;

            let rows = s
                .query_map(params![user_id, per_page, t], map_row)
                .map_err(|e| e.to_string())?;

            rows
                .filter_map(|r| r.ok())
                .collect()
        }

        (None, None) => {
            let mut s = conn.prepare(&data_sql).map_err(|e| e.to_string())?;

            let rows = s
                .query_map(params![user_id, per_page], map_row)
                .map_err(|e| e.to_string())?;

            rows
                .filter_map(|r| r.ok())
                .collect()
        }
    };

    Ok(HistoryResponse { sessions, total, total_pages })
}

// ── Analytics ─────────────────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct TrendPoint {
    pub timestamp:  String,
    pub load_level: String,
    pub confidence: f32,
    pub wpm:        Option<i64>,
}

#[derive(Serialize)]
pub struct TrendsResponse {
    pub points: Vec<TrendPoint>,
    pub hours:  i64,
}

#[tauri::command]
pub async fn get_analytics_trends(
    state:  tauri::State<'_, DbPath>,
    token:  String,
    hours:  Option<i64>,
    limit:  Option<i64>,
) -> Result<TrendsResponse, String> {
    let user_id = decode_access_token(&token)?;
    let hours   = hours.unwrap_or(24);
    let limit   = limit.unwrap_or(500).clamp(1, 2000);
    let conn    = open(&state.0).map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT p.created_at, p.load_level, p.confidence, b.typing_wpm
             FROM predictions p
             JOIN sessions s ON p.session_id = s.id
             LEFT JOIN behavior_data b ON p.behavior_id = b.id
             WHERE s.user_id = ?1
               AND p.created_at >= datetime('now', ?2)
             ORDER BY p.created_at ASC
             LIMIT ?3",
        )
        .map_err(|e| e.to_string())?;

    let interval = format!("-{hours} hours");
    let points: Vec<TrendPoint> = stmt
        .query_map(params![user_id, interval, limit], |row| {
            Ok(TrendPoint {
                timestamp:  row.get(0)?,
                load_level: row.get(1)?,
                confidence: row.get(2)?,
                wpm:        row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(TrendsResponse { points, hours })
}

#[derive(Serialize)]
pub struct FeatureStat {
    pub feature: String,
    pub mean:    f64,
    pub std:     f64,
    pub min:     f64,
    pub max:     f64,
}

#[derive(Serialize)]
pub struct FeaturesResponse {
    pub stats:         Vec<FeatureStat>,
    pub total_records: i64,
}

const FEATURE_COLS: &[&str] = &[
    "typing_wpm", "chars_per_min", "avg_hold_ms", "avg_flight_ms",
    "error_rate", "pause_count", "avg_pause_ms", "typing_variance",
    "avg_cursor_speed", "movement_distance", "click_rate", "double_click_rate",
    "scroll_rate", "idle_time_pct", "avg_hover_ms", "avg_acceleration",
    "movement_smoothness",
];

#[tauri::command]
pub async fn get_analytics_features(
    state: tauri::State<'_, DbPath>,
    token: String,
) -> Result<FeaturesResponse, String> {
    let user_id = decode_access_token(&token)?;
    let conn    = open(&state.0).map_err(|e| e.to_string())?;

    let total: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM behavior_data b
             JOIN sessions s ON b.session_id = s.id WHERE s.user_id = ?1",
            params![user_id],
            |r| r.get(0),
        )
        .unwrap_or(0);

    let mut stats = Vec::new();
    for col in FEATURE_COLS {
        let sql = format!(
            "SELECT AVG({col}), AVG(({col} - avg_sub.a) * ({col} - avg_sub.a)),
                    MIN({col}), MAX({col})
             FROM behavior_data b
             JOIN sessions s ON b.session_id = s.id
             JOIN (SELECT AVG({col}) as a FROM behavior_data b2
                   JOIN sessions s2 ON b2.session_id = s2.id
                   WHERE s2.user_id = ?1) avg_sub
             WHERE s.user_id = ?1 AND {col} IS NOT NULL"
        );
        if let Ok((mean, variance, min, max)) = conn.query_row(&sql, params![user_id, user_id], |r| {
            Ok((
                r.get::<_, f64>(0).unwrap_or(0.0),
                r.get::<_, f64>(1).unwrap_or(0.0),
                r.get::<_, f64>(2).unwrap_or(0.0),
                r.get::<_, f64>(3).unwrap_or(0.0),
            ))
        }) {
            stats.push(FeatureStat {
                feature: col.to_string(),
                mean:    (mean * 100.0).round() / 100.0,
                std:     (variance.sqrt() * 100.0).round() / 100.0,
                min:     (min * 100.0).round() / 100.0,
                max:     (max * 100.0).round() / 100.0,
            });
        }
    }

    Ok(FeaturesResponse { stats, total_records: total })
}

// ── Daily / weekly reports ────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct DayReport {
    pub date:              String,
    pub sessions:          i64,
    pub predictions:       i64,
    pub avg_wpm:           Option<i64>,
    pub dominant_load:     Option<String>,
    pub load_distribution: serde_json::Value,
}

#[derive(Serialize)]
pub struct DailyResponse {
    pub days: Vec<DayReport>,
}

#[tauri::command]
pub async fn get_daily_reports(
    state: tauri::State<'_, DbPath>,
    token: String,
    days:  Option<i64>,
) -> Result<DailyResponse, String> {
    let user_id = decode_access_token(&token)?;
    let days    = days.unwrap_or(14).clamp(1, 90);
    let conn    = open(&state.0).map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT date(s.start_time) as d,
                    COUNT(DISTINCT s.id) as sessions,
                    COUNT(p.id) as predictions,
                    AVG(b.typing_wpm) as avg_wpm
             FROM sessions s
             LEFT JOIN predictions p ON p.session_id = s.id
             LEFT JOIN behavior_data b ON b.session_id = s.id AND b.typing_wpm IS NOT NULL
             WHERE s.user_id = ?1 AND s.start_time >= datetime('now', ?2)
             GROUP BY d ORDER BY d DESC",
        )
        .map_err(|e| e.to_string())?;

    let interval = format!("-{days} days");
    let days_vec: Vec<DayReport> = stmt
        .query_map(params![user_id, interval], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, i64>(1)?,
                row.get::<_, i64>(2)?,
                row.get::<_, Option<f64>>(3)?,
            ))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .map(|(date, sessions, predictions, avg_wpm)| {
            // Dominant load per day
            let dominant: Option<String> = conn
                .query_row(
                    "SELECT p.load_level FROM predictions p
                     JOIN sessions s ON p.session_id = s.id
                     WHERE s.user_id = ?1 AND date(p.created_at) = ?2
                     GROUP BY p.load_level ORDER BY COUNT(*) DESC LIMIT 1",
                    params![user_id, date],
                    |r| r.get(0),
                )
                .ok();

            // Load distribution
            let low: i64 = conn.query_row(
                "SELECT COUNT(*) FROM predictions p JOIN sessions s ON p.session_id = s.id
                 WHERE s.user_id = ?1 AND date(p.created_at) = ?2 AND p.load_level = 'low'",
                params![user_id, date], |r| r.get(0)).unwrap_or(0);
            let med: i64 = conn.query_row(
                "SELECT COUNT(*) FROM predictions p JOIN sessions s ON p.session_id = s.id
                 WHERE s.user_id = ?1 AND date(p.created_at) = ?2 AND p.load_level = 'medium'",
                params![user_id, date], |r| r.get(0)).unwrap_or(0);
            let high: i64 = conn.query_row(
                "SELECT COUNT(*) FROM predictions p JOIN sessions s ON p.session_id = s.id
                 WHERE s.user_id = ?1 AND date(p.created_at) = ?2 AND p.load_level = 'high'",
                params![user_id, date], |r| r.get(0)).unwrap_or(0);
            let total = (low + med + high).max(1) as f64;

            DayReport {
                date,
                sessions,
                predictions,
                avg_wpm: avg_wpm.map(|v| v.round() as i64),
                dominant_load: dominant,
                load_distribution: serde_json::json!({
                    "low":    (low as f64 / total * 100.0).round() / 100.0,
                    "medium": (med as f64 / total * 100.0).round() / 100.0,
                    "high":   (high as f64 / total * 100.0).round() / 100.0,
                }),
            }
        })
        .collect();

    Ok(DailyResponse { days: days_vec })
}

#[derive(Serialize)]
pub struct WeekReport {
    pub week_start:        String,
    pub sessions:          i64,
    pub predictions:       i64,
    pub avg_wpm:           Option<i64>,
    pub dominant_load:     Option<String>,
    pub load_distribution: serde_json::Value,
}

#[derive(Serialize)]
pub struct WeeklyResponse {
    pub weeks: Vec<WeekReport>,
}

#[tauri::command]
pub async fn get_weekly_reports(
    state: tauri::State<'_, DbPath>,
    token: String,
    weeks: Option<i64>,
) -> Result<WeeklyResponse, String> {
    let user_id = decode_access_token(&token)?;
    let weeks   = weeks.unwrap_or(8).clamp(1, 52);
    let conn    = open(&state.0).map_err(|e| e.to_string())?;
    let days    = weeks * 7;

    let mut stmt = conn
        .prepare(
            "SELECT date(s.start_time, 'weekday 0', '-6 days') as week_start,
                    COUNT(DISTINCT s.id) as sessions,
                    COUNT(p.id) as predictions,
                    AVG(b.typing_wpm) as avg_wpm
             FROM sessions s
             LEFT JOIN predictions p ON p.session_id = s.id
             LEFT JOIN behavior_data b ON b.session_id = s.id AND b.typing_wpm IS NOT NULL
             WHERE s.user_id = ?1 AND s.start_time >= datetime('now', ?2)
             GROUP BY week_start ORDER BY week_start DESC",
        )
        .map_err(|e| e.to_string())?;

    let interval = format!("-{days} days");
    let weeks_vec: Vec<WeekReport> = stmt
        .query_map(params![user_id, interval], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, i64>(1)?,
                row.get::<_, i64>(2)?,
                row.get::<_, Option<f64>>(3)?,
            ))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .map(|(week_start, sessions, predictions, avg_wpm)| {
            let week_end = chrono::NaiveDate::parse_from_str(&week_start, "%Y-%m-%d")
                .map(|d| (d + chrono::Duration::days(6)).to_string())
                .unwrap_or_default();

            let dominant: Option<String> = conn
                .query_row(
                    "SELECT p.load_level FROM predictions p
                     JOIN sessions s ON p.session_id = s.id
                     WHERE s.user_id = ?1
                       AND date(p.created_at) BETWEEN ?2 AND ?3
                     GROUP BY p.load_level ORDER BY COUNT(*) DESC LIMIT 1",
                    params![user_id, week_start, week_end],
                    |r| r.get(0),
                )
                .ok();

            let low: i64 = conn.query_row(
                "SELECT COUNT(*) FROM predictions p JOIN sessions s ON p.session_id = s.id
                 WHERE s.user_id = ?1 AND date(p.created_at) BETWEEN ?2 AND ?3 AND p.load_level = 'low'",
                params![user_id, week_start, week_end], |r| r.get(0)).unwrap_or(0);
            let med: i64 = conn.query_row(
                "SELECT COUNT(*) FROM predictions p JOIN sessions s ON p.session_id = s.id
                 WHERE s.user_id = ?1 AND date(p.created_at) BETWEEN ?2 AND ?3 AND p.load_level = 'medium'",
                params![user_id, week_start, week_end], |r| r.get(0)).unwrap_or(0);
            let high: i64 = conn.query_row(
                "SELECT COUNT(*) FROM predictions p JOIN sessions s ON p.session_id = s.id
                 WHERE s.user_id = ?1 AND date(p.created_at) BETWEEN ?2 AND ?3 AND p.load_level = 'high'",
                params![user_id, week_start, week_end], |r| r.get(0)).unwrap_or(0);
            let total = (low + med + high).max(1) as f64;

            WeekReport {
                week_start,
                sessions,
                predictions,
                avg_wpm: avg_wpm.map(|v| v.round() as i64),
                dominant_load: dominant,
                load_distribution: serde_json::json!({
                    "low":    (low as f64 / total * 100.0).round() / 100.0,
                    "medium": (med as f64 / total * 100.0).round() / 100.0,
                    "high":   (high as f64 / total * 100.0).round() / 100.0,
                }),
            }
        })
        .collect();

    Ok(WeeklyResponse { weeks: weeks_vec })
}