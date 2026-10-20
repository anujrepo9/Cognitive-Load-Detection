// auth.rs — Authentication commands (fully local — no FastAPI required)
//
// ALL auth is handled directly against the local SQLite database using the
// same bcrypt + HS256 JWT logic as the FastAPI backend.  No HTTP calls are
// made.  This means the Tauri desktop app works standalone, with no Python
// process running.
//
// Token shapes are kept 100 % compatible with the FastAPI backend so that a
// user who created their account via the web app can import their data later
// (same SECRET_KEY, same JWT payload, same bcrypt cost).
//
// The web app (browser / uvicorn) never calls these Rust commands — it talks
// to FastAPI directly over HTTP as before.  Nothing here touches the web path.
//
// Commands:
//   register(name, email, password)              → AuthResponse
//   login(email, password)                       → AuthResponse
//   logout(refresh_token)                        → ()
//   refresh_token(refresh_token)                 → AuthResponse
//   get_current_user(token)                      → UserInfo
//
// Token lifetimes (match backend/config.py defaults):
//   Access token  : 1440 minutes  (24 h)
//   Refresh token : 7 days

use bcrypt::{hash, verify, DEFAULT_COST};
use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use rusqlite::params;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::db::{open, DbPath};

// ── Token lifetimes (must match backend/config.py) ───────────────────────────
const ACCESS_TOKEN_MINUTES:  i64 = 1440;   // 24 h
const REFRESH_TOKEN_DAYS:    i64 = 7;

// ── Managed state: JWT secret (loaded from .env in main.rs) ──────────────────
pub struct JwtSecret(pub String);

// ── Public return types ───────────────────────────────────────────────────────

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

// ── JWT claims (identical payload to FastAPI python-jose) ─────────────────────
#[derive(Debug, Serialize, Deserialize)]
struct Claims {
    sub: String,   // user id as string — matches FastAPI {"sub": str(user.id)}
    exp: i64,
    iat: i64,
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/// Decode an access token and return the user_id (i64).
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

/// Issue a new HS256 access token for `user_id`.
fn make_access_token(user_id: i64, secret: &str) -> Result<String, String> {
    let now = Utc::now();
    let claims = Claims {
        sub: user_id.to_string(),
        iat: now.timestamp(),
        exp: (now + Duration::minutes(ACCESS_TOKEN_MINUTES)).timestamp(),
    };
    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .map_err(|e| format!("JWT encode error: {e}"))
}

/// Generate a random opaque refresh token, persist a SHA-256 hash of it to
/// the refresh_tokens table, and return the raw value to the caller.
///
/// Uses `uuid::Uuid::new_v4()` (already a direct Cargo dep) which sources
/// entropy from the OS RNG — the same quality as Python's `secrets.token_bytes`.
///
/// This mirrors the FastAPI implementation in auth/jwt.py:
///   raw  = secrets.token_bytes(REFRESH_TOKEN_BYTES)
///   hash = SHA-256(raw)   stored in DB
///   raw  returned to client
fn make_refresh_token(
    conn:    &rusqlite::Connection,
    user_id: i64,
) -> Result<String, String> {
    // Two UUIDs concatenated → 32 hex chars each → 64-char raw token.
    // Entropy: 2 × 122 bits = 244 bits — well above the Python 48-byte default.
    let raw_hex = format!(
        "{}{}",
        uuid::Uuid::new_v4().simple(),
        uuid::Uuid::new_v4().simple()
    );

    // SHA-256 of the raw token — only the hash is stored
    let hash_hex = sha256_hex(raw_hex.as_bytes());

    let expires_at = (Utc::now() + Duration::days(REFRESH_TOKEN_DAYS))
        .format("%Y-%m-%d %H:%M:%S")
        .to_string();

    conn.execute(
        "INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
         VALUES (?1, ?2, ?3)",
        params![user_id, hash_hex, expires_at],
    )
    .map_err(|e| e.to_string())?;

    Ok(raw_hex)
}

/// Validate a raw refresh token: hash it, look it up in the DB,
/// check not revoked and not expired.  Returns the user_id on success.
fn consume_refresh_token(
    conn:      &rusqlite::Connection,
    raw_token: &str,
) -> Result<i64, String> {
    let hash_hex = sha256_hex(raw_token.as_bytes());

    let row: Option<(i64, i64, String, i64)> = conn
        .query_row(
            "SELECT id, user_id, expires_at, revoked
             FROM refresh_tokens
             WHERE token_hash = ?1 LIMIT 1",
            params![hash_hex],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
        )
        .ok();

    let (rt_id, user_id, expires_at, revoked) = row
        .ok_or_else(|| "Invalid or unknown refresh token".to_string())?;

    if revoked != 0 {
        return Err("Refresh token has been revoked".into());
    }

    // Parse expires_at ("2025-01-15 10:30:00") as UTC
    let exp = chrono::NaiveDateTime::parse_from_str(&expires_at, "%Y-%m-%d %H:%M:%S")
        .map(|dt| dt.and_utc())
        .map_err(|_| "Could not parse token expiry".to_string())?;

    if Utc::now() > exp {
        return Err("Refresh token has expired".into());
    }

    // Revoke the used token (rotation — one-time use)
    conn.execute(
        "UPDATE refresh_tokens
         SET revoked = 1, revoked_at = datetime('now')
         WHERE id = ?1",
        params![rt_id],
    )
    .map_err(|e| e.to_string())?;

    Ok(user_id)
}

// ── Crypto utility ────────────────────────────────────────────────────────────

fn sha256_hex(data: &[u8]) -> String {
    let mut h = Sha256::new();
    h.update(data);
    h.finalize().iter().map(|b| format!("{b:02x}")).collect()
}

// ── Commands ──────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn register(
    state: tauri::State<'_, DbPath>,
    jwt:   tauri::State<'_, JwtSecret>,
    name:     String,
    email:    String,
    password: String,
) -> Result<AuthResponse, String> {
    let email = email.trim().to_lowercase();
    let name  = name.trim().to_string();

    if name.is_empty()     { return Err("Name cannot be empty".into()); }
    if email.is_empty()    { return Err("Email cannot be empty".into()); }
    if password.len() < 6  { return Err("Password must be at least 6 characters".into()); }

    let conn = open(&state.0).map_err(|e| e.to_string())?;

    // Check for duplicate email
    let exists: bool = conn
        .query_row(
            "SELECT COUNT(*) FROM users WHERE email = ?1",
            params![email],
            |r| r.get::<_, i64>(0),
        )
        .unwrap_or(0) > 0;

    if exists {
        return Err("Email already registered".into());
    }

    let pw_hash = hash(&password, DEFAULT_COST).map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO users (name, email, password) VALUES (?1, ?2, ?3)",
        params![name, email, pw_hash],
    )
    .map_err(|e| e.to_string())?;

    let user_id = conn.last_insert_rowid();

    // Insert default settings row for this user
    conn.execute(
        "INSERT OR IGNORE INTO user_settings (user_id) VALUES (?1)",
        params![user_id],
    )
    .map_err(|e| e.to_string())?;

    let access_token  = make_access_token(user_id, &jwt.0)?;
    let refresh_token = make_refresh_token(&conn, user_id)?;

    Ok(AuthResponse {
        access_token,
        refresh_token,
        user: UserInfo {
            id:    user_id.into(),
            name,
            email,
        },
    })
}

