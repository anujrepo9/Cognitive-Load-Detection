import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { useAuth } from "./AuthContext"
import { useSessionTracker } from "../hooks/useSessionTracker"
import { useWebSocket } from "../hooks/useWebSocket"
import { sessionAPI, settingsAPI } from "../services/api"

const TrackingContext = createContext(null)
const CONSENT_VERSION = "behavioral-metrics-v1"
const DEFAULT_FLUSH_MS = 5000

export function TrackingProvider({ children }) {
  const { user, isAuth } = useAuth()
  const [trackingState, setTrackingState] = useState("idle")
  const [consentOpen, setConsentOpen] = useState(false)
  const [session, setSession] = useState(null)
  const [prediction, setPrediction] = useState(null)
  const [quality, setQuality] = useState({ keyEvents: 0, mouseEvents: 0, ready: false })
  const [backendStatus, setBackendStatus] = useState("checking")
  const [networkOnline, setNetworkOnline] = useState(navigator.onLine)
  const [flushIntervalMs, setFlushIntervalMs] = useState(DEFAULT_FLUSH_MS)
  const [error, setError] = useState(null)
  const { status: websocketStatus, prediction: websocketPrediction } = useWebSocket(isAuth)

  const consentKey = user ? `cogniload.consent.${user.id}` : null
  const hasConsent = Boolean(consentKey && localStorage.getItem(consentKey) === CONSENT_VERSION)

  const refreshStatus = useCallback(async () => {
    if (!isAuth) return
    setBackendStatus("checking")
    try {
      const [settingsResult, sessionResult] = await Promise.allSettled([settingsAPI.get(), sessionAPI.current()])
      if (settingsResult.status === "rejected") throw settingsResult.reason
      setFlushIntervalMs((settingsResult.value.data?.flush_interval_sec || DEFAULT_FLUSH_MS / 1000) * 1000)
      if (sessionResult.status === "fulfilled") {
        setSession(sessionResult.value.data)
      } else {
        // 404 simply means no active session — that is not a backend error
        const status = sessionResult.reason?.response?.status
        if (status !== 404) throw sessionResult.reason
        setSession(null)
      }
      setBackendStatus("online")
    } catch {
      setBackendStatus("unavailable")
      setError("The backend is unavailable. Tracking cannot start until the connection is restored.")
    }
  }, [isAuth])

  useEffect(() => { refreshStatus() }, [refreshStatus])
  useEffect(() => {
    const goOnline = () => { setNetworkOnline(true); refreshStatus() }
    const goOffline = () => setNetworkOnline(false)
    window.addEventListener("online", goOnline)
    window.addEventListener("offline", goOffline)
    return () => { window.removeEventListener("online", goOnline); window.removeEventListener("offline", goOffline) }
  }, [refreshStatus])
  useEffect(() => {
    if (websocketPrediction) {
      // The backend re-broadcasts typing_wpm from payload.typing_wpm, but the
      // frontend sends 0 (not null) when there isn't enough data — so a WS value
      // of 0 means "no real reading", not "actually 0 WPM". Only trust a positive
      // WS value; otherwise keep the last meaningful value from the HTTP flush
      // (which carries the true null-vs-real-number distinction via displayWpm).
      const wsWpm = (websocketPrediction.typing_wpm != null && websocketPrediction.typing_wpm > 0)
        ? websocketPrediction.typing_wpm
        : null
      setPrediction((prev) => ({
        ...websocketPrediction,
        typing_wpm: wsWpm ?? prev?.typing_wpm ?? null,
      }))
    }
  }, [websocketPrediction])
  useEffect(() => {
    if (!isAuth) {
      setTrackingState("idle"); setSession(null); setPrediction(null); setError(null); setConsentOpen(false)
    }
  }, [isAuth])

  const startTracking = useCallback(async () => {
    if (!hasConsent) { setConsentOpen(true); return false }
    if (!networkOnline || backendStatus === "unavailable") {
      setError("You are offline or the backend is unavailable. Reconnect, then try again.")
      return false
    }
    setTrackingState("starting"); setError(null)
    try {
      const { data } = await sessionAPI.start()
      setSession(data); setTrackingState("tracking"); return true
    } catch {
      setTrackingState("idle"); setBackendStatus("unavailable")
      setError("Unable to start a tracking session. Retry after checking the backend connection.")
      return false
    }
  }, [backendStatus, hasConsent, networkOnline])

  const acceptConsent = useCallback(async () => {
    if (consentKey) localStorage.setItem(consentKey, CONSENT_VERSION)
    setConsentOpen(false)
    if (!networkOnline || backendStatus === "unavailable") {
      setError("You are offline or the backend is unavailable. Reconnect, then try again.")
      return false
    }
    setTrackingState("starting"); setError(null)
    try {
      const { data } = await sessionAPI.start()
      setSession(data); setTrackingState("tracking"); return true
    } catch {
      setTrackingState("idle"); setBackendStatus("unavailable")
      setError("Unable to start a tracking session. Retry after checking the backend connection.")
      return false
    }
  }, [backendStatus, consentKey, networkOnline])
  const pauseTracking = useCallback(() => { if (trackingState === "tracking") setTrackingState("paused") }, [trackingState])
  const resumeTracking = useCallback(() => { if (trackingState === "paused") setTrackingState("tracking") }, [trackingState])
  const endTracking = useCallback(async () => {
    if (!["tracking", "paused"].includes(trackingState)) return
    setTrackingState("ending"); setError(null)
    try {
      await sessionAPI.end()
      setSession(null); setQuality({ keyEvents: 0, mouseEvents: 0, ready: false }); setTrackingState("idle")
    } catch (requestError) {
      if (requestError.response?.status === 404) { setSession(null); setTrackingState("idle"); return }
      setTrackingState("paused"); setError("Unable to end the session. Retry once the backend is reachable.")
    }
  }, [trackingState])

  useSessionTracker({ active: trackingState === "tracking", flushIntervalMs, onPrediction: setPrediction, onQualityChange: setQuality, onError: setError })

  const value = useMemo(() => ({ trackingState, session, prediction, quality, backendStatus, websocketStatus, networkOnline, error, consentOpen, startTracking, pauseTracking, resumeTracking, endTracking, acceptConsent, dismissConsent: () => setConsentOpen(false), retry: refreshStatus }), [trackingState, session, prediction, quality, backendStatus, websocketStatus, networkOnline, error, consentOpen, startTracking, pauseTracking, resumeTracking, endTracking, acceptConsent, refreshStatus])
  return <TrackingContext.Provider value={value}>{children}</TrackingContext.Provider>
}

export function useTracking() {
  const context = useContext(TrackingContext)
  if (!context) throw new Error("useTracking must be used inside TrackingProvider")
  return context
}