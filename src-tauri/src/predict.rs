// predict.rs — ONNX-based ML inference (replaces Python cogniload_ml sidecar)
//
// At startup the ONNX model is loaded from <app_data>/model.onnx and
// <app_data>/scaler_params.json (mean + scale vectors produced by convert_model.py).
//
// Commands:
//   predict_load(token, session_id, behavior_id, payload) → Prediction
//   get_predictions(token, session_id, limit)              → Vec<Prediction>

use ndarray::Array2;
use ort::{
    session::Session,
    value::Tensor,
};
use rusqlite::params;
use serde::{Deserialize, Serialize};
use std::sync::{Mutex, OnceLock};
use tauri::Manager;

use crate::auth::decode_access_token;
use crate::behavior::BehaviorPayload;
use crate::db::{open, DbPath};



const LABELS: [&str; 3] = ["low", "medium", "high"];

// ── Scaler params (loaded from JSON) ──────────────────────────────────────────

#[derive(Deserialize)]
struct ScalerParams {
    mean:  Vec<f32>,
    scale: Vec<f32>,
}

// ── Global ORT session (lazy-init) ────────────────────────────────────────────

static ORT_SESSION: OnceLock<Mutex<Session>> = OnceLock::new();
static SCALER:      OnceLock<ScalerParams> = OnceLock::new();

fn ort_session(app: &tauri::AppHandle) -> Result<&'static Mutex<Session>, String> {
    if let Some(session) = ORT_SESSION.get() {
        return Ok(session);
    }

    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    let model_path = data_dir.join("model.onnx");

    if !model_path.exists() {
        return Err(format!(
            "model.onnx not found at {}. Run scripts/convert_model.py first.",
            model_path.display()
        ));
    }

    let session = Session::builder()
        .map_err(|e| e.to_string())?
        .commit_from_file(&model_path)
        .map_err(|e| e.to_string())?;

    Ok(ORT_SESSION.get_or_init(|| Mutex::new(session)))
}

fn scaler(app: &tauri::AppHandle) -> Result<&'static ScalerParams, String> {
    if let Some(s) = SCALER.get() {
        return Ok(s);
    }

    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    let scaler_path = data_dir.join("scaler_params.json");
    if !scaler_path.exists() {
        return Err(format!(
            "scaler_params.json not found at {}. Run scripts/convert_model.py first.",
            scaler_path.display()
        ));
    }

    let bytes  = std::fs::read(&scaler_path).map_err(|e| e.to_string())?;
    let params: ScalerParams = serde_json::from_slice(&bytes).map_err(|e| e.to_string())?;

    Ok(SCALER.get_or_init(|| params))
}

// ── Inference helper ──────────────────────────────────────────────────────────

fn run_inference(
    app:     &tauri::AppHandle,
    payload: &BehaviorPayload,
) -> Result<(String, f32, [f32; 3]), String> {
    let sc = scaler(app)?;

    // Build feature vector in FEATURE_ORDER
    let raw: [f64; 17] = [
        payload.typing_wpm.unwrap_or(0.0), payload.chars_per_min, payload.avg_hold_ms,
        payload.avg_flight_ms,    payload.error_rate,       payload.pause_count,
        payload.avg_pause_ms,     payload.typing_variance,  payload.avg_cursor_speed,
        payload.movement_distance,payload.click_rate,       payload.double_click_rate,
        payload.scroll_rate,      payload.idle_time_pct,    payload.avg_hover_ms,
        payload.avg_acceleration, payload.movement_smoothness,
    ];

    // Standardise: (x - mean) / scale
    let scaled: Vec<f32> = raw
        .iter()
        .zip(sc.mean.iter())
        .zip(sc.scale.iter())
        .map(|((x, m), s)| ((*x as f32) - m) / s.max(1e-8))
        .collect();

    let input = Array2::<f32>::from_shape_vec((1, 17), scaled)
        .map_err(|e| e.to_string())?;

    let session_mutex = ort_session(app)?;
    let mut sess = session_mutex
        .lock()
        .map_err(|e| format!("Failed to lock ONNX session: {e}"))?;

    let tensor = Tensor::from_array(input)
        .map_err(|e| e.to_string())?;

    let outputs = sess
        .run(ort::inputs![tensor])
        .map_err(|e| e.to_string())?;

    let (_, output_data) = outputs[0]
        .try_extract_tensor::<f32>()
        .map_err(|e| e.to_string())?;

    let p: Vec<f32> = output_data.to_vec();
    let scores = [
        p.get(0).copied().unwrap_or(0.0),
        p.get(1).copied().unwrap_or(0.0),
        p.get(2).copied().unwrap_or(0.0),
    ];

    let (max_i, &confidence) = scores
        .iter()
        .enumerate()
        .max_by(|(_, a), (_, b)| a.partial_cmp(b).unwrap())
        .unwrap();

    Ok((LABELS[max_i].to_string(), confidence, scores))
}

// ── Output types ──────────────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct Prediction {
    pub id:          i64,
    pub session_id:  i64,
    pub behavior_id: Option<i64>,
    pub load_level:  String,
    pub confidence:  f32,
    pub raw_scores:  String,  // JSON {low:.., medium:.., high:..}
    pub created_at:  String,
}

// ── Commands ───────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn predict_load(
    app:         tauri::AppHandle,
    state:       tauri::State<'_, DbPath>,
    token:       String,
    session_id:  i64,
    behavior_id: Option<i64>,
    payload:     BehaviorPayload,
) -> Result<Prediction, String> {
    decode_access_token(&token)?;

    let (load_level, confidence, scores) = run_inference(&app, &payload)?;

    let raw_scores = serde_json::json!({
        "low":    scores[0],
        "medium": scores[1],
        "high":   scores[2],
    })
    .to_string();

    let conn = open(&state.0).map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO predictions (session_id, behavior_id, load_level, confidence, raw_scores)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![session_id, behavior_id, load_level, confidence, raw_scores],
    )
    .map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();

    let mut stmt = conn
        .prepare(
            "SELECT id, session_id, behavior_id, load_level, confidence, raw_scores, created_at
             FROM predictions WHERE id = ?1",
        )
        .map_err(|e| e.to_string())?;

    let pred = stmt
        .query_row(params![id], row_to_prediction)
        .map_err(|e| e.to_string())?;

    Ok(pred)
}

#[tauri::command]
pub async fn get_predictions(
    state:      tauri::State<'_, DbPath>,
    token:      String,
    session_id: i64,
    limit:      Option<i64>,
) -> Result<Vec<Prediction>, String> {
    decode_access_token(&token)?;
    let conn  = open(&state.0).map_err(|e| e.to_string())?;
    let limit = limit.unwrap_or(50);

    let mut stmt = conn
        .prepare(
            "SELECT id, session_id, behavior_id, load_level, confidence, raw_scores, created_at
             FROM predictions WHERE session_id = ?1
             ORDER BY created_at DESC LIMIT ?2",
        )
        .map_err(|e| e.to_string())?;

    let preds = stmt
        .query_map(params![session_id, limit], row_to_prediction)
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(preds)
}

// ── Row helper ─────────────────────────────────────────────────────────────────

fn row_to_prediction(row: &rusqlite::Row<'_>) -> rusqlite::Result<Prediction> {
    Ok(Prediction {
        id:          row.get(0)?,
        session_id:  row.get(1)?,
        behavior_id: row.get(2)?,
        load_level:  row.get(3)?,
        confidence:  row.get(4)?,
        raw_scores:  row.get(5)?,
        created_at:  row.get(6)?,
    })
}