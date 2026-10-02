// Prevents a console window from opening on Windows in release builds
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod sidecar;

use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let app_handle = app.handle().clone();
            // Auto-start the Python backend when the app opens
            tauri::async_runtime::spawn(async move {
                if let Err(e) = sidecar::start_backend(app_handle).await {
                    eprintln!("Failed to start backend: {e}");
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            sidecar::start_backend_cmd,
            sidecar::stop_backend_cmd,
            sidecar::backend_status,
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                let handle = window.app_handle().clone();
                tauri::async_runtime::spawn(async move {
                    sidecar::stop_backend(handle).await;
                });
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}