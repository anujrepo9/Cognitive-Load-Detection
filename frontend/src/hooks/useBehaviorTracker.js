import { useEffect, useRef, useCallback, useState } from "react"
import { behaviorAPI, settingsAPI } from "../services/api"

const DEFAULT_FLUSH_MS = 15000

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
        setSettings((current) => ({ ...current, loaded: true, trackingEnabled: false }))
      })
  }, [enabled])

  const trackerEnabled = enabled && settings.loaded && settings.trackingEnabled

  const windowStart = useRef(Date.now())
  const lastKey     = useRef({ key: null, downTime: null })
  const lastMouse   = useRef({ x: 0, y: 0, time: Date.now() })
  const lastSpeed   = useRef(0)                              // FIX 3: for acceleration
  const idleTimer   = useRef(null)
  const idleStart   = useRef(null)
  const totalIdle   = useRef(0)

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
      key:        e.key,
      holdTime:   Math.round(holdTime),
      flightTime: flightTime ? Math.round(flightTime) : null,
      isError:    e.key === "Backspace",
      timestamp:  Date.now(),
      _upTime:    performance.now(),
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

    // FIX 3: track acceleration (change in speed over time)
    const accel = (speed - lastSpeed.current) / dt
    lastSpeed.current = speed

    buffer.current.mouseEvents.push({
      x: e.clientX, y: e.clientY,
      speed:        Math.round(speed),
      distance:     Math.round(dist),
      acceleration: Math.round(accel),
      timestamp:    Date.now(),
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
    const now     = Date.now()
    const windowSec = (now - windowStart.current) / 1000          // seconds
    const windowMin = windowSec / 60                               // minutes

    // FIX 1: Remove the hard gate (keyEvents.length < 5 → return null).
    // Windows with zero keys are valid data points — they show the user was
    // idle or mouse-only. Send them with keyboard fields zeroed out so the
    // database always has a complete record for every flush window.
    // (typing_wpm stays null/0 when no keys were pressed, matching Python behaviour.)

    const holds   = keyEvents.map((e) => e.holdTime)
    const flights = keyEvents.map((e) => e.flightTime).filter(Boolean)
    const errors  = keyEvents.filter((e) => e.isError).length
    const backspaces = errors  // alias for clarity below

    // FIX 2: Use the standard 5-chars-per-word WPM formula, matching metrics.py.
    // Old code counted spaces as words — wrong and mismatched with the Python collector.
    const netChars = keyEvents.filter((e) => !e.isError && e.key !== " ").length
    const typingWpm = (netChars > 0 && windowMin > 0)
      ? Math.round(netChars / (5 * windowMin))
      : null   // null = "not enough typing", stored as SQL NULL — matches Python

    const charsPerMin = windowMin > 0 ? Math.round(keyEvents.length / windowMin) : 0

    const avgHold   = avg(holds)
    const avgFlight = avg(flights)

    // FIX 2 (continued): error_rate denominator excludes backspaces themselves,
    // matching the Python fix in metrics.py.
    const netKeys  = keyEvents.length - backspaces
    const errorRate = netKeys > 0 ? parseFloat((backspaces / netKeys).toFixed(4)) : 0

    // FIX 4: Use 500 ms pause threshold to match metrics.py.
    // Old code used 2000 ms — too high; pause_count was always 0.
    const PAUSE_THRESHOLD_MS = 500
    const pauses = []
    for (let i = 1; i < keyEvents.length; i++) {
      const gap = keyEvents[i].timestamp - keyEvents[i - 1].timestamp
      if (gap > PAUSE_THRESHOLD_MS) pauses.push(gap)
    }

    // typing_variance: std of flight times / avg flight time (rhythm variance)
    // Matches the Python FIX 4 in metrics.py — flight times capture rhythm
    // disruptions far better than hold-time CV.
    const flightStd = stdDev(flights)
    const typingVariance = avgFlight > 0
      ? parseFloat((flightStd / avgFlight).toFixed(4))
      : 0

    const speeds    = mouseEvents.filter((e) => e.speed    != null).map((e) => e.speed)
    const accels    = mouseEvents.filter((e) => e.acceleration != null).map((e) => e.acceleration)
    const clicks    = mouseEvents.filter((e) => e.type === "click").length
    const totalDist = mouseEvents.filter((e) => e.distance != null)
      .reduce((s, e) => s + e.distance, 0)

    const idlePct  = totalIdle.current / ((now - sessionStart) || 1)
    const avgSpeed = avg(speeds)

    // Smoothness: 1 − speed CV, matching Python metrics.py
    const speedCv      = avgSpeed > 0 ? stdDev(speeds) / avgSpeed : 1
    const smoothness   = parseFloat(Math.max(0.1, Math.min(1, 1 - speedCv)).toFixed(4))

    // FIX 3: include avg_acceleration so the backend field is populated.
    const avgAccel = avg(accels)

    return {
      typing_wpm:          typingWpm,             // null when no typing — matches Python
      chars_per_min:       charsPerMin,
      avg_hold_ms:         Math.round(avgHold),
      avg_flight_ms:       Math.round(avgFlight),
      error_rate:          errorRate,
      pause_count:         pauses.length,
      avg_pause_ms:        Math.round(avg(pauses) || 0),
      typing_variance:     typingVariance,
      avg_cursor_speed:    Math.round(avgSpeed),
      movement_distance:   Math.round(totalDist),
      click_rate:          windowMin > 0 ? parseFloat((clicks / windowMin).toFixed(2)) : 0,
      double_click_rate:   0,
      scroll_rate:         windowMin > 0 ? parseFloat((scrollEvents.length / windowMin).toFixed(2)) : 0,
      idle_time_pct:       parseFloat(Math.min(idlePct, 0.95).toFixed(4)),
      avg_hover_ms:        0,
      avg_acceleration:    Math.round(avgAccel),  // FIX 3: was always missing
      movement_smoothness: smoothness,
    }
  }, [])

  // ── Flush loop — sends to /predict so WS broadcast fires ─────────────────
  const flush = useCallback(async () => {
    const features = extractFeatures()
    if (!features) return
    try {
      await behaviorAPI.predict(features)
    } catch {
      // Graceful — offline queue handles retry
    }
    // Reset buffers and window timer
    buffer.current.keyEvents    = []
    buffer.current.mouseEvents  = []
    buffer.current.scrollEvents = []
    totalIdle.current = 0
    windowStart.current = Date.now()
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
    window.addEventListener("keydown",   onKeyDown)
    window.addEventListener("keyup",     onKeyUp)
    window.addEventListener("mousemove", onMouseMove)
    window.addEventListener("mousedown", onMouseDown)
    window.addEventListener("wheel",     onWheel, { passive: true })
    return () => {
      window.removeEventListener("keydown",   onKeyDown)
      window.removeEventListener("keyup",     onKeyUp)
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("mousedown", onMouseDown)
      window.removeEventListener("wheel",     onWheel)
      clearTimeout(idleTimer.current)
    }
  }, [trackerEnabled, onKeyDown, onKeyUp, onMouseMove, onMouseDown, onWheel])

  return { extractFeatures }
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const avg = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
const stdDev = (arr) => {
  if (arr.length < 2) return 0
  const m = avg(arr)
  return Math.sqrt(avg(arr.map((x) => (x - m) ** 2)))
}