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

                // Try explicit env var first, then walk up from exe to find backend/.env
                let mut env_candidates: Vec<std::path::PathBuf> = Vec::new();
                if let Some(ref f) = env_file {
                    env_candidates.push(std::path::PathBuf::from(f));
                }
                // Walk up directory tree from exe to find backend/.env
                if let Some(ref dir) = exe_dir {
                    let mut search = Some(dir.as_path());
                    while let Some(cur) = search {
                        env_candidates.push(cur.join("backend").join(".env"));
                        search = cur.parent();
                    }
                }

                for path in env_candidates {
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

            // ── Resolve DB path ──────────────────────────────────────────────
            //
            // Priority:
            //   1. COGNILOAD_DB_PATH env var  (explicit override)
            //   2. <exe_dir>/backend/cogniload.db   (dev: cargo tauri dev)
            //   3. <exe_dir>/../backend/cogniload.db (alt dev layout)
            //   4. <exe_dir>/cogniload.db            (packaged .exe with bundled backend)
            //   5. app-data dir / cogniload.db        (standalone fallback)
            //
            // This makes the Tauri desktop app share the same SQLite database
            // as the FastAPI web backend, so accounts registered via the web
            // app (http://localhost:5173) work in the desktop app as-is.
            let db_path_str = {
                let mut resolved: Option<String> = None;

                // 1. Explicit env override
                if let Ok(explicit) = std::env::var("COGNILOAD_DB_PATH") {
                    let p = std::path::PathBuf::from(&explicit);
                    if p.exists() {
                        resolved = Some(explicit);
                    }
                }

                // 2. Walk up from the exe directory looking for backend/cogniload.db
                //    This handles deep build output dirs like target\debug\
                if resolved.is_none() {
                    if let Some(ref dir) = exe_dir {
                        let mut search = Some(dir.as_path());
                        while let Some(cur) = search {
                            let candidate = cur.join("backend").join("cogniload.db");
                            if candidate.exists() {
                                let s = candidate.to_string_lossy().to_string();
                                println!("[setup] Using existing web-app DB at {}", candidate.display());
                                resolved = Some(s);
                                break;
                            }
                            // Also check cogniload.db directly beside an exe that bundles the backend
                            let beside = cur.join("cogniload.db");
                            if beside.exists() {
                                let s = beside.to_string_lossy().to_string();
                                println!("[setup] Using existing web-app DB at {}", beside.display());
                                resolved = Some(s);
                                break;
                            }
                            search = cur.parent();
                        }
                    }
                }

                // 5. Fallback — Tauri's own app-data dir (standalone mode)
                resolved.unwrap_or_else(|| {
                    let p = data_dir.join("cogniload.db");
                    eprintln!(
                        "[setup] WARNING: web-app DB not found.                          Using standalone DB at {}.                          Accounts created here won't be shared with the web app.                          Set COGNILOAD_DB_PATH to override.",
                        p.display()
                    );
                    p.to_string_lossy().to_string()
                })
            };

            // ── Init DB schema ───────────────────────────────────────────────
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