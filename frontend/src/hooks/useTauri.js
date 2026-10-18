import { useEffect, useState } from "react"
import { collectorAPI } from "../services/api"

// Tauri 2 injects window.__TAURI_INTERNALS__ synchronously before any JS runs.
// withGlobalTauri:true also adds window.__TAURI__ but only after the bundle
// executes. Checking both covers all Tauri 2 configs and Tauri 1 compat.
export const isTauri =
  typeof window !== "undefined" &&
  ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)

export function useTauri() {
  const [collectorEnabled, setCollectorEnabled] = useState(false)

  useEffect(() => {
    if (!isTauri) return
    collectorAPI.status().then((s) => setCollectorEnabled(s.enabled)).catch(() => {})
    const id = setInterval(() => {
      collectorAPI.status().then((s) => setCollectorEnabled(s.enabled)).catch(() => {})
    }, 5000)
    return () => clearInterval(id)
  }, [])

  return { isTauri, collectorEnabled }
}

