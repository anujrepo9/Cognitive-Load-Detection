// auth.rs — Authentication commands
//
// Commands exposed to the frontend:
//   register(name, email, password)  → AuthResponse
//   login(email, password)           → AuthResponse
//   logout(token)                    → ()
//   refresh_token(refresh_token)     → AuthResponse
//   get_current_user(token)          → UserInfo

use std::time::{SystemTime, UNIX_EPOCH};
use serde::{Deserialize, Serialize};
use jsonwebtoken::{encode, decode, Header, Validation, EncodingKey, DecodingKey};
use bcrypt::{hash, verify, DEFAULT_COST};
use rusqlite::params;
use sha2::{Sha256, Digest};

use crate::db::{DbPath, open, get_user_by_email, get_user_by_id};

// ── JWT secret — in production this should come from a stored key ──────────
// For a local desktop app this is acceptable; the DB is already local.
const JWT_SECRET: &str = "cogniload-desktop-secret-change-in-prod";
const ACCESS_TOKEN_EXPIRY_SECS:  u64 = 60 * 60;        // 1 hour
const REFRESH_TOKEN_EXPIRY_SECS: u64 = 60 * 60 * 24 * 7; // 7 days

// ── JWT Claims ─────────────────────────────────────────────────────────────
#[derive(Debug, Serialize, Deserialize)]
struct Claims {
    sub: String,   // user id as string
    exp: u64,
    iat: u64,
    kind: String,  // "access" | "refresh"
}

// ── Public response types (sent to frontend) ───────────────────────────────
#[derive(Serialize)]
pub struct AuthResponse {
    pub access_token:  String,
    pub refresh_token: String,
    pub user:          UserInfo,
}

#[derive(Serialize, Clone)]
pub struct UserInfo {
    pub id:    i64,
    pub name:  String,
    pub email: String,
}

// ── Helpers ────────────────────────────────────────────────────────────────

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs()
}

fn make_access_token(user_id: i64) -> Result<String, String> {
    let now = now_secs();
    let claims = Claims {
        sub:  user_id.to_string(),
        iat:  now,
        exp:  now + ACCESS_TOKEN_EXPIRY_SECS,
        kind: "access".into(),
    };
    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(JWT_SECRET.as_bytes()),
    )
    .map_err(|e| e.to_string())
}

fn make_refresh_token(user_id: i64) -> Result<String, String> {
    let now = now_secs();
    let claims = Claims {
        sub:  user_id.to_string(),
        iat:  now,
        exp:  now + REFRESH_TOKEN_EXPIRY_SECS,
        kind: "refresh".into(),
    };
    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(JWT_SECRET.as_bytes()),
    )
    .map_err(|e| e.to_string())
}

fn sha256_hex(s: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(s.as_bytes());
    format!("{:x}", hasher.finalize())
}

pub fn decode_access_token(token: &str) -> Result<i64, String> {
    let mut validation = Validation::default();
    validation.validate_exp = true;

    let data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(JWT_SECRET.as_bytes()),
        &validation,
    )
    .map_err(|e| format!("Invalid token: {e}"))?;

    if data.claims.kind != "access" {
        return Err("Not an access token".into());
    }

    data.claims.sub.parse::<i64>().map_err(|e| e.to_string())
}

fn store_refresh_token(
    db_path: &str,
    user_id: i64,
    refresh_token: &str,
    expiry_secs: u64,
) -> Result<(), String> {
    let conn = open(db_path).map_err(|e| e.to_string())?;
    let hash = sha256_hex(refresh_token);
    let expires_at = chrono::Utc::now()
        + chrono::Duration::seconds(expiry_secs as i64);
    conn.execute(
        "INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
         VALUES (?1, ?2, ?3)",
        params![user_id, hash, expires_at.to_rfc3339()],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

// ── Commands ───────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn register(
    state: tauri::State<'_, DbPath>,
    name: String,
    email: String,
    password: String,
) -> Result<AuthResponse, String> {
    let db_path = &state.0;
    let email = email.trim().to_lowercase();
    let conn = open(db_path).map_err(|e| e.to_string())?;

    // Check email not already taken
    if get_user_by_email(&conn, &email)
        .map_err(|e| e.to_string())?
        .is_some()
    {
        return Err("Email already registered".into());
    }

    let password_hash = hash(&password, DEFAULT_COST).map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO users (name, email, password) VALUES (?1, ?2, ?3)",
        params![name, email, password_hash],
    )
    .map_err(|e| e.to_string())?;

    let user_id = conn.last_insert_rowid();

    // Create default settings row
    conn.execute(
        "INSERT OR IGNORE INTO user_settings (user_id) VALUES (?1)",
        params![user_id],
    )
    .map_err(|e| e.to_string())?;

    let access  = make_access_token(user_id)?;
    let refresh = make_refresh_token(user_id)?;
    store_refresh_token(db_path, user_id, &refresh, REFRESH_TOKEN_EXPIRY_SECS)?;

    Ok(AuthResponse {
        access_token:  access,
        refresh_token: refresh,
        user: UserInfo { id: user_id, name, email },
    })
}

