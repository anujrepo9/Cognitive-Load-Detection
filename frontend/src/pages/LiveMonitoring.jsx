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
  native:       { icon: Wifi,      color: "text-emerald-700 dark:text-emerald-300",  label: "Native",         bg: "bg-emerald-50/80 dark:bg-emerald-500/12" },
  connected:    { icon: Wifi,      color: "text-emerald-700 dark:text-emerald-300",  label: "Live",          bg: "bg-emerald-50/80 dark:bg-emerald-500/12" },
  connecting:   { icon: Wifi,      color: "text-amber-700 dark:text-amber-300",     label: "Connecting…",   bg: "bg-amber-50/80 dark:bg-amber-500/12" },
  reconnecting: { icon: RotateCcw, color: "text-amber-700 dark:text-amber-300",     label: "Reconnecting",  bg: "bg-amber-50/80 dark:bg-amber-500/12" },
  offline:      { icon: WifiOff,   color: "text-red-700 dark:text-red-300",         label: "Offline",       bg: "bg-red-50/80 dark:bg-red-500/12"  },
}

// Refined tooltip — uses CSS variables so light/dark auto-adapt.
const tooltipStyle = {
  background: "rgba(255,255,255,0.85)",
  border: "1px solid rgba(255,255,255,0.6)",
  borderRadius: 12,
  fontSize: 12,
  color: "#1d1d1f",
  boxShadow: "0 8px 24px rgba(0,0,0,0.10), 0 0 0 0.5px rgba(0,0,0,0.04)",
  backdropFilter: "blur(20px) saturate(180%)",
  WebkitBackdropFilter: "blur(20px) saturate(180%)",
  padding: "8px 12px",
}
const tooltipStyleDark = {
  ...tooltipStyle,
  background: "rgba(28,28,32,0.85)",
  border: "1px solid rgba(255,255,255,0.08)",
  color: "#f5f5f7",
  boxShadow: "0 8px 24px rgba(0,0,0,0.5), 0 0 0 0.5px rgba(255,255,255,0.04)",
}

export default function LiveMonitoring() {
  const { websocketStatus: status, prediction, session, trackingState, quality } = useTracking()
  const connected = status === "connected" || status === "native"

  const [history,     setHistory]     = useState([])
  const [wpmHistory,  setWpmHistory]  = useState([])
  const [loadLevel,   setLoadLevel]   = useState("unknown")
  const [confidence,  setConfidence]  = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [elapsed,     setElapsed]     = useState(0)
  const [latestWpm,   setLatestWpm]   = useState(null)
  const [totalKeys,   setTotalKeys]   = useState(0)

  // Use documentElement classList to detect dark mode for tooltip styling
  const [isDark, setIsDark] = useState(
    typeof document !== "undefined" && document.documentElement.classList.contains("dark")
  )
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"))
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
    return () => observer.disconnect()
  }, [])

  const prevKeyEvents = useRef(0)

  const mountBaseRef    = useRef(
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

    if (pausedSinceRef.current !== null) {
      totalPausedMsRef.current += Date.now() - pausedSinceRef.current
      pausedSinceRef.current = null
    }

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

  useEffect(() => {
    if (!prediction) return
    const { load_level, confidence: conf, typing_wpm, keys_pressed } = prediction
    if (keys_pressed > 0) setTotalKeys((t) => t + keys_pressed)
    const time = new Date().toLocaleTimeString()
    setLoadLevel(load_level)
    setConfidence(Math.round(conf * 100))
    setLastUpdated(new Date())
    setHistory((prev) => [...prev.slice(-29), { time, score: Math.round(conf * 100) }])
    if (typing_wpm != null && typing_wpm > 0) {
      setLatestWpm(typing_wpm)
      setWpmHistory((prev) => [...prev.slice(-29), { time, wpm: typing_wpm }])
    }
  }, [prediction])

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
  const liveWpm = latestWpm != null ? latestWpm : "—"

  useEffect(() => {
    if (trackingState === "idle") {
      prevKeyEvents.current = 0
      return
    }
    const current = quality?.keyEvents ?? 0
    if (current < prevKeyEvents.current) {
      setTotalKeys((t) => t + prevKeyEvents.current)
    }
    prevKeyEvents.current = current
  }, [quality?.keyEvents, trackingState])

  const validWpmHistory = wpmHistory.filter((p) => p.wpm > 0)
  const wpmDot = validWpmHistory.length === 1 ? { r: 4, fill: "#34c759" } : false
  const activeTooltip = isDark ? tooltipStyleDark : tooltipStyle

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <PageHeader
        title="Live Monitoring"
        description="Real-time behavioral signals — data flows via WebSocket after each prediction"
      >
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
            ${wsUI.bg} ${wsUI.color} text-[11px] font-semibold`}
          role="status"
          aria-live="polite"
          aria-label={`Connection: ${wsUI.label}`}
        >
          <WsIcon className={`w-3.5 h-3.5 ${status === "reconnecting" ? "animate-spin" : ""}`}
            aria-hidden="true" />
          {wsUI.label}
        </span>
        {lastUpdated && (
          <span className="text-[11px] text-[#86868b] dark:text-[#a1a1a6] nums">
            Last update: {lastUpdated.toLocaleTimeString()}
          </span>
        )}
        <TrackingControls />
        <LoadBadge level={loadLevel} animate={trackingState === "tracking"} />
      </PageHeader>

      <TrackingStatus />

      {/* Stat cards — refined */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Confidence"   value={confidence != null ? confidence : "—"} unit={confidence != null ? "%" : ""} icon={Zap}
          accent="primary"  sub="Model prediction confidence" />
        <StatCard label="Session time" value={formatDuration(elapsed)}        icon={Timer}
          accent="accent"   sub="Time since tracking started" />
        <StatCard label="Typing WPM"   value={liveWpm}                        icon={Keyboard}
          accent="success"  sub="Live words per minute" />
        <StatCard label="Mouse events" value={liveMouseEvents}                icon={MousePointerClick}
          accent="warning"  sub={`This interval · ${quality?.totalMouse ?? 0} this session`} />
        <StatCard label="Keys typed" value={totalKeys} icon={Keyboard}
          accent="primary" sub="Total keystrokes this session" />
      </div>

      {/* Offline banner — refined */}
      {!connected && status !== "connecting" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          role="alert"
          className="rounded-xl border border-amber-200/70 dark:border-amber-500/25
            bg-amber-50/70 dark:bg-amber-500/10 px-4 py-3
            flex items-center gap-3 text-[13px] text-amber-700 dark:text-amber-300">
          <WifiOff className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>
            {status === "reconnecting"
              ? "WebSocket disconnected — attempting to reconnect automatically…"
              : "WebSocket offline — live charts will be empty, but predictions are still saved via HTTP."}
          </span>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Confidence chart — refined */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }} className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-indigo-50/80 dark:bg-indigo-500/12
              flex items-center justify-center">
              <Cpu className="w-[18px] h-[18px] text-indigo-500 dark:text-indigo-300" aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-[13px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.005em]">
                Confidence stream
              </h3>
              <p className="text-[11px] text-[#86868b] dark:text-[#a1a1a6] mt-0.5">
                Pushed live via WebSocket after each flush interval
              </p>
            </div>
          </div>
          {history.length < 2
            ? <EmptyState icon={Cpu} title="No data yet"
                description="Start tracking and interact with your device to see the confidence stream."
                tone="primary" />
            : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={history} margin={{ top: 6, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="liveGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#6366f1" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0}    />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="0" stroke="rgba(120,120,128,0.12)" vertical={false} />
                  <XAxis dataKey="time" tick={{ fontSize: 11, fill: "#86868b" }} axisLine={false} tickLine={false} dy={8} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#86868b" }} axisLine={false} tickLine={false}
                    tickFormatter={(v) => `${v}%`} width={42} />
                  <Tooltip contentStyle={activeTooltip}
                    labelStyle={{ color: isDark ? "#a1a1a6" : "#6e6e73", fontSize: 11, marginBottom: 2 }}
                    itemStyle={{ color: isDark ? "#f5f5f7" : "#1d1d1f", fontSize: 12, fontWeight: 600 }}
                    formatter={(v) => [`${v}%`, "Confidence"]}
                    cursor={{ stroke: "#6366f1", strokeOpacity: 0.3, strokeWidth: 1 }} />
                  <Area type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={1.75}
                    fill="url(#liveGrad)" name="Confidence"
                    activeDot={{ r: 4, fill: "#6366f1", stroke: isDark ? "#0e0e14" : "#fff", strokeWidth: 2 }}
                    isAnimationActive animationDuration={500} />
                </AreaChart>
              </ResponsiveContainer>
            )}
        </motion.div>

        {/* WPM chart — refined */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1, ease: [0.22, 1, 0.36, 1] }} className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-emerald-50/80 dark:bg-emerald-500/12
              flex items-center justify-center">
              <Keyboard className="w-[18px] h-[18px] text-emerald-500 dark:text-emerald-300" aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-[13px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.005em]">
                Typing speed
              </h3>
              <p className="text-[11px] text-[#86868b] dark:text-[#a1a1a6] mt-0.5">
                Words per minute computed from space-separated word counts
              </p>
            </div>
          </div>
          {validWpmHistory.length < 1
            ? <EmptyState icon={Keyboard} title="No typing data"
                description="Type continuously during a session to see your WPM trend."
                tone="success" />
            : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={validWpmHistory} margin={{ top: 6, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="0" stroke="rgba(120,120,128,0.12)" vertical={false} />
                  <XAxis dataKey="time" tick={{ fontSize: 11, fill: "#86868b" }} axisLine={false} tickLine={false} dy={8} />
                  <YAxis
                    domain={([dataMin, dataMax]) => {
                      const pad = Math.max(10, Math.ceil((dataMax - dataMin) * 0.2))
                      return [Math.max(0, dataMin - pad), dataMax + pad]
                    }}
                    tick={{ fontSize: 11, fill: "#86868b" }} axisLine={false} tickLine={false}
                    tickFormatter={(v) => `${v}`} width={42} />
                  <Tooltip contentStyle={activeTooltip}
                    labelStyle={{ color: isDark ? "#a1a1a6" : "#6e6e73", fontSize: 11, marginBottom: 2 }}
                    itemStyle={{ color: isDark ? "#f5f5f7" : "#1d1d1f", fontSize: 12, fontWeight: 600 }}
                    formatter={(v) => [`${v} wpm`, "Typing speed"]}
                    cursor={{ stroke: "#34c759", strokeOpacity: 0.3, strokeWidth: 1 }} />
                  <Line
                    type="monotone"
                    dataKey="wpm"
                    stroke="#34c759"
                    strokeWidth={1.75}
                    dot={wpmDot}
                    activeDot={{ r: 4, fill: "#34c759", stroke: isDark ? "#0e0e14" : "#fff", strokeWidth: 2 }}
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
