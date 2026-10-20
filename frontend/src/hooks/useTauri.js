import { useEffect, useState } from "react"
import { collectorAPI } from "../services/api"

// isTauri() is a lazy getter defined in api.js — it detects Tauri globals on
// first call (inside an async body), not at module-evaluation time, avoiding
// the race condition where withGlobalTauri injects window.__TAURI__ after the
// bundle has already evaluated all top-level consts.
//
// We mirror the same lazy detection here so this hook stays consistent with
// the rest of the codebase.
function _detectTauri() {
  return (
    typeof window !== "undefined" &&
    ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)
  )
}

// isTauri is a stable boolean after the first call — environment cannot change
// mid-session.  We export it as a function to match api.js's pattern.
export const isTauri = _detectTauri

export function useTauri() {
  const [collectorEnabled, setCollectorEnabled] = useState(false)

  useEffect(() => {
    // _detectTauri() is evaluated here — inside useEffect, which runs after
    // the component mounts (i.e. after Tauri has finished its injection).
    if (!_detectTauri()) return
    collectorAPI.status().then((s) => setCollectorEnabled(s.enabled)).catch(() => {})
    const id = setInterval(() => {
      collectorAPI.status().then((s) => setCollectorEnabled(s.enabled)).catch(() => {})
    }, 5000)
    return () => clearInterval(id)
  }, [])

  return { isTauri: _detectTauri(), collectorEnabled }
}