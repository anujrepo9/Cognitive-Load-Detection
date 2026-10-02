use std::sync::Mutex;
use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandChild;

// Global handle so we can kill the process on exit
static BACKEND: Mutex<Option<CommandChild>> = Mutex::new(None);

/// Internal: spawns the Python backend sidecar
pub async fn start_backend(app: AppHandle) -> Result<(), String> {
    let mut guard = BACKEND.lock().map_err(|e| e.to_string())?;

    // Already running
    if guard.is_some() {
        return Ok(());
    }

    let (_rx, child) = app
        .shell()
        .sidecar("cogniload_backend")
        .map_err(|e| e.to_string())?
        .spawn()
        .map_err(|e| e.to_string())?;

    *guard = Some(child);
    Ok(())
}

/// Internal: kills the Python backend sidecar
pub async fn stop_backend(app: AppHandle) {
    let mut guard = match BACKEND.lock() {
        Ok(g) => g,
        Err(_) => return,
    };
    if let Some(child) = guard.take() {
        let _ = child.kill();
    }
    drop(app); // keep signature compatible
}

// ── Tauri commands (callable from React) ────────────────────────────────────

#[tauri::command]
pub async fn start_backend_cmd(app: AppHandle) -> Result<(), String> {
    start_backend(app).await
}

#[tauri::command]
pub async fn stop_backend_cmd(app: AppHandle) -> Result<(), String> {
    stop_backend(app).await;
    Ok(())
}

#[tauri::command]
pub fn backend_status() -> bool {
    BACKEND.lock().map(|g| g.is_some()).unwrap_or(false)
}
