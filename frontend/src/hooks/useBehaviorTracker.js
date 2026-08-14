import { useEffect, useRef, useCallback, useState } from "react"
import { behaviorAPI, settingsAPI } from "../services/api"

const DEFAULT_FLUSH_MS = 5000

export function useBehaviorTracker(enabled = true) {
  const buffer = useRef({
    keyEvents:    [],
    mouseEvents:  [],
    scrollEvents: [],
    sessionStart: Date.now(),
  })

  const [settings, setSettings] = useState({
    loaded: false,
    trackingEnabled: true,
    flushIntervalMs: DEFAULT_FLUSH_MS,
  })

  // Load the user's tracking preferences before attaching global listeners.
  useEffect(() => {
    if (!enabled) {
      setSettings((current) => ({ ...current, loaded: true, trackingEnabled: false }))
      return
    }

    settingsAPI.get()
      .then(({ data }) => {
        setSettings({
          loaded: true,
          trackingEnabled: data?.tracking_enabled !== false,
          flushIntervalMs: (data?.flush_interval_sec || DEFAULT_FLUSH_MS) * 1000,
        })
      })
      .catch(() => {
        // The tracker cannot submit predictions without the backend, so leave it disabled.
        setSettings((current) => ({ ...current, loaded: true, trackingEnabled: false }))
      })
  }, [enabled])

  const trackerEnabled = enabled && settings.loaded && settings.trackingEnabled

  const lastKey   = useRef({ key: null, downTime: null })
  const lastMouse = useRef({ x: 0, y: 0, time: Date.now() })
  const idleTimer = useRef(null)
  const idleStart = useRef(null)
  const totalIdle = useRef(0)

  // ── Keyboard ──────────────────────────────────────────────────────────────
  const onKeyDown = useCallback((e) => {
    lastKey.current = { key: e.key, downTime: performance.now() }
    resetIdle()
  }, [])

  const onKeyUp = useCallback((e) => {
    const { key, downTime } = lastKey.current
    if (key !== e.key || downTime === null) return

    const holdTime = performance.now() - downTime
    const prev     = buffer.current.keyEvents.at(-1)
    const flightTime = prev ? downTime - prev._upTime : null

    buffer.current.keyEvents.push({
      key:       e.key,
      holdTime:  Math.round(holdTime),
      flightTime: flightTime ? Math.round(flightTime) : null,
      isError:   e.key === "Backspace",
      timestamp: Date.now(),
      _upTime:   performance.now(),
    })
  }, [])

  // ── Mouse ─────────────────────────────────────────────────────────────────
  const onMouseMove = useCallback((e) => {
    const now  = performance.now()
    const dt   = (now - lastMouse.current.time) / 1000 || 0.001
    const dx   = e.clientX - lastMouse.current.x
    const dy   = e.clientY - lastMouse.current.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    const speed = dist / dt

    buffer.current.mouseEvents.push({
      x: e.clientX, y: e.clientY,
      speed:    Math.round(speed),
      distance: Math.round(dist),
      timestamp: Date.now(),
    })
    lastMouse.current = { x: e.clientX, y: e.clientY, time: now }
    resetIdle()
  }, [])

  const onMouseDown = useCallback(() => {
    buffer.current.mouseEvents.push({ type: "click", timestamp: Date.now() })
    resetIdle()
  }, [])

  const onWheel = useCallback((e) => {
    buffer.current.scrollEvents.push({ deltaY: e.deltaY, timestamp: Date.now() })
    resetIdle()
  }, [])

  // ── Idle detection ────────────────────────────────────────────────────────
  const resetIdle = () => {
    if (idleStart.current) {
      totalIdle.current += Date.now() - idleStart.current
      idleStart.current = null
    }
    clearTimeout(idleTimer.current)
    idleTimer.current = setTimeout(() => { idleStart.current = Date.now() }, 2000)
  }

  // ── Feature extraction ────────────────────────────────────────────────────
  const extractFeatures = useCallback(() => {
    const { keyEvents, mouseEvents, scrollEvents, sessionStart } = buffer.current
    const elapsed = (Date.now() - sessionStart) / 1000 / 60 // minutes

    if (keyEvents.length < 5) return null

    const holds   = keyEvents.map((e) => e.holdTime)
    const flights = keyEvents.map((e) => e.flightTime).filter(Boolean)
    const errors  = keyEvents.filter((e) => e.isError).length
    const words   = keyEvents.filter((e) => e.key === " ").length
    const wpm     = elapsed > 0 ? Math.round(words / elapsed) : 0

    const avgHold   = avg(holds)
    const avgFlight = avg(flights)
    const variance  = stdDev(holds) / (avgHold || 1)

    const speeds   = mouseEvents.filter((e) => e.speed    != null).map((e) => e.speed)
    const clicks   = mouseEvents.filter((e) => e.type === "click").length
    const totalDist = mouseEvents.filter((e) => e.distance != null)
      .reduce((s, e) => s + e.distance, 0)

    const idlePct = totalIdle.current / ((Date.now() - sessionStart) || 1)

    const pauses = []
    for (let i = 1; i < keyEvents.length; i++) {
      const gap = keyEvents[i].timestamp - keyEvents[i - 1].timestamp
      if (gap > 2000) pauses.push(gap)
    }

    return {
      typing_wpm:         wpm,
      avg_hold_ms:        Math.round(avgHold),
      avg_flight_ms:      Math.round(avgFlight),
      error_rate:         parseFloat((errors / keyEvents.length).toFixed(4)),
      pause_count:        pauses.length,
      avg_pause_ms:       Math.round(avg(pauses) || 0),
      typing_variance:    parseFloat(variance.toFixed(4)),
      chars_per_min:      elapsed > 0 ? Math.round(keyEvents.length / elapsed) : 0,
      avg_cursor_speed:   Math.round(avg(speeds)),
      click_rate:         elapsed > 0 ? parseFloat((clicks / elapsed).toFixed(2)) : 0,
      double_click_rate:  0,
      scroll_rate:        elapsed > 0 ? parseFloat((scrollEvents.length / elapsed).toFixed(2)) : 0,
      idle_time_pct:      parseFloat(Math.min(idlePct, 0.95).toFixed(4)),
      avg_hover_ms:       0,
      movement_distance:  Math.round(totalDist),
      movement_smoothness: parseFloat(Math.max(0.1, Math.min(1, 1 - variance)).toFixed(4)),
    }
  }, [])

  // ── Flush loop — sends to /predict so WS broadcast fires ─────────────────
  const flush = useCallback(async () => {
    const features = extractFeatures()
    if (!features) return
    try {
      // POST to /predict; the backend will broadcast the result over WebSocket
      await behaviorAPI.predict(features)
    } catch {
      // Graceful — don't interrupt the user; offline queue (Phase 4) handles retry
    }
    // Reset buffers but keep session timer
    buffer.current.keyEvents    = []
    buffer.current.mouseEvents  = []
    buffer.current.scrollEvents = []
    totalIdle.current = 0
  }, [extractFeatures])

  // ── Dynamic interval — re-creates when flushIntervalMs changes ───────────
  const intervalRef = useRef(null)
  useEffect(() => {
    if (!trackerEnabled) return
    intervalRef.current = setInterval(flush, settings.flushIntervalMs)
    return () => clearInterval(intervalRef.current)
  }, [trackerEnabled, settings.flushIntervalMs, flush])

  useEffect(() => {
    if (!trackerEnabled) return
    window.addEventListener("keydown",  onKeyDown)
    window.addEventListener("keyup",    onKeyUp)
    window.addEventListener("mousemove", onMouseMove)
    window.addEventListener("mousedown", onMouseDown)
    window.addEventListener("wheel",    onWheel, { passive: true })
    return () => {
      window.removeEventListener("keydown",  onKeyDown)
      window.removeEventListener("keyup",    onKeyUp)
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("mousedown", onMouseDown)
      window.removeEventListener("wheel",    onWheel)
      clearTimeout(idleTimer.current)
    }
  }, [trackerEnabled, onKeyDown, onKeyUp, onMouseMove, onMouseDown, onWheel])

  return { extractFeatures }
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const avg = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
const stdDev = (arr) => {
  const m = avg(arr)
  return Math.sqrt(avg(arr.map((x) => (x - m) ** 2)))
}
