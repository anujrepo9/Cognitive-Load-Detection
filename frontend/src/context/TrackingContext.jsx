import {
  createContext, useCallback, useContext, useEffect,
  useMemo, useRef, useState,
} from "react"
import { useAuth } from "./AuthContext"
import { sessionAPI, behaviorAPI, predictAPI, collectorAPI } from "../services/api"
import { useWebSocket } from "../hooks/useWebSocket"
import { isTauri } from "../hooks/useTauri"

const TrackingContext = createContext(null)

const CONSENT_VERSION    = "behavioral-metrics-v1"
const DEFAULT_FLUSH_MS   = 15_000   // 15 s — Rust collector accumulates, then we drain

export function TrackingProvider({ children }) {
  const { user, isAuth } = useAuth()

  const [trackingState, setTrackingState] = useState("idle")  // idle | starting | tracking | paused | ending
  const [consentOpen,   setConsentOpen]   = useState(false)
  const [session,       setSession]       = useState(null)
  const [prediction,    setPrediction]    = useState(null)
  // Browser/.exe build: the Python collector pushes predictions server-side and the
  // backend broadcasts them over /ws/predictions. (Tauri build uses invoke() instead.)
  const ws = useWebSocket(isAuth && !isTauri())
  // Fallback when the WebSocket is not connected: pick up the latest saved prediction by polling.
  const [polledPrediction, setPolledPrediction] = useState(null)
  const lastPredCountRef = useRef(0)
  const [error,         setError]         = useState(null)
  const [flushMs,       setFlushMs]       = useState(DEFAULT_FLUSH_MS)

  const flushTimerRef      = useRef(null)
  // Guard: only one flush may be in-flight at a time.  Without this, the
  // periodic setInterval tick and the final flush inside endTracking can both
  // call predict_load concurrently, racing on the Rust ORT_SESSION mutex and
  // causing the "End button freezes forever" deadlock.
  const flushInProgressRef = useRef(false)

  // ── Consent ───────────────────────────────────────────────────────────────
  const consentKey = user ? `cogniload.consent.${user.id}` : null
  const hasConsent = Boolean(consentKey && localStorage.getItem(consentKey) === CONSENT_VERSION)

  // ── Flush: drain Rust collector → SQLite → ONNX inference ────────────────
  const flush = useCallback(async () => {
    if (!session) return
    // Skip if a flush is already in progress — prevents concurrent ORT calls.
    if (flushInProgressRef.current) return
    flushInProgressRef.current = true
    try {
      // 1. Drain collector buffer → write behavior_data row.
      //    behaviorRecord has shape: { id, session_id, timestamp, typing_wpm,
      //    chars_per_min, avg_hold_ms, ... (17 feature fields) }
      const behaviorRecord = await behaviorAPI.flush(session.id)

      // 2. FIX: extract just the 17-feature payload fields before sending to
      //    predict_load. The Rust command expects a BehaviorPayload (feature
      //    fields only). Passing the whole BehaviorRecord (which also has id,
      //    session_id, timestamp) caused a serde deserialization mismatch and
      //    silently dropped predictions.
      const {
        typing_wpm, chars_per_min, avg_hold_ms, avg_flight_ms,
        error_rate, pause_count, avg_pause_ms, typing_variance,
        avg_cursor_speed, movement_distance, click_rate, double_click_rate,
        scroll_rate, idle_time_pct, avg_hover_ms, avg_acceleration,
        movement_smoothness,
      } = behaviorRecord

      const behaviorPayload = {
        typing_wpm, chars_per_min, avg_hold_ms, avg_flight_ms,
        error_rate, pause_count, avg_pause_ms, typing_variance,
        avg_cursor_speed, movement_distance, click_rate, double_click_rate,
        scroll_rate, idle_time_pct, avg_hover_ms, avg_acceleration,
        movement_smoothness,
      }

      // 3. Run ONNX inference on the payload
      const pred = await predictAPI.predict(session.id, behaviorPayload, behaviorRecord.id)

      // 4. FIX: merge behavior data into the prediction object so LiveMonitoring
      //    can read keys_pressed, mouse_events, typing_wpm from it.
      //    Rust's Prediction only has { load_level, confidence, raw_scores, ... }.
      //    LiveMonitoring and TrackingContext both read keys_pressed, mouse_events,
      //    and typing_wpm from the prediction — those come from the behavior record.
      if (pred) {
        // Tauri: BehaviorRecord includes raw_key_presses / raw_mouse_clicks,
        // the exact counts drained from the collector this flush window.
        // HTTP/.exe build: those fields are absent (backend doesn't return them),
        // so fall back to rate × window estimates.
        const windowMin = flushMs / 60_000
        const keysThisWindow = behaviorRecord.raw_key_presses != null
          ? behaviorRecord.raw_key_presses
          : Math.round((behaviorRecord.chars_per_min ?? 0) * windowMin)
        const mouseThisWindow = behaviorRecord.raw_mouse_clicks != null
          ? behaviorRecord.raw_mouse_clicks
          : Math.round(((behaviorRecord.click_rate ?? 0) + (behaviorRecord.scroll_rate ?? 0)) * windowMin)
        setPrediction({
          ...pred,
          keys_pressed:  keysThisWindow,
          mouse_events:  mouseThisWindow,
          typing_wpm:    behaviorRecord.typing_wpm ?? null,
        })
      }
    } catch {
      // offline or model not ready — silent, will retry next interval
    } finally {
      flushInProgressRef.current = false
    }
  }, [session])

  // ── Manage flush interval ─────────────────────────────────────────────────
  useEffect(() => {
    if (trackingState !== "tracking") {
      clearInterval(flushTimerRef.current)
      return
    }
    clearInterval(flushTimerRef.current)
    flushTimerRef.current = setInterval(flush, flushMs)
    return () => clearInterval(flushTimerRef.current)
  }, [trackingState, flush, flushMs])

  // ── Collector health (HTTP mode): poll /session/current so the UI can show
  //    whether the system-wide collector process is really running.
  useEffect(() => {
    if (isTauri() || trackingState !== "tracking") return
    let alive = true
    const poll = () => sessionAPI.current()
      .then((cur) => {
        if (!alive || !cur) return
        setSession((prev) => prev ? { ...prev, ...cur, id: prev.id } : prev)
        if (cur.latest_load && cur.prediction_count !== lastPredCountRef.current) {
          lastPredCountRef.current = cur.prediction_count
          setPolledPrediction({
            load_level: cur.latest_load,
            confidence: cur.latest_confidence ?? 0,
            session_id: cur.session_id,
            keys_pressed: cur.keys_pressed,
            mouse_events: cur.mouse_events,
            typing_wpm:   cur.typing_wpm,
          })
        }
      })
      .catch(() => {})
    const id = setInterval(poll, 5_000)
    poll()
    return () => { alive = false; clearInterval(id) }
  }, [trackingState])

  // ── Session actions ───────────────────────────────────────────────────────
  const startTracking = useCallback(async () => {
    if (!hasConsent) { setConsentOpen(true); return false }
    setTrackingState("starting"); setError(null)
    try {
      const s = await sessionAPI.start()
      // HTTP backend returns session_id; the Tauri commands return id
      setSession({ ...s, id: s.id ?? s.session_id })
      await collectorAPI.setEnabled(true)
      setTrackingState("tracking")
      return true
    } catch (e) {
      setTrackingState("idle")
      setError("Unable to start session.")
      return false
    }
  }, [hasConsent])

  const acceptConsent = useCallback(async () => {
    if (consentKey) localStorage.setItem(consentKey, CONSENT_VERSION)
    setConsentOpen(false)
    return startTracking()
  }, [consentKey, startTracking])

  const pauseTracking = useCallback(async () => {
    if (trackingState !== "tracking") return
    await collectorAPI.setEnabled(false)
    setTrackingState("paused")
  }, [trackingState])

  const resumeTracking = useCallback(async () => {
    if (trackingState !== "paused") return
    await collectorAPI.setEnabled(true)
    setTrackingState("tracking")
  }, [trackingState])

  const endTracking = useCallback(async () => {
    if (!["tracking", "paused"].includes(trackingState)) return
    // Remember the pre-ending state so we can roll back to it on failure,
    // keeping the End button visible so the user can always retry.
    const prevState = trackingState
    setTrackingState("ending"); setError(null)
    try {
      clearInterval(flushTimerRef.current)
      // Wait for any in-flight periodic flush to finish before attempting the
      // final flush.  The in-flight flush holds the Rust ORT mutex; calling
      // flush() concurrently would race on that mutex and deadlock.
      if (flushInProgressRef.current) {
        await new Promise((resolve) => {
          const wait = setInterval(() => {
            if (!flushInProgressRef.current) { clearInterval(wait); resolve() }
          }, 100)
        })
      }
      // Final flush before ending (only when actively tracking, not when paused)
      if (session && prevState === "tracking") {
        try { await flush() } catch { /* non-fatal — don't block end on flush error */ }
      }
      try { await collectorAPI.setEnabled(false) } catch { /* never fatal */ }
      if (session) await sessionAPI.end(session.id)
      setSession(null)
      setPrediction(null)
      setPolledPrediction(null)
      lastPredCountRef.current = 0
      setTrackingState("idle")
    } catch (e) {
      // Roll back to the state we were in before clicking End so the
      // End button remains visible and the user can retry.
      setTrackingState(prevState)
      setError("Unable to end session — " + (e?.message ?? "please retry."))
    }
  }, [trackingState, session, flush])

  // ── Reset on logout ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuth) {
      clearInterval(flushTimerRef.current)
      setTrackingState("idle")
      setSession(null)
      setPrediction(null)
      setError(null)
      setConsentOpen(false)
    }
  }, [isAuth])

  // Prefer the WebSocket push (has WPM + counts); fall back to the polled value.
  const livePrediction = isTauri() ? prediction : (ws.prediction ?? polledPrediction ?? prediction)

  // Running totals for the session: each prediction carries only that flush window's counts.
  const [totals, setTotals] = useState({ keys: 0, mouse: 0 })
  const lastCountedRef = useRef(null)
  useEffect(() => {
    if (trackingState === "idle") {
      lastCountedRef.current = null
      setTotals({ keys: 0, mouse: 0 })
    }
  }, [trackingState])
  useEffect(() => {
    const p = livePrediction
    if (!p || (p.keys_pressed == null && p.mouse_events == null)) return
    const stamp = `${p.session_id}:${p.keys_pressed}:${p.mouse_events}:${p.confidence}:${p.load_level}`
    if (stamp === lastCountedRef.current) return
    lastCountedRef.current = stamp
    setTotals((t) => ({
      keys:  t.keys  + (p.keys_pressed  || 0),
      mouse: t.mouse + (p.mouse_events  || 0),
    }))
  }, [livePrediction])

  const value = useMemo(() => ({
    trackingState,
    session,
    prediction: livePrediction,
    error,
    consentOpen,
    // Shims for components that read these from the old WS-based context
    websocketStatus: isTauri() ? "native" : ws.status,
    backendStatus:   "online",
    networkOnline:   true,
    collectorRunning: isTauri() ? trackingState === "tracking" : Boolean(session?.collector_running),
    collectorMode:   isTauri() ? "native" : (session?.collector_mode ?? "system"),
    collectorError:  isTauri() ? null : (session?.collector_error ?? null),
    quality: {
      keyEvents:   livePrediction?.keys_pressed ?? 0,
      mouseEvents: livePrediction?.mouse_events ?? 0,
      totalKeys:   totals.keys,
      totalMouse:  totals.mouse,
      ready: trackingState === "tracking",
    },
    startTracking,
    pauseTracking,
    resumeTracking,
    endTracking,
    acceptConsent,
    dismissConsent: () => setConsentOpen(false),
    retry: () => {},
  }), [
    trackingState, session, prediction, livePrediction, totals, ws.status, error, consentOpen,
    startTracking, pauseTracking, resumeTracking, endTracking, acceptConsent,
  ])

  return <TrackingContext.Provider value={value}>{children}</TrackingContext.Provider>
}

export function useTracking() {
  const ctx = useContext(TrackingContext)
  if (!ctx) throw new Error("useTracking must be used inside TrackingProvider")
  return ctx
}