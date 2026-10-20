// auth.rs — Authentication commands
//
// Auth commands (login/register/logout/refresh) proxy to the FastAPI backend
// over HTTP so the same account works in both the web app and Tauri desktop.
//
// Local commands (session, behavior, predict, settings) validate the JWT
// locally using the same SECRET_KEY the backend uses, read from .env at
// startup and stored as JwtSecret managed state.
//
// Commands:
//   register(name, email, password)  → AuthResponse
//   login(email, password)           → AuthResponse
//   logout(refresh_token)            → ()
//   refresh_token(refresh_token)     → AuthResponse
//   get_current_user(token)          → UserInfo

use serde::{Deserialize, Serialize};
use reqwest::Client;
use jsonwebtoken::{decode, DecodingKey, Validation};

const BACKEND: &str = "http://127.0.0.1:8000/api";

// ── Managed state: JWT secret shared with the FastAPI backend ─────────────────
pub struct JwtSecret(pub String);

// ── Public types ──────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UserInfo {
    pub id:    serde_json::Value,
    pub name:  String,
    pub email: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct AuthResponse {
    pub access_token:  String,
    pub refresh_token: String,
    pub user:          UserInfo,
}

// ── Internal shapes from FastAPI ──────────────────────────────────────────────

#[derive(Deserialize, Debug)]
struct BackendTokenResponse {
    access_token:  String,
    refresh_token: String,
    user:          UserInfo,
}

#[derive(Deserialize, Debug)]
struct BackendRefreshResponse {
    access_token:  String,
    refresh_token: String,
}

#[derive(Deserialize, Debug)]
struct BackendError {
    detail: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize)]
struct Claims {
    sub: String,
    exp: u64,
    iat: Option<u64>,
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async fn extract_error(res: reqwest::Response) -> String {
    let status = res.status().as_u16();
    let text = res.text().await.unwrap_or_default();
    if let Ok(e) = serde_json::from_str::<BackendError>(&text) {
        return match e.detail {
            serde_json::Value::String(s) => s,
            other => other.to_string(),
        };
    }
    format!("HTTP {status}: {text}")
}

/// Decode a FastAPI-issued JWT locally using the shared secret.
/// Called by session.rs, behavior.rs, predict.rs, settings.rs.
pub fn decode_access_token(token: &str, secret: &str) -> Result<i64, String> {
    let mut v = Validation::new(jsonwebtoken::Algorithm::HS256);
    v.validate_exp = true;

    let data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &v,
    )
    .map_err(|e| format!("Invalid token: {e}"))?;

    data.claims.sub.parse::<i64>().map_err(|e| e.to_string())
}

// ── Commands ──────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn register(
    name:     String,
    email:    String,
    password: String,
) -> Result<AuthResponse, String> {
    let res = Client::new()
        .post(format!("{BACKEND}/auth/register"))
        .json(&serde_json::json!({ "name": name, "email": email, "password": password }))
        .send()
        .await
        .map_err(|e| format!("Backend unreachable: {e}"))?;

    if res.status().is_success() {
        let b: BackendTokenResponse = res.json().await.map_err(|e| e.to_string())?;
        Ok(AuthResponse { access_token: b.access_token, refresh_token: b.refresh_token, user: b.user })
    } else {
        Err(extract_error(res).await)
    }
}

#[tauri::command]
pub async fn login(
    email:    String,
    password: String,
) -> Result<AuthResponse, String> {
    let res = Client::new()
        .post(format!("{BACKEND}/auth/signin"))
        .json(&serde_json::json!({ "email": email, "password": password }))
        .send()
        .await
        .map_err(|e| format!("Backend unreachable: {e}"))?;

    if res.status().is_success() {
        let b: BackendTokenResponse = res.json().await.map_err(|e| e.to_string())?;
        Ok(AuthResponse { access_token: b.access_token, refresh_token: b.refresh_token, user: b.user })
    } else {
        Err(extract_error(res).await)
    }
}

#[tauri::command]
pub async fn logout(
    refresh_token: String,
) -> Result<(), String> {
    // Fire-and-forget — ignore network errors on logout
    let _ = Client::new()
        .post(format!("{BACKEND}/auth/logout"))
        .json(&serde_json::json!({ "refresh_token": refresh_token }))
        .send()
        .await;
    Ok(())
}

#[tauri::command]
pub async fn refresh_token(
    state:         tauri::State<'_, JwtSecret>,
    refresh_token: String,
) -> Result<AuthResponse, String> {
    let res = Client::new()
        .post(format!("{BACKEND}/auth/refresh"))
        .json(&serde_json::json!({ "refresh_token": refresh_token }))
        .send()
        .await
        .map_err(|e| format!("Backend unreachable: {e}"))?;

    if !res.status().is_success() {
        return Err(extract_error(res).await);
    }

    let b: BackendRefreshResponse = res.json().await.map_err(|e| e.to_string())?;

    // Decode locally to get user_id, then fetch profile
    let user_id = decode_access_token(&b.access_token, &state.0)?;

    let profile_res = Client::new()
        .get(format!("{BACKEND}/auth/profile"))
        .header("Authorization", format!("Bearer {}", b.access_token))
        .send()
        .await
        .map_err(|e| format!("Backend unreachable: {e}"))?;

    let user: UserInfo = if profile_res.status().is_success() {
        profile_res.json().await.map_err(|e| e.to_string())?
    } else {
        // Fallback: construct minimal UserInfo from token
        UserInfo {
            id:    serde_json::Value::Number(user_id.into()),
            name:  String::new(),
            email: String::new(),
        }
    };

    Ok(AuthResponse { access_token: b.access_token, refresh_token: b.refresh_token, user })
}

#[tauri::command]
pub async fn get_current_user(
    token: String,
) -> Result<UserInfo, String> {
    let res = Client::new()
        .get(format!("{BACKEND}/auth/profile"))
        .header("Authorization", format!("Bearer {token}"))
        .send()
        .await
        .map_err(|e| format!("Backend unreachable: {e}"))?;

    if res.status().is_success() {
        res.json::<UserInfo>().await.map_err(|e| e.to_string())
    } else {
        Err(extract_error(res).await)
    }
}