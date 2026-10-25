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
  native:       { icon: Wifi,      color: "#37D9A0", label: "Native",       bg: "rgba(55,217,160,0.10)",  border: "rgba(55,217,160,0.25)" },
  connected:    { icon: Wifi,      color: "#37D9A0", label: "Live",         bg: "rgba(55,217,160,0.10)",  border: "rgba(55,217,160,0.25)" },
  connecting:   { icon: Wifi,      color: "#FFB547", label: "Connecting…",  bg: "rgba(255,181,71,0.10)",  border: "rgba(255,181,71,0.25)" },
  reconnecting: { icon: RotateCcw, color: "#FFB547", label: "Reconnecting", bg: "rgba(255,181,71,0.10)",  border: "rgba(255,181,71,0.25)" },
  offline:      { icon: WifiOff,   color: "#FF5364", label: "Offline",      bg: "rgba(255,83,100,0.10)",  border: "rgba(255,83,100,0.25)" },
}

const tooltipStyle = {
  background: "rgba(9,15,24,0.95)",
  border: "1px solid rgba(0,217,232,0.22)",
  borderRadius: 10,
  fontSize: 12,
  color: "#EAF2F8",
  boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  padding: "8px 12px",
  fontFamily: "'Space Grotesk', 'Inter', system-ui",
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

  const prevKeyEvents    = useRef(0)
  const mountBaseRef     = useRef(
    session?.start_time && trackingState === "tracking"
      ? Math.max(0, Math.floor((Date.now() - new Date(session.start_time).getTime()) / 1000))
      : (session?.duration_seconds ?? 0)
  )
  const localStartRef    = useRef(trackingState === "tracking" ? Date.now() : null)
  const baseSecondsRef   = useRef(mountBaseRef.current)
  const pausedSinceRef   = useRef(trackingState === "paused" ? Date.now() : null)
  const totalPausedMsRef = useRef(0)

  useEffect(() => {
    if (trackingState === "idle") {
      pausedSinceRef.current = null; totalPausedMsRef.current = 0
      localStartRef.current = null; baseSecondsRef.current = 0; setElapsed(0); return undefined
    }
    if (trackingState === "paused") {
      if (pausedSinceRef.current === null) pausedSinceRef.current = Date.now()
      return undefined
    }
    if (trackingState === "tracking") {
      if (pausedSinceRef.current !== null) {
        totalPausedMsRef.current += Date.now() - pausedSinceRef.current
        pausedSinceRef.current = null
      }
      if (localStartRef.current === null) {
        baseSecondsRef.current = session?.duration_seconds ?? 0
        localStartRef.current = Date.now()
      }
    }
    const tick = setInterval(() => {
      if (localStartRef.current === null) { setElapsed(0); return }
      const active = Date.now() - localStartRef.current - totalPausedMsRef.current
      setElapsed(Math.max(0, baseSecondsRef.current + Math.floor(active / 1000)))
    }, 1000)
    return () => clearInterval(tick)
  }, [trackingState, session?.duration_seconds])

  useEffect(() => {
    if (!prediction) return
    const { load_level, confidence: conf, features } = prediction
    const time = new Date().toLocaleTimeString()
    setLoadLevel(load_level); setConfidence(Math.round(conf * 100)); setLastUpdated(new Date())
    setHistory((prev) => [...prev.slice(-29), { time, level: load_level, score: Math.round(conf * 100) }])
    const typing_wpm = features?.typing_wpm ?? features?.wpm ?? null
    if (typing_wpm != null && typing_wpm > 0) {
      setLatestWpm(typing_wpm)
      setWpmHistory((prev) => [...prev.slice(-29), { time, wpm: typing_wpm }])
    }
  }, [prediction])

  useEffect(() => {
    if (trackingState === "idle") { setLatestWpm(null); setWpmHistory([]); setConfidence(null); setLoadLevel("unknown"); setTotalKeys(0) }
  }, [trackingState])

  useEffect(() => {
    if (trackingState === "idle") { prevKeyEvents.current = 0; return }
    const current = quality?.keyEvents ?? 0
    if (current < prevKeyEvents.current) setTotalKeys((t) => t + prevKeyEvents.current)
    prevKeyEvents.current = current
  }, [quality?.keyEvents, trackingState])

  const wsUI   = STATUS_UI[status] || STATUS_UI.offline
  const WsIcon = wsUI.icon
  const liveMouseEvents = quality?.mouseEvents ?? 0
  const liveWpm = latestWpm != null ? latestWpm : "—"
  const validWpmHistory = wpmHistory.filter((p) => p.wpm > 0)

  const loadColors = { low: "#37D9A0", medium: "#FFB547", high: "#FF5364" }
  const gaugeColor = loadColors[loadLevel] || "#00D9E8"

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <PageHeader
        title="Live Monitoring"
        description="Real-time behavioral signals — data flows via WebSocket after each prediction"
        badge="Live Session"
        action={
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
              style={{ background: wsUI.bg, border: `1px solid ${wsUI.border}`, color: wsUI.color }}
              role="status" aria-live="polite">
              <WsIcon className={`w-3.5 h-3.5 ${status === "reconnecting" ? "animate-spin" : ""}`} />
              {wsUI.label}
            </span>
            {lastUpdated && (
              <span className="text-[11px] nums" style={{ color: "#536477" }}>
                {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <TrackingControls />
            <LoadBadge level={loadLevel} animate={trackingState === "tracking"} />
          </div>
        }
      />

      <TrackingStatus />

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Confidence"   value={confidence != null ? confidence : "—"} unit={confidence != null ? "%" : ""} icon={Zap}              accent="primary"  sub="Model confidence" delay={0.0} />
        <StatCard label="Session Time" value={formatDuration(elapsed)} icon={Timer}                                        accent="accent"   sub="Since tracking" delay={0.05} />
        <StatCard label="Typing WPM"   value={liveWpm}                 icon={Keyboard}                                     accent="success"  sub="Live WPM"       delay={0.10} />
        <StatCard label="Mouse Events" value={liveMouseEvents}          icon={MousePointerClick}                            accent="warning"  sub="This interval"  delay={0.15} />
        <StatCard label="Keys Typed"   value={totalKeys}                icon={Keyboard}                                     accent="primary"  sub="Total session"  delay={0.20} />
      </div>

      {/* Offline banner */}
      {!connected && status !== "connecting" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          role="alert"
          className="rounded-xl px-4 py-3 flex items-center gap-3 text-[13px]"
          style={{ background: "rgba(255,181,71,0.08)", border: "1px solid rgba(255,181,71,0.22)", color: "#FFB547" }}>
          <WifiOff className="w-4 h-4 shrink-0" />
          <span>
            {status === "reconnecting"
              ? "WebSocket disconnected — attempting to reconnect automatically…"
              : "WebSocket offline — live charts will be empty, but predictions are still saved via HTTP."}
          </span>
        </motion.div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Confidence chart */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="rounded-xl p-5"
          style={{ background: "#0B1420", border: "1px solid rgba(100,170,190,0.14)" }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(0,217,232,0.10)", border: "1px solid rgba(0,217,232,0.20)" }}>
              <Cpu className="w-[18px] h-[18px]" style={{ color: "#00D9E8" }} />
            </div>
            <div>
              <h3 className="text-[13px] font-semibold" style={{ color: "#EAF2F8" }}>Confidence stream</h3>
              <p className="text-[11px] mt-0.5" style={{ color: "#8493A7" }}>Pushed live via WebSocket</p>
            </div>
          </div>
          {history.length < 2
            ? <EmptyState icon={Cpu} title="No data yet" description="Start tracking and interact with your device to see the confidence stream." />
            : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={history} margin={{ top: 6, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="liveGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor={gaugeColor} stopOpacity={0.30} />
                      <stop offset="100%" stopColor={gaugeColor} stopOpacity={0}    />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="0" stroke="rgba(100,170,190,0.08)" vertical={false} />
                  <XAxis dataKey="time" tick={{ fontSize: 11, fill: "#536477" }} axisLine={false} tickLine={false} dy={8} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#536477" }} axisLine={false} tickLine={false}
                    tickFormatter={(v) => `${v}%`} width={42} />
                  <Tooltip contentStyle={tooltipStyle}
                    labelStyle={{ color: "#8493A7", fontSize: 11, marginBottom: 2 }}
                    itemStyle={{ color: gaugeColor, fontSize: 12, fontWeight: 600 }}
                    formatter={(v) => [`${v}%`, "Confidence"]}
                    cursor={{ stroke: gaugeColor, strokeOpacity: 0.3, strokeWidth: 1 }} />
                  <Area type="monotone" dataKey="score"
                    stroke={gaugeColor} strokeWidth={2}
                    fill="url(#liveGrad)"
                    activeDot={{ r: 4, fill: gaugeColor, stroke: "#0B1420", strokeWidth: 2 }}
                    isAnimationActive animationDuration={500} />
                </AreaChart>
              </ResponsiveContainer>
            )}
        </motion.div>

        {/* WPM chart */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="rounded-xl p-5"
          style={{ background: "#0B1420", border: "1px solid rgba(100,170,190,0.14)" }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(55,217,160,0.10)", border: "1px solid rgba(55,217,160,0.20)" }}>
              <Keyboard className="w-[18px] h-[18px]" style={{ color: "#37D9A0" }} />
            </div>
            <div>
              <h3 className="text-[13px] font-semibold" style={{ color: "#EAF2F8" }}>Typing speed</h3>
              <p className="text-[11px] mt-0.5" style={{ color: "#8493A7" }}>Words per minute from keystrokes</p>
            </div>
          </div>
          {validWpmHistory.length < 1
            ? <EmptyState icon={Keyboard} title="No typing data" description="Type continuously during a session to see your WPM trend." />
            : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={validWpmHistory} margin={{ top: 6, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="0" stroke="rgba(100,170,190,0.08)" vertical={false} />
                  <XAxis dataKey="time" tick={{ fontSize: 11, fill: "#536477" }} axisLine={false} tickLine={false} dy={8} />
                  <YAxis
                    domain={([dMin, dMax]) => {
                      const pad = Math.max(10, Math.ceil((dMax - dMin) * 0.2))
                      return [Math.max(0, dMin - pad), dMax + pad]
                    }}
                    tick={{ fontSize: 11, fill: "#536477" }} axisLine={false} tickLine={false}
                    tickFormatter={(v) => `${v}`} width={42} />
                  <Tooltip contentStyle={tooltipStyle}
                    labelStyle={{ color: "#8493A7", fontSize: 11, marginBottom: 2 }}
                    itemStyle={{ color: "#37D9A0", fontSize: 12, fontWeight: 600 }}
                    formatter={(v) => [`${v} wpm`, "Typing speed"]}
                    cursor={{ stroke: "#37D9A0", strokeOpacity: 0.3, strokeWidth: 1 }} />
                  <Line type="monotone" dataKey="wpm"
                    stroke="#37D9A0" strokeWidth={2}
                    dot={validWpmHistory.length === 1 ? { r: 4, fill: "#37D9A0" } : false}
                    activeDot={{ r: 4, fill: "#37D9A0", stroke: "#0B1420", strokeWidth: 2 }}
                    isAnimationActive={validWpmHistory.length > 1} />
                </LineChart>
              </ResponsiveContainer>
            )}
        </motion.div>
      </div>
    </div>
  )
}
