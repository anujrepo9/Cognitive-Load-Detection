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
            // ── Resolve DB path inside app data dir ──────────────────────────
            let data_dir = app
                .path()
                .app_data_dir()
                .expect("failed to get app data dir");
            std::fs::create_dir_all(&data_dir).expect("cannot create data dir");
            let db_path = data_dir.join("cogniload.db");
            let db_path_str = db_path.to_string_lossy().to_string();

            // ── Init schema ──────────────────────────────────────────────────
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