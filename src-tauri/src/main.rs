#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod auth;
mod behavior;
mod collector;
mod db;
mod predict;
mod session;
mod settings;

use db::DbPath;
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

            // ── Copy ML assets → app data dir ────────────────────────────────
            //
            // Search order for each asset:
            //   1. <exe_dir>/resources/<asset>   ← dev: put files here manually
            //   2. <exe_dir>/<asset>             ← portable layout
            //   3. <bundle resource_dir>/<asset> ← packaged .exe (tauri.release.conf.json)
            //
            // resource_dir() is the correct Tauri 2 API (resolve_resource does
            // not exist on PathResolver in this version).
            //
            // Only copies when destination doesn't exist so a manually placed
            // model upgrade is never overwritten on relaunch.
            let exe_dir = std::env::current_exe()
                .ok()
                .and_then(|p| p.parent().map(|d| d.to_path_buf()));

            let resource_dir = app.path().resource_dir().ok();

            for asset in &["model.onnx", "scaler_params.json", "onnxruntime.dll"] {
                let dst = data_dir.join(asset);
                if dst.exists() {
                    continue;
                }

                let mut candidates: Vec<std::path::PathBuf> = Vec::new();

                // 1. <exe_dir>/resources/<asset>  (dev layout)
                if let Some(ref dir) = exe_dir {
                    candidates.push(dir.join("resources").join(asset));
                    // 2. <exe_dir>/<asset>  (portable)
                    candidates.push(dir.join(asset));
                }
                // 3. Tauri bundle resource dir (packaged .exe)
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
                        // Not fatal — predict.rs returns a clear error to the
                        // frontend on first prediction attempt.
                        // For dev: place files at src-tauri/resources/<asset>
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

            // ── Start native input collector thread ──────────────────────────
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                collector::run(handle);
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Auth
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