#[tauri::command]
pub async fn login(
    state: tauri::State<'_, DbPath>,
    email: String,
    password: String,
) -> Result<AuthResponse, String> {
    let db_path = &state.0;
    let email = email.trim().to_lowercase();
    let conn = open(db_path).map_err(|e| e.to_string())?;

    let (id, name, email_stored, pw_hash, is_active) =
        get_user_by_email(&conn, &email)
            .map_err(|e| e.to_string())?
            .ok_or("Invalid email or password")?;

    if !is_active {
        return Err("Account disabled".into());
    }

    let valid = verify(&password, &pw_hash).map_err(|e| e.to_string())?;
    if !valid {
        return Err("Invalid email or password".into());
    }

    let access  = make_access_token(id)?;
    let refresh = make_refresh_token(id)?;
    store_refresh_token(db_path, id, &refresh, REFRESH_TOKEN_EXPIRY_SECS)?;

    Ok(AuthResponse {
        access_token:  access,
        refresh_token: refresh,
        user: UserInfo { id, name, email: email_stored },
    })
}

#[tauri::command]
pub async fn logout(
    state: tauri::State<'_, DbPath>,
    refresh_token: String,
) -> Result<(), String> {
    let conn = open(&state.0).map_err(|e| e.to_string())?;
    let hash = sha256_hex(&refresh_token);
    conn.execute(
        "UPDATE refresh_tokens SET revoked = 1, revoked_at = datetime('now')
         WHERE token_hash = ?1",
        params![hash],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn refresh_token(
    state: tauri::State<'_, DbPath>,
    refresh_token: String,
) -> Result<AuthResponse, String> {
    let db_path = &state.0;
    let conn = open(db_path).map_err(|e| e.to_string())?;

    // Validate JWT
    let mut validation = Validation::default();
    validation.validate_exp = true;
    let data = decode::<Claims>(
        &refresh_token,
        &DecodingKey::from_secret(JWT_SECRET.as_bytes()),
        &validation,
    )
    .map_err(|e| format!("Invalid refresh token: {e}"))?;

    if data.claims.kind != "refresh" {
        return Err("Not a refresh token".into());
    }

    let user_id: i64 = data.claims.sub.parse().map_err(|e: std::num::ParseIntError| e.to_string())?;

    // Check token not revoked
    let hash = sha256_hex(&refresh_token);
    let mut stmt = conn
        .prepare("SELECT revoked FROM refresh_tokens WHERE token_hash = ?1 LIMIT 1")
        .map_err(|e| e.to_string())?;
    let revoked: bool = stmt
        .query_row(params![hash], |row| row.get::<_, i64>(0))
        .map(|v| v == 1)
        .unwrap_or(true); // treat missing as revoked

    if revoked {
        return Err("Refresh token revoked or not found".into());
    }

    // Revoke old token
    conn.execute(
        "UPDATE refresh_tokens SET revoked = 1, revoked_at = datetime('now')
         WHERE token_hash = ?1",
        params![hash],
    )
    .map_err(|e| e.to_string())?;

    // Issue new tokens
    let (_, name, email, _) = get_user_by_id(&conn, user_id)
        .map_err(|e| e.to_string())?
        .ok_or("User not found")?;

    let access  = make_access_token(user_id)?;
    let new_ref = make_refresh_token(user_id)?;
    store_refresh_token(db_path, user_id, &new_ref, REFRESH_TOKEN_EXPIRY_SECS)?;

    Ok(AuthResponse {
        access_token:  access,
        refresh_token: new_ref,
        user: UserInfo { id: user_id, name, email },
    })
}

#[tauri::command]
pub async fn get_current_user(
    state: tauri::State<'_, DbPath>,
    token: String,
) -> Result<UserInfo, String> {
    let user_id = decode_access_token(&token)?;
    let conn = open(&state.0).map_err(|e| e.to_string())?;
    let (id, name, email, _) = get_user_by_id(&conn, user_id)
        .map_err(|e| e.to_string())?
        .ok_or("User not found")?;
    Ok(UserInfo { id, name, email })
}