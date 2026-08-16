import { useState, useEffect } from "react"
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
  const [confidence,  setConfidence]  = useState(0)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [elapsed,     setElapsed]     = useState(0)
  // Track the most recently seen WPM so the stat card shows a live value
  const [latestWpm,   setLatestWpm]   = useState(null)

  // Session timer
  useEffect(() => {
    const tick = setInterval(() => {
      setElapsed(session?.start_time
        ? Math.max(0, Math.floor((Date.now() - new Date(session.start_time).getTime()) / 1000))
        : 0)
    }, 1000)
    return () => clearInterval(tick)
  }, [session?.session_id, session?.start_time, trackingState])

  // React to prediction pushes (both WebSocket and HTTP response via onPrediction callback)
  useEffect(() => {
    if (!prediction) return
    const { load_level, confidence: conf, typing_wpm } = prediction
    const time = new Date().toLocaleTimeString()
    setLoadLevel(load_level)
    setConfidence(Math.round(conf * 100))
    setLastUpdated(new Date())
    setHistory((prev) => [...prev.slice(-29), { time, score: Math.round(conf * 100) }])

    // Only update WPM history and latest value when a real WPM is present
    if (typing_wpm != null) {
      setLatestWpm(typing_wpm)
      setWpmHistory((prev) => [...prev.slice(-29), { time, wpm: typing_wpm }])
    }
  }, [prediction])

  // Reset WPM display when tracking stops
  useEffect(() => {
    if (trackingState === "idle") {
      setLatestWpm(null)
      setWpmHistory([])
    }
  }, [trackingState])

  const wsUI   = STATUS_UI[status] || STATUS_UI.offline
  const WsIcon = wsUI.icon

  const liveMouseEvents = quality?.mouseEvents ?? 0
  // Show the most recent WPM value, or "—" if tracking hasn't produced one yet
  const liveWpm = latestWpm != null ? latestWpm : "—"

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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Confidence"   value={confidence}            unit="%" icon={Zap}
          accent="primary"  sub="Model prediction confidence" />
        <StatCard label="Session time" value={formatDuration(elapsed)}        icon={Timer}
          accent="accent"   sub="Time since tracking started" />
        <StatCard label="Typing WPM"   value={liveWpm}                        icon={Keyboard}
          accent="success"  sub="Live words per minute" />
        <StatCard label="Mouse events" value={liveMouseEvents}                icon={MousePointerClick}
          accent="warning"  sub="Clicks and moves this interval" />
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
          {wpmHistory.filter((p) => p.wpm > 0).length < 2
            ? <EmptyState icon={Keyboard} title="No typing data"
                description="Type continuously during a session to see your WPM trend." />
            : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={wpmHistory} aria-label="Words per minute over time chart">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" vertical={false} />
                  <XAxis dataKey="time" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false}
                    tickFormatter={(v) => `${v} wpm`} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v} wpm`, "Typing speed"]} />
                  <Line type="monotone" dataKey="wpm" stroke="#10B981" strokeWidth={2}
                    dot={false} name="WPM" />
                </LineChart>
              </ResponsiveContainer>
            )}
        </motion.div>
      </div>
    </div>
  )
}