#[tauri::command]
pub async fn login(
    state: tauri::State<'_, DbPath>,
    jwt:   tauri::State<'_, JwtSecret>,
    email:    String,
    password: String,
) -> Result<AuthResponse, String> {
    let email = email.trim().to_lowercase();
    let conn  = open(&state.0).map_err(|e| e.to_string())?;

    // Fetch user row
    let row: Option<(i64, String, String, String, i64)> = conn
        .query_row(
            "SELECT id, name, email, password, is_active
             FROM users WHERE email = ?1 LIMIT 1",
            params![email],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?)),
        )
        .ok();

    let (user_id, name, stored_email, pw_hash, is_active) =
        row.ok_or_else(|| "Invalid email or password".to_string())?;

    if is_active == 0 {
        return Err("Account is deactivated".into());
    }

    if !verify(&password, &pw_hash).map_err(|e| e.to_string())? {
        return Err("Invalid email or password".into());
    }

    let access_token  = make_access_token(user_id, &jwt.0)?;
    let refresh_token = make_refresh_token(&conn, user_id)?;

    Ok(AuthResponse {
        access_token,
        refresh_token,
        user: UserInfo {
            id:    user_id.into(),
            name,
            email: stored_email,
        },
    })
}

#[tauri::command]
pub async fn logout(
    state:         tauri::State<'_, DbPath>,
    refresh_token: String,
) -> Result<(), String> {
    // Best-effort revoke — ignore errors (e.g. token already expired/unknown)
    if let Ok(conn) = open(&state.0) {
        let hash_hex = sha256_hex(refresh_token.as_bytes());
        let _ = conn.execute(
            "UPDATE refresh_tokens
             SET revoked = 1, revoked_at = datetime('now')
             WHERE token_hash = ?1",
            params![hash_hex],
        );
    }
    Ok(())
}

#[tauri::command]
pub async fn refresh_token(
    state:         tauri::State<'_, DbPath>,
    jwt:           tauri::State<'_, JwtSecret>,
    refresh_token: String,
) -> Result<AuthResponse, String> {
    let conn = open(&state.0).map_err(|e| e.to_string())?;

    // Validate and rotate the refresh token
    let user_id = consume_refresh_token(&conn, &refresh_token)?;

    // Issue new tokens
    let new_access  = make_access_token(user_id, &jwt.0)?;
    let new_refresh = make_refresh_token(&conn, user_id)?;

    // Fetch user profile
    let (name, email): (String, String) = conn
        .query_row(
            "SELECT name, email FROM users WHERE id = ?1",
            params![user_id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .map_err(|_| "User not found".to_string())?;

    Ok(AuthResponse {
        access_token:  new_access,
        refresh_token: new_refresh,
        user: UserInfo {
            id:    user_id.into(),
            name,
            email,
        },
    })
}

#[tauri::command]
pub async fn get_current_user(
    state: tauri::State<'_, DbPath>,
    jwt:   tauri::State<'_, JwtSecret>,
    token: String,
) -> Result<UserInfo, String> {
    let user_id = decode_access_token(&token, &jwt.0)?;
    let conn    = open(&state.0).map_err(|e| e.to_string())?;

    let (name, email): (String, String) = conn
        .query_row(
            "SELECT name, email FROM users WHERE id = ?1 AND is_active = 1",
            params![user_id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .map_err(|_| "User not found or account deactivated".to_string())?;

    Ok(UserInfo {
        id: user_id.into(),
        name,
        email,
    })
}