import { useState, useEffect, useRef } from "react"
import { motion } from "framer-motion"
import {
  Cpu, Keyboard, MousePointerClick, Timer, Zap,
  Wifi, WifiOff, RotateCcw,
} from "lucide-react"
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts"
import { useTracking } from "../context/TrackingContext"
import { PageHeader } from "../components/ui/PageHeader"
import StatCard from "../components/ui/StatCard"
import LoadBadge from "../components/ui/LoadBadge"
import TrackingControls from "../components/tracking/TrackingControls"
import TrackingStatus from "../components/tracking/TrackingStatus"
import EmptyState from "../components/ui/EmptyState"

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s.toString().padStart(2, "0")}s`
}

const STATUS_UI = {
  connected:    { icon: Wifi,      color: "text-success", label: "Live",          bg: "bg-success/10" },
  connecting:   { icon: Wifi,      color: "text-warning", label: "Connecting…",   bg: "bg-warning/10" },
  reconnecting: { icon: RotateCcw, color: "text-warning", label: "Reconnecting",  bg: "bg-warning/10" },
  offline:      { icon: WifiOff,   color: "text-danger",  label: "Offline",       bg: "bg-danger/10"  },
}

const tooltipStyle = {
  background: "#fff", border: "1px solid #E2E8F0",
  borderRadius: 12, fontSize: 12, color: "#0F172A",
}

export default function LiveMonitoring() {
  const { websocketStatus: status, prediction, session, trackingState, quality } = useTracking()
  const connected = status === "connected"

  const [history,     setHistory]     = useState([])
  const [wpmHistory,  setWpmHistory]  = useState([])
  const [loadLevel,   setLoadLevel]   = useState("unknown")
  const [confidence,  setConfidence]  = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [elapsed,     setElapsed]     = useState(0)
  // Track the most recently seen WPM so the stat card shows a live value
  const [latestWpm,   setLatestWpm]   = useState(null)
  // Cumulative key count across all flush intervals this session
  const [totalKeys,   setTotalKeys]   = useState(0)

  const prevKeyEvents = useRef(0)

  // Session timer — survives page navigation (component remount).
  //
  // Problem: on remount all refs reset to their initial values (null/0).
  // useEffect only re-fires when deps *change* — but session is already live in
  // context and its id/duration_seconds haven't changed, so the effect never
  // runs and the timer stays at 0.
  //
  // Fix: compute the mount-time base directly from start_time (UTC-safe: the
  // backend always serialises with a Z/+00:00 suffix via Pydantic's _as_utc
  // validator), then let the effect only handle subsequent state transitions
  // (pause / resume / end). This way the timer is correct the instant the
  // component mounts regardless of whether the effect fires.
  const mountBaseRef    = useRef(
    // Seed from start_time on mount so remounts resume at the correct offset.
    // new Date() on a string with Z/+00:00 is always UTC-correct in all browsers.
    session?.start_time && trackingState === "tracking"
      ? Math.max(0, Math.floor((Date.now() - new Date(session.start_time).getTime()) / 1000))
      : (session?.duration_seconds ?? 0)
  )
  const localStartRef   = useRef(trackingState === "tracking" ? Date.now() : null)
  const baseSecondsRef  = useRef(mountBaseRef.current)
  const pausedSinceRef  = useRef(trackingState === "paused" ? Date.now() : null)
  const totalPausedMsRef = useRef(0)

  useEffect(() => {
    if (trackingState === "idle") {
      pausedSinceRef.current   = null
      totalPausedMsRef.current = 0
      localStartRef.current    = null
      baseSecondsRef.current   = 0
      setElapsed(0)
      return undefined
    }

    if (trackingState === "paused") {
      if (pausedSinceRef.current === null) pausedSinceRef.current = Date.now()
      return undefined
    }

    // trackingState === "tracking"
    if (pausedSinceRef.current !== null) {
      totalPausedMsRef.current += Date.now() - pausedSinceRef.current
      pausedSinceRef.current = null
    }

    // Only re-anchor when switching to a *different* session (new start).
    // On a plain remount session_id is the same, so we keep mountBaseRef
    // (already seeded above) and just restart the interval.
    if (localStartRef.current === null) {
      baseSecondsRef.current = mountBaseRef.current
      localStartRef.current  = Date.now()
    }

    const tick = setInterval(() => {
      if (localStartRef.current === null) { setElapsed(0); return }
      const localElapsedMs = Date.now() - localStartRef.current - totalPausedMsRef.current
      setElapsed(Math.max(0, baseSecondsRef.current + Math.floor(localElapsedMs / 1000)))
    }, 1000)
    return () => clearInterval(tick)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.session_id, trackingState])

  // React to prediction pushes (both WebSocket and HTTP response via onPrediction callback)
  useEffect(() => {
    if (!prediction) return
    const { load_level, confidence: conf, typing_wpm } = prediction
    const time = new Date().toLocaleTimeString()
    setLoadLevel(load_level)
    setConfidence(Math.round(conf * 100))
    setLastUpdated(new Date())
    setHistory((prev) => [...prev.slice(-29), { time, score: Math.round(conf * 100) }])

    // Only update WPM history and latest value when a meaningful WPM is present.
    // null means not enough data yet; 0 is also not useful to display or chart.
    if (typing_wpm != null && typing_wpm > 0) {
      setLatestWpm(typing_wpm)
      setWpmHistory((prev) => [...prev.slice(-29), { time, wpm: typing_wpm }])
    }
  }, [prediction])

  // Reset display values when tracking stops
  useEffect(() => {
    if (trackingState === "idle") {
      setLatestWpm(null)
      setWpmHistory([])
      setConfidence(null)
      setLoadLevel("unknown")
      setTotalKeys(0)
    }
  }, [trackingState])

  const wsUI   = STATUS_UI[status] || STATUS_UI.offline
  const WsIcon = wsUI.icon

  const liveMouseEvents = quality?.mouseEvents ?? 0
  // Show the most recent WPM value, or "—" if tracking hasn't produced one yet
  const liveWpm = latestWpm != null ? latestWpm : "—"

  // Accumulate key events: quality.keyEvents resets each flush, so track the
  // delta and add it to our running total whenever the counter resets.
  useEffect(() => {
    if (trackingState === "idle") {
      prevKeyEvents.current = 0
      return
    }
    const current = quality?.keyEvents ?? 0
    if (current < prevKeyEvents.current) {
      // Counter just flushed/reset — bank what we had
      setTotalKeys((t) => t + prevKeyEvents.current)
    }
    prevKeyEvents.current = current
  }, [quality?.keyEvents, trackingState])

  // WPM chart: filter out zeros (shouldn't exist, but guard anyway)
  const validWpmHistory = wpmHistory.filter((p) => p.wpm > 0)
  // Recharts LineChart needs ≥2 points to draw a line; show dots for single point
  const wpmDot = validWpmHistory.length === 1 ? { r: 4, fill: "#10B981" } : false

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <PageHeader
        title="Live Monitoring"
        subtitle="Real-time behavioral signals — data flows via WebSocket after each prediction"
      >
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
            ${wsUI.bg} ${wsUI.color} text-xs font-semibold`}
          role="status"
          aria-live="polite"
          aria-label={`Connection: ${wsUI.label}`}
        >
          <WsIcon className={`w-3.5 h-3.5 ${status === "reconnecting" ? "animate-spin" : ""}`}
            aria-hidden="true" />
          {wsUI.label}
        </span>
        {lastUpdated && (
          <span className="text-xs text-gray-400">
            Last update: {lastUpdated.toLocaleTimeString()}
          </span>
        )}
        <TrackingControls />
        <LoadBadge level={loadLevel} />
      </PageHeader>

      <TrackingStatus />

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Confidence"   value={confidence != null ? confidence : "—"} unit={confidence != null ? "%" : ""} icon={Zap}
          accent="primary"  sub="Model prediction confidence" />
        <StatCard label="Session time" value={formatDuration(elapsed)}        icon={Timer}
          accent="accent"   sub="Time since tracking started" />
        <StatCard label="Typing WPM"   value={liveWpm}                        icon={Keyboard}
          accent="success"  sub="Live words per minute" />
        <StatCard label="Mouse events" value={liveMouseEvents}                icon={MousePointerClick}
          accent="warning"  sub="Clicks and moves this interval" />
        <StatCard label="Keys typed" value={totalKeys} icon={Keyboard}
          accent="primary" sub="Total keystrokes this session" />
      </div>

      {/* Offline banner */}
      {!connected && status !== "connecting" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          role="alert"
          className="rounded-xl border border-warning/30 bg-warning/5 px-4 py-3
            flex items-center gap-3 text-sm text-warning">
          <WifiOff className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>
            {status === "reconnecting"
              ? "WebSocket disconnected — attempting to reconnect automatically…"
              : "WebSocket offline — live charts will be empty, but predictions are still saved via HTTP."}
          </span>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Confidence chart */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }} className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Cpu className="w-5 h-5 text-primary" aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                Confidence stream
              </h3>
              <p className="text-xs text-gray-400">
                Pushed live via WebSocket after each flush interval
              </p>
            </div>
          </div>
          {history.length < 2
            ? <EmptyState icon={Cpu} title="No data yet"
                description="Start tracking and interact with your device to see the confidence stream." />
            : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={history} aria-label="Confidence over time chart">
                  <defs>
                    <linearGradient id="liveGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#2563EB" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#2563EB" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" vertical={false} />
                  <XAxis dataKey="time" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false}
                    tickFormatter={(v) => `${v}%`} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}%`, "Confidence"]} />
                  <Area type="monotone" dataKey="score" stroke="#2563EB" strokeWidth={2}
                    fill="url(#liveGrad)" name="Confidence" />
                </AreaChart>
              </ResponsiveContainer>
            )}
        </motion.div>

        {/* WPM chart */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }} className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-success/10 flex items-center justify-center">
              <Keyboard className="w-5 h-5 text-success" aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Typing speed</h3>
              <p className="text-xs text-gray-400">
                Words per minute computed from space-separated word counts
              </p>
            </div>
          </div>
          {validWpmHistory.length < 1
            ? <EmptyState icon={Keyboard} title="No typing data"
                description="Type continuously during a session to see your WPM trend." />
            : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={validWpmHistory} aria-label="Words per minute over time chart">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" vertical={false} />
                  <XAxis dataKey="time" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                  <YAxis
                    domain={([dataMin, dataMax]) => {
                      const pad = Math.max(10, Math.ceil((dataMax - dataMin) * 0.2))
                      return [Math.max(0, dataMin - pad), dataMax + pad]
                    }}
                    tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false}
                    tickFormatter={(v) => `${v}`}
                    label={{ value: "wpm", angle: -90, position: "insideLeft", offset: 10, style: { fontSize: 10, fill: "#94A3B8" } }}
                  />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v} wpm`, "Typing speed"]} />
                  <Line
                    type="monotone"
                    dataKey="wpm"
                    stroke="#10B981"
                    strokeWidth={2}
                    dot={wpmDot}
                    activeDot={{ r: 5 }}
                    isAnimationActive={validWpmHistory.length > 1}
                    name="WPM"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
        </motion.div>
      </div>
    </div>
  )
}