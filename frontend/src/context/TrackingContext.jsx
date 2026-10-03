import {
  createContext, useCallback, useContext, useEffect,
  useMemo, useRef, useState,
} from "react"
import { useAuth } from "./AuthContext"
import { sessionAPI, behaviorAPI, predictAPI, collectorAPI } from "../services/api"

const TrackingContext = createContext(null)

const CONSENT_VERSION    = "behavioral-metrics-v1"
const DEFAULT_FLUSH_MS   = 15_000   // 15 s — Rust collector accumulates, then we drain

export function TrackingProvider({ children }) {
  const { user, isAuth } = useAuth()

  const [trackingState, setTrackingState] = useState("idle")  // idle | starting | tracking | paused | ending
  const [consentOpen,   setConsentOpen]   = useState(false)
  const [session,       setSession]       = useState(null)
  const [prediction,    setPrediction]    = useState(null)
  const [error,         setError]         = useState(null)
  const [flushMs,       setFlushMs]       = useState(DEFAULT_FLUSH_MS)

  const flushTimerRef = useRef(null)

  // ── Consent ───────────────────────────────────────────────────────────────
  const consentKey = user ? `cogniload.consent.${user.id}` : null
  const hasConsent = Boolean(consentKey && localStorage.getItem(consentKey) === CONSENT_VERSION)

  // ── Flush: drain Rust collector → SQLite → ONNX inference ────────────────
  const flush = useCallback(async () => {
    if (!session) return
    try {
      // 1. Drain collector buffer → write behavior_data row
      const behaviorRecord = await behaviorAPI.flush(session.id)

      // 2. Run ONNX inference on that payload
      const pred = await predictAPI.predict(session.id, behaviorRecord, behaviorRecord.id)
      setPrediction(pred)
    } catch {
      // offline or model not ready — silent, will retry next interval
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

  // ── Session actions ───────────────────────────────────────────────────────
  const startTracking = useCallback(async () => {
    if (!hasConsent) { setConsentOpen(true); return false }
    setTrackingState("starting"); setError(null)
    try {
      const s = await sessionAPI.start()
      setSession(s)
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
    setTrackingState("ending"); setError(null)
    try {
      clearInterval(flushTimerRef.current)
      // Final flush before ending
      if (session && trackingState === "tracking") await flush()
      await collectorAPI.setEnabled(false)
      if (session) await sessionAPI.end(session.id)
      setSession(null)
      setPrediction(null)
      setTrackingState("idle")
    } catch {
      setTrackingState("paused")
      setError("Unable to end session. Retry.")
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

  const value = useMemo(() => ({
    trackingState,
    session,
    prediction,
    error,
    consentOpen,
    // Shims for components that read these from the old WS-based context
    websocketStatus: "native",   // collector is native — no WS
    backendStatus:   "online",   // Rust is always local
    networkOnline:   true,
    collectorRunning: trackingState === "tracking",
    collectorMode:   "native",
    collectorError:  null,
    quality: { keyEvents: 0, mouseEvents: 0, ready: trackingState === "tracking" },
    startTracking,
    pauseTracking,
    resumeTracking,
    endTracking,
    acceptConsent,
    dismissConsent: () => setConsentOpen(false),
    retry: () => {},
  }), [
    trackingState, session, prediction, error, consentOpen,
    startTracking, pauseTracking, resumeTracking, endTracking, acceptConsent,
  ])

  return <TrackingContext.Provider value={value}>{children}</TrackingContext.Provider>
}

export function useTracking() {
  const ctx = useContext(TrackingContext)
  if (!ctx) throw new Error("useTracking must be used inside TrackingProvider")
  return ctx
}