import { useEffect, useState } from "react";

// Detect whether we're running inside Tauri or a plain browser
const isTauri = typeof window !== "undefined" && "__TAURI__" in window;

export function useTauri() {
  const [backendRunning, setBackendRunning] = useState(false);

  useEffect(() => {
    if (!isTauri) return;

    let invoke;
    import("@tauri-apps/api/core").then(({ invoke: inv }) => {
      invoke = inv;
      inv("backend_status").then(setBackendRunning);
    });

    // Poll status every 5 s so the UI can show a warning if backend crashes
    const id = setInterval(() => {
      if (invoke) invoke("backend_status").then(setBackendRunning);
    }, 5000);

    return () => clearInterval(id);
  }, []);

  const startBackend = async () => {
    if (!isTauri) return;
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("start_backend_cmd");
    setBackendRunning(true);
  };

  const stopBackend = async () => {
    if (!isTauri) return;
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("stop_backend_cmd");
    setBackendRunning(false);
  };

  return { isTauri, backendRunning, startBackend, stopBackend };
}