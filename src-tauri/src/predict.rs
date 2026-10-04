// predict.rs — ONNX-based ML inference (replaces Python cogniload_ml sidecar)
//
// Commands:
//   predict_load(token, session_id, behavior_id, payload) → Prediction
//   get_predictions(token, session_id, limit)              → Vec<Prediction>

use ndarray::Array2;
use ort::{session::Session, value::Tensor};
use rusqlite::params;
use serde::{Deserialize, Serialize};
use std::sync::{Mutex, OnceLock};
use tauri::Manager;

use crate::auth::decode_access_token;
use crate::behavior::BehaviorPayload;
use crate::db::{open, DbPath};

// The ONNX input node name. Verify with:
//   python -c "import onnx; m=onnx.load('model.onnx'); print(m.graph.input[0].name)"
const ONNX_INPUT_NAME: &str = "float_input";

const LABELS: [&str; 3] = ["low", "medium", "high"];

// ── Scaler params ─────────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct ScalerParams {
    mean:  Vec<f32>,
    scale: Vec<f32>,
}

// ── Lazy globals ──────────────────────────────────────────────────────────────

static ORT_SESSION: OnceLock<Mutex<Session>> = OnceLock::new();
static SCALER:      OnceLock<ScalerParams>   = OnceLock::new();

fn ort_session(app: &tauri::AppHandle) -> Result<&'static Mutex<Session>, String> {
    if let Some(s) = ORT_SESSION.get() {
        return Ok(s);
    }
    let model_path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join("model.onnx");
    if !model_path.exists() {
        return Err(format!(
            "model.onnx not found at {}. Place it in src-tauri/resources/ for dev.",
            model_path.display()
        ));
    }
    let session = Session::builder()
        .map_err(|e| format!("ORT builder: {e}"))?
        .commit_from_file(&model_path)
        .map_err(|e| format!("ORT load model: {e}"))?;
    Ok(ORT_SESSION.get_or_init(|| Mutex::new(session)))
}

fn scaler(app: &tauri::AppHandle) -> Result<&'static ScalerParams, String> {
    if let Some(s) = SCALER.get() {
        return Ok(s);
    }
    let path = app.path().app_data_dir()
        .map_err(|e| e.to_string())?
        .join("scaler_params.json");
    if !path.exists() {
        return Err(format!("scaler_params.json not found at {}.", path.display()));
    }
    let sp: ScalerParams = serde_json::from_slice(
        &std::fs::read(&path).map_err(|e| e.to_string())?
    ).map_err(|e| e.to_string())?;
    Ok(SCALER.get_or_init(|| sp))
}

// ── Inference ─────────────────────────────────────────────────────────────────

fn run_inference(
    app:     &tauri::AppHandle,
    payload: &BehaviorPayload,
) -> Result<(String, f32, [f32; 3]), String> {
    let sc = scaler(app)?;

    let raw: [f64; 17] = [
        payload.typing_wpm.unwrap_or(0.0),
        payload.chars_per_min,    payload.avg_hold_ms,
        payload.avg_flight_ms,    payload.error_rate,
        payload.pause_count,      payload.avg_pause_ms,
        payload.typing_variance,  payload.avg_cursor_speed,
        payload.movement_distance,payload.click_rate,
        payload.double_click_rate,payload.scroll_rate,
        payload.idle_time_pct,    payload.avg_hover_ms,
        payload.avg_acceleration, payload.movement_smoothness,
    ];

    let scaled: Vec<f32> = raw.iter()
        .zip(&sc.mean)
        .zip(&sc.scale)
        .map(|((x, m), s)| ((*x as f32) - m) / s.max(1e-8))
        .collect();

    let input: Array2<f32> = Array2::from_shape_vec((1, 17), scaled)
        .map_err(|e| e.to_string())?;

    let tensor = Tensor::<f32>::from_array(input)
        .map_err(|e| format!("ORT tensor create: {e}"))?;

    let sess_mutex = ort_session(app)?;
    let mut sess = sess_mutex.lock().unwrap_or_else(|p| p.into_inner());

    let outputs = sess
        .run(ort::inputs![ONNX_INPUT_NAME => tensor])
        .map_err(|e| format!("ORT run: {e}"))?;

    let view = outputs[0]
        .try_extract_array::<f32>()
        .map_err(|e| format!("ORT extract: {e}"))?;

    let flat: Vec<f32> = view.iter().copied().collect();
    let scores = [
        flat.first().copied().unwrap_or(0.0),
        flat.get(1).copied().unwrap_or(0.0),
        flat.get(2).copied().unwrap_or(0.0),
    ];

    let (max_i, &confidence) = scores.iter().enumerate()
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
    pub raw_scores:  String,
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
    }).to_string();

    let conn = open(&state.0).map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO predictions (session_id, behavior_id, load_level, confidence, raw_scores)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![session_id, behavior_id, load_level, confidence, raw_scores],
    ).map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();
    let mut stmt = conn.prepare(
        "SELECT id, session_id, behavior_id, load_level, confidence, raw_scores, created_at
         FROM predictions WHERE id = ?1",
    ).map_err(|e| e.to_string())?;

    stmt.query_row(params![id], row_to_prediction)
        .map_err(|e| e.to_string())
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

    let mut stmt = conn.prepare(
        "SELECT id, session_id, behavior_id, load_level, confidence, raw_scores, created_at
         FROM predictions WHERE session_id = ?1
         ORDER BY created_at DESC LIMIT ?2",
    ).map_err(|e| e.to_string())?;

    // FIX: collect into a variable first so `stmt` and `conn` are not
    // borrowed across the implicit temporary drop at the end of the block.
    let rows: Vec<Prediction> = stmt
        .query_map(params![session_id, limit], row_to_prediction)
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(rows)
}

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