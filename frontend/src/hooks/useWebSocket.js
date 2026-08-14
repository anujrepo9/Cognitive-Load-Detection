/**
 * Phase 7 — useWebSocket
 *
 * Connects to /ws/predictions, auto-reconnects with exponential back-off,
 * and exposes the latest prediction + connection status to consumers.
 *
 * Usage:
 *   const { prediction, status, connected } = useWebSocket()
 *
 * `status`  → "connecting" | "connected" | "reconnecting" | "offline"
 * `connected` → boolean shorthand
 * `prediction` → null | { load_level, confidence, scores, session_id }
 */
import { useState, useEffect, useRef, useCallback } from "react"

const WS_BASE =
  (import.meta.env.VITE_API_URL || "http://localhost:8000")
    .replace(/^http/, "ws")   // http → ws, https → wss

const RECONNECT_BASE_MS   = 1_000   // first retry after 1 s
const RECONNECT_MAX_MS    = 30_000  // cap at 30 s
const RECONNECT_EXPONENT  = 2       // doubles each attempt
const HEARTBEAT_TIMEOUT   = 60_000  // consider connection dead if no ping in 60 s

export function useWebSocket(enabled = true) {
  const [status, setStatus]           = useState("offline")
  const [prediction, setPrediction]   = useState(null)

  const wsRef             = useRef(null)
  const retryCountRef     = useRef(0)
  const retryTimerRef     = useRef(null)
  const heartbeatTimerRef = useRef(null)
  const mountedRef        = useRef(true)

  // ── Heartbeat guard ───────────────────────────────────────────────────────
  const resetHeartbeatTimer = useCallback(() => {
    clearTimeout(heartbeatTimerRef.current)
    heartbeatTimerRef.current = setTimeout(() => {
      // Server missed too many pings — force reconnect
      wsRef.current?.close()
    }, HEARTBEAT_TIMEOUT)
  }, [])

  // ── Connect ───────────────────────────────────────────────────────────────
  const connect = useCallback(() => {
    if (!mountedRef.current) return

    const token = localStorage.getItem("token")
    if (!token) {
      setStatus("offline")
      return
    }

    const url = `${WS_BASE}/ws/predictions?token=${encodeURIComponent(token)}`
    setStatus(retryCountRef.current === 0 ? "connecting" : "reconnecting")

    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      if (!mountedRef.current) { ws.close(); return }
      // Don't set "connected" yet — wait for server's {"type":"connected"} frame
      retryCountRef.current = 0
      resetHeartbeatTimer()
    }

    ws.onmessage = (event) => {
      if (!mountedRef.current) return
      try {
        const msg = JSON.parse(event.data)

        switch (msg.type) {
          case "connected":
            setStatus("connected")
            resetHeartbeatTimer()
            break

          case "ping":
            resetHeartbeatTimer()
            // Reply with pong
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "pong" }))
            }
            break

          case "prediction":
            setPrediction({
              load_level: msg.load_level,
              confidence: msg.confidence,
              scores:     msg.scores,
              session_id: msg.session_id,
              typing_wpm: msg.typing_wpm,
            })
            break

          default:
            break
        }
      } catch {
        // Malformed frame — ignore
      }
    }

    ws.onerror = () => {
      // onerror always followed by onclose — nothing extra needed here
    }

    ws.onclose = (event) => {
      clearTimeout(heartbeatTimerRef.current)
      if (!mountedRef.current) return

      // 4001 = auth failure — don't retry
      if (event.code === 4001) {
        setStatus("offline")
        return
      }

      // Exponential back-off
      const delay = Math.min(
        RECONNECT_BASE_MS * RECONNECT_EXPONENT ** retryCountRef.current,
        RECONNECT_MAX_MS
      )
      retryCountRef.current += 1
      setStatus("reconnecting")
      retryTimerRef.current = setTimeout(connect, delay)
    }
  }, [resetHeartbeatTimer])

  // ── Disconnect helper (exported for explicit close) ───────────────────────
  const disconnect = useCallback(() => {
    clearTimeout(retryTimerRef.current)
    clearTimeout(heartbeatTimerRef.current)
    wsRef.current?.close()
    setStatus("offline")
  }, [])

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true
    if (enabled) connect()

    return () => {
      mountedRef.current = false
      clearTimeout(retryTimerRef.current)
      clearTimeout(heartbeatTimerRef.current)
      wsRef.current?.close()
    }
  }, [enabled, connect])

  return {
    status,
    connected: status === "connected",
    prediction,
    disconnect,
  }
}
