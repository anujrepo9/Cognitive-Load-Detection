// main.rs — CogniLoad Tauri 2 entry point
// Registers all Tauri commands and plugins, initialises the SQLite database.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod db;
mod auth;
mod session;
mod behavior;
mod predict;
mod sidecar;

use tauri::Manager;

fn main() {
    tauri::Builder::default()
        // ── Plugins ────────────────────────────────────────────────────────
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())

        // ── Setup: init DB on first launch ─────────────────────────────────
        .setup(|app| {
            let app_dir = app
                .path()
                .app_data_dir()
                .expect("failed to resolve app data dir");

            std::fs::create_dir_all(&app_dir)
                .expect("failed to create app data dir");

            let db_path = app_dir.join("cogniload.db");

            db::init_db(&db_path.to_string_lossy())
                .expect("failed to initialise SQLite database");

            // Store db_path in app state so commands can access it
            app.manage(db::DbPath(db_path.to_string_lossy().to_string()));

            Ok(())
        })

        // ── Commands ────────────────────────────────────────────────────────
        .invoke_handler(tauri::generate_handler![
            // auth
            auth::register,
            auth::login,
            auth::logout,
            auth::refresh_token,
            auth::get_current_user,

            // session
            session::start_session,
            session::end_session,
            session::pause_session,
            session::resume_session,
            session::current_session,

            // behavior
            behavior::save_behavior,
            behavior::list_behaviors,

            // prediction
            predict::predict_load,
            predict::list_predictions,

            // sidecar
            sidecar::start_collector,
            sidecar::stop_collector,
            sidecar::collector_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running CogniLoad");
}