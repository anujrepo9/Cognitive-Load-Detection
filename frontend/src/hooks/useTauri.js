import { useEffect, useState } from "react"
import { collectorAPI } from "../services/api"

// True when running inside the Tauri desktop shell
export const isTauri = typeof window !== "undefined" && "__TAURI__" in window

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