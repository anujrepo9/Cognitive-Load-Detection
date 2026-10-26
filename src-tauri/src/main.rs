#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod auth;
mod behavior;
mod collector;
mod db;
mod predict;
mod session;
mod settings;

use db::DbPath;
use auth::JwtSecret;
use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // ── Resolve app data dir ──────────────────────────────────────────
            let data_dir = app
                .path()
                .app_data_dir()
                .expect("failed to get app data dir");
            std::fs::create_dir_all(&data_dir).expect("cannot create data dir");

            // ── Read SECRET_KEY from the backend's .env ───────────────────────
            //
            // The FastAPI backend reads its .env from the backend/ directory
            // (or from COGNILOAD_ENV_FILE for the packaged .exe).
            // We read the same file so JWT tokens issued by the backend can be
            // validated locally in session/behavior/predict/settings commands.
            //
            // Search order:
            //   1. COGNILOAD_ENV_FILE env var (set by the packaged .exe launcher)
            //   2. <exe_dir>/backend/.env       (dev: cargo tauri dev)
            //   3. <exe_dir>/../backend/.env    (alt dev layout)
            //   4. Fall back to the default dev secret
            let default_secret = "dev-secret-change-me".to_string();
            let jwt_secret = {
                let mut secret = default_secret.clone();

                let env_file = std::env::var("COGNILOAD_ENV_FILE").ok();
                let exe_dir  = std::env::current_exe()
                    .ok()
                    .and_then(|p| p.parent().map(|d| d.to_path_buf()));

                let candidates: Vec<std::path::PathBuf> = {
                    let mut v = Vec::new();
                    if let Some(ref f) = env_file {
                        v.push(std::path::PathBuf::from(f));
                    }
                    if let Some(ref dir) = exe_dir {
                        v.push(dir.join("backend").join(".env"));
                        v.push(dir.join("..").join("backend").join(".env"));
                    }
                    v
                };

                for path in candidates {
                    if path.exists() {
                        if let Ok(contents) = std::fs::read_to_string(&path) {
                            for line in contents.lines() {
                                let line = line.trim();
                                if line.starts_with("SECRET_KEY=") {
                                    let val = line["SECRET_KEY=".len()..].trim().trim_matches('"');
                                    if !val.is_empty() {
                                        secret = val.to_string();
                                        println!("[setup] JWT secret loaded from {}", path.display());
                                    }
                                    break;
                                }
                            }
                        }
                        break;
                    }
                }

                if secret == default_secret {
                    eprintln!(
                        "[setup] WARNING: Using default JWT secret. \
                         Create backend/.env with SECRET_KEY= to match the backend."
                    );
                }
                secret
            };

            // ── Copy ML assets → app data dir ────────────────────────────────
            let exe_dir = std::env::current_exe()
                .ok()
                .and_then(|p| p.parent().map(|d| d.to_path_buf()));
            let resource_dir = app.path().resource_dir().ok();

            for asset in &["model.onnx", "scaler_params.json", "onnxruntime.dll"] {
                let dst = data_dir.join(asset);
                if dst.exists() { continue; }

                let mut candidates: Vec<std::path::PathBuf> = Vec::new();
                if let Some(ref dir) = exe_dir {
                    candidates.push(dir.join("resources").join(asset));
                    candidates.push(dir.join(asset));
                }
                if let Some(ref rdir) = resource_dir {
                    candidates.push(rdir.join("resources").join(asset));
                    candidates.push(rdir.join(asset));
                }

                match candidates.into_iter().find(|p| p.exists()) {
                    Some(src) => {
                        std::fs::copy(&src, &dst)
                            .unwrap_or_else(|e| panic!("failed to copy {asset}: {e}"));
                        println!("[setup] copied {asset} → {}", dst.display());
                    }
                    None => {
                        eprintln!(
                            "[setup] WARNING: {asset} not found. \
                             For dev, place it at: src-tauri/resources/{asset}"
                        );
                    }
                }
            }

            // ── Init DB schema ───────────────────────────────────────────────
            let db_path     = data_dir.join("cogniload.db");
            let db_path_str = db_path.to_string_lossy().to_string();
            db::init_db(&db_path_str).expect("DB init failed");
            app.manage(DbPath(db_path_str));
            app.manage(JwtSecret(jwt_secret));

            // ── Start native input collector thread ──────────────────────────
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                collector::run(handle);
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Auth — proxies to FastAPI backend (shared account with web app)
            auth::register,
            auth::login,
            auth::logout,
            auth::refresh_token,
            auth::get_current_user,
            // Sessions
            session::start_session,
            session::end_session,
            session::get_sessions,
            session::get_session,
            session::get_current_session,
            session::pause_session,
            session::resume_session,
            // Behavior
            behavior::flush_behavior,
            behavior::get_behavior_history,
            // Predict
            predict::predict_load,
            predict::get_predictions,
            // Collector control
            collector::set_tracking_enabled,
            collector::get_tracking_status,
            // Settings & profile
            settings::get_settings,
            settings::update_settings,
            settings::get_autostart,
            settings::set_autostart,
            settings::update_profile,
            settings::change_password,
            // Dashboard / reporting
            settings::get_overview,
            settings::get_model_info,
            settings::get_recommendation,
            settings::export_csv,
            settings::get_history,
            // Analytics
            settings::get_analytics_trends,
            settings::get_analytics_features,
            // Reports
            settings::get_daily_reports,
            settings::get_weekly_reports,
            // App usage
            settings::get_app_usage_summary,
            settings::get_app_usage_timeline,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}