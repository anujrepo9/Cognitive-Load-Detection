import { useState, useEffect, useRef } from "react"
import { useAuthFetch } from "../hooks/useAuthFetch"
import { motion } from "framer-motion"
import {
  Activity, BarChart3, BrainCircuit, TrendingUp,
  Clock, Cpu, MousePointerClick, Keyboard, Calendar, WifiOff,
  Zap, Target,
} from "lucide-react"
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts"
import { useAuth } from "../context/AuthContext"
import { useTracking } from "../context/TrackingContext"
import { dashboardAPI, modelAPI } from "../services/api"
import LoadBadge from "../components/ui/LoadBadge"
import ProgressRing from "../components/ui/ProgressRing"
import EmptyState from "../components/ui/EmptyState"
import { SkeletonPage } from "../components/ui/Skeleton"
import TrackingControls from "../components/tracking/TrackingControls"
import TrackingStatus from "../components/tracking/TrackingStatus"
import AppUsagePanel from "../components/AppUsagePanel"

const loadColors  = { low: "#37D9A0", medium: "#FFB547", high: "#FF5364" }
const loadDetails = {
  low:    { label: "Low",    color: "#37D9A0", desc: "Comfortable focus pace — your effort is sustainable." },
  medium: { label: "Medium", color: "#FFB547", desc: "Steady but engaged — keep an eye on sustained effort." },
  high:   { label: "High",   color: "#FF5364", desc: "Close to overload — consider a short recovery break." },
}

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m`
  return `${m}m ${s.toString().padStart(2, "0")}s`
}

// Cyberpunk tooltip style
const tooltipStyle = {
  background: "rgba(9,15,24,0.95)",
  border: "1px solid rgba(0,217,232,0.22)",
  borderRadius: 10,
  fontSize: 12,
  color: "#EAF2F8",
  boxShadow: "0 8px 24px rgba(0,0,0,0.5), 0 0 12px rgba(0,217,232,0.08)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  padding: "8px 12px",
  fontFamily: "'Space Grotesk', 'Inter', system-ui",
}

// Mini metric tile inside the gauge hero panel
function MiniMetric({ icon: Icon, label, value, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-xl p-3.5"
      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(100,170,190,0.10)" }}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: "#536477" }} aria-hidden="true" />
        <span className="text-[10px] font-semibold tracking-[0.08em] uppercase" style={{ color: "#536477" }}>
          {label}
        </span>
      </div>
      <p className="text-[1.125rem] font-bold leading-none nums" style={{ color: "#EAF2F8" }}>
        {value}
      </p>
    </motion.div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const { prediction, websocketStatus: wsStatus, session, trackingState, quality } = useTracking()

  const [loadLevel,    setLoadLevel]    = useState("unknown")
  const [confidence,   setConfidence]   = useState(null)
  const [history,      setHistory]      = useState([])
  const [stats,        setStats]        = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [lastUpdated,  setLastUpdated]  = useState(null)
  const [elapsed,      setElapsed]      = useState(0)
  const [predictions,  setPredictions]  = useState(0)
  const [modelInfo,    setModelInfo]    = useState(null)

  const mountElapsed = (
    session?.start_time && trackingState === "tracking"
      ? Math.max(0, Math.floor((Date.now() - new Date(session.start_time).getTime()) / 1000))
      : (session?.duration_seconds ?? 0)
  )
  const localTimerStartRef = useRef(trackingState === "tracking" ? Date.now() : null)
  const baseSecondsRef     = useRef(mountElapsed)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (mountElapsed > 0) setElapsed(mountElapsed) }, [])

  useEffect(() => {
    if (trackingState === "idle") {
      localTimerStartRef.current = null; baseSecondsRef.current = 0; setElapsed(0)
    }
  }, [trackingState])

  useEffect(() => {
    if (!session?.session_id) return
    if (trackingState !== "tracking") return
    if (localTimerStartRef.current === null) {
      baseSecondsRef.current     = session?.duration_seconds ?? 0
      localTimerStartRef.current = Date.now()
    }
    const tick = setInterval(() => {
      if (localTimerStartRef.current === null) { setElapsed(0); return }
      const localMs = Date.now() - localTimerStartRef.current
      setElapsed(Math.max(0, baseSecondsRef.current + Math.floor(localMs / 1000)))
    }, 1000)
    return () => clearInterval(tick)
  }, [session?.session_id, trackingState])

  useEffect(() => {
    if (!prediction) return
    const { load_level, confidence: conf } = prediction
    setLoadLevel(load_level); setConfidence(conf); setLastUpdated(new Date())
    setPredictions((p) => p + 1)
    setHistory((prev) => [
      ...prev.slice(-29),
      { time: new Date().toLocaleTimeString(), level: load_level, score: Math.round(conf * 100) },
    ])
  }, [prediction])

  useAuthFetch(() => {
    Promise.allSettled([dashboardAPI.overview(), modelAPI.info()])
      .then(([statsRes, modelRes]) => {
        if (statsRes.status === "fulfilled") setStats(statsRes.value)
        if (modelRes.status === "fulfilled") setModelInfo(modelRes.value)
      }).finally(() => setLoading(false))
  }, [])

  const counts = { low: 0, medium: 0, high: 0 }
  history.forEach((h) => { if (counts[h.level] != null) counts[h.level]++ })

  const currentConf = confidence ? Math.round(confidence * 100) : 0
  const gaugeColor  = loadColors[loadLevel] || "#00D9E8"
  const loadDesc    = loadDetails[loadLevel]?.desc || "Waiting for first prediction — start tracking to see live insights."
  const loadLabel   = loadDetails[loadLevel]?.label || "Unknown"

  if (loading) return <SkeletonPage />

  const wsConnected = wsStatus === "connected" || wsStatus === "native"

  return (
    <div className="p-4 lg:p-6 space-y-5">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="live-dot w-1.5 h-1.5 rounded-full" style={{ background: "#00D9E8" }} />
            <span className="text-[10px] font-semibold tracking-[0.10em] uppercase" style={{ color: "#536477" }}>
              AI Command Center
            </span>
          </div>
          <h1 style={{ color: "#EAF2F8" }}>
            Welcome back, {user?.name?.split(" ")[0] || "Operator"}
          </h1>
          <p className="mt-1 text-sm" style={{ color: "#8493A7" }}>
            Real-time cognitive load monitoring via behavioral signal analysis
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <TrackingStatus />
          <TrackingControls compact />
        </div>
      </div>

      {/* ── Stat row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Current Load", accent: "primary",
            icon: BrainCircuit,
            value: wsConnected && loadLevel !== "unknown" ? loadLabel : "—",
            sub: wsConnected ? "Live signal" : "Not tracking",
          },
          {
            label: "Session Duration", accent: "success",
            icon: Clock,
            value: elapsed > 0 ? formatDuration(elapsed) : "—",
            sub: trackingState === "tracking" ? "Active" : "Idle",
          },
          {
            label: "Predictions", accent: "warning",
            icon: Target,
            value: predictions > 0 ? predictions : (stats?.total_predictions ?? "—"),
            sub: "This session",
          },
          {
            label: "Avg WPM", accent: "accent",
            icon: Keyboard,
            value: stats?.avg_wpm ?? "—",
            sub: "Typing speed",
          },
        ].map(({ label, icon: Icon, value, sub, accent }, i) => {
          const cfg = {
            primary: { iconBg: "rgba(0,217,232,0.10)", iconColor: "#00D9E8", iconBorder: "rgba(0,217,232,0.20)" },
            success: { iconBg: "rgba(55,217,160,0.10)", iconColor: "#37D9A0", iconBorder: "rgba(55,217,160,0.20)" },
            warning: { iconBg: "rgba(255,181,71,0.10)", iconColor: "#FFB547", iconBorder: "rgba(255,181,71,0.20)" },
            accent:  { iconBg: "rgba(119,117,255,0.10)", iconColor: "#7775FF", iconBorder: "rgba(119,117,255,0.20)" },
          }[accent]
          return (
            <motion.div key={label}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-xl p-5 group relative overflow-hidden"
              style={{ background: "#0B1420", border: "1px solid rgba(100,170,190,0.14)", transition: "border-color 0.2s, box-shadow 0.2s, transform 0.2s" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(0,217,232,0.22)"; e.currentTarget.style.transform = "translateY(-1px)" }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(100,170,190,0.14)"; e.currentTarget.style.transform = "" }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold tracking-[0.10em] uppercase mb-3" style={{ color: "#536477" }}>{label}</p>
                  <p className="text-[1.75rem] font-bold leading-none nums" style={{ color: "#EAF2F8" }}>{value}</p>
                </div>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: cfg.iconBg, border: `1px solid ${cfg.iconBorder}` }}>
                  <Icon className="w-[18px] h-[18px]" style={{ color: cfg.iconColor }} />
                </div>
              </div>
              <p className="text-[11px] mt-2" style={{ color: "#8493A7" }}>{sub}</p>
            </motion.div>
          )
        })}
      </div>

      {/* ── Hero row: gauge + signals ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* Gauge panel */}
        <motion.div
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-xl p-6 xl:col-span-1 flex flex-col items-center relative overflow-hidden"
          style={{ background: "#0B1420", border: "1px solid rgba(100,170,190,0.14)" }}>

          {/* Ambient radial glow behind gauge */}
          <div className="absolute inset-0 pointer-events-none" aria-hidden="true"
            style={{
              background: `radial-gradient(ellipse at 50% 40%, ${gaugeColor}14 0%, transparent 65%)`,
            }} />

          <p className="text-[10px] font-semibold tracking-[0.10em] uppercase mb-4 self-start" style={{ color: "#536477" }}>
            Live Cognitive Load
          </p>

          <ProgressRing
            value={currentConf}
            size={200}
            strokeWidth={12}
            color={gaugeColor}
            loadLevel={loadLevel}
            label={`${currentConf}%`}
            sublabel={loadLabel}
            showTicks={true}
          />

          <LoadBadge level={loadLevel} animate={wsConnected} className="mt-4" />

          <p className="text-center text-[12px] mt-3 leading-relaxed max-w-[200px]" style={{ color: "#8493A7" }}>
            {loadDesc}
          </p>

          {lastUpdated && (
            <p className="text-[10px] mt-2" style={{ color: "#536477" }}>
              Updated {lastUpdated.toLocaleTimeString()}
            </p>
          )}

          {!wsConnected && (
            <div className="mt-4 flex items-center gap-2 text-[11px] font-medium px-3 py-1.5 rounded-full"
              style={{ background: "rgba(255,83,100,0.10)", border: "1px solid rgba(255,83,100,0.20)", color: "#FF5364" }}>
              <WifiOff className="w-3 h-3" />
              Not connected
            </div>
          )}

          {/* 2x2 mini metrics */}
          <div className="grid grid-cols-2 gap-2 w-full mt-4">
            <MiniMetric icon={Clock}           label="Duration" value={elapsed > 0 ? formatDuration(elapsed) : "—"} delay={0.1} />
            <MiniMetric icon={Zap}             label="Signals"  value={predictions}  delay={0.12} />
            <MiniMetric icon={MousePointerClick} label="Clicks" value={quality?.totalMouse ?? stats?.mouse_events ?? "—"} delay={0.14} />
            <MiniMetric icon={Keyboard}        label="Keys"     value={quality?.totalKeys ?? stats?.typing_events ?? "—"} delay={0.16} />
          </div>
        </motion.div>

      {/* ── App Usage Panel ── */}
      <AppUsagePanel hours={24} />

        {/* Confidence chart */}
        <motion.div
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-xl p-5 xl:col-span-2"
          style={{ background: "#0B1420", border: "1px solid rgba(100,170,190,0.14)" }}>

          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: "rgba(0,217,232,0.10)", border: "1px solid rgba(0,217,232,0.20)" }}>
                <Activity className="w-[18px] h-[18px]" style={{ color: "#00D9E8" }} />
              </div>
              <div>
                <h3 className="text-[13px] font-semibold" style={{ color: "#EAF2F8" }}>Confidence over time</h3>
                <p className="text-[11px] mt-0.5" style={{ color: "#8493A7" }}>Real-time WebSocket predictions</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium" style={{ color: "#8493A7" }}>
                <span className="w-2 h-2 rounded-full" style={{ background: gaugeColor }} /> Confidence
              </span>
              <LoadBadge level={loadLevel} />
            </div>
          </div>

          {history.length < 2 ? (
            <EmptyState icon={Activity} title="No live data yet"
              description="Start typing or moving the mouse to generate predictions." />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={history} margin={{ top: 6, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="confGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={gaugeColor} stopOpacity={0.30} />
                    <stop offset="100%" stopColor={gaugeColor} stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="0" stroke="rgba(100,170,190,0.08)" vertical={false} />
                <XAxis dataKey="time"
                  tick={{ fontSize: 11, fill: "#536477", fontFamily: "'Space Grotesk', system-ui" }}
                  axisLine={false} tickLine={false} dy={8} />
                <YAxis domain={[0, 100]}
                  tick={{ fontSize: 11, fill: "#536477", fontFamily: "'Space Grotesk', system-ui" }}
                  axisLine={false} tickLine={false}
                  tickFormatter={(v) => `${v}%`} width={42} />
                <Tooltip contentStyle={tooltipStyle}
                  labelStyle={{ color: "#8493A7", fontSize: 11, marginBottom: 2 }}
                  itemStyle={{ color: gaugeColor, fontSize: 12, fontWeight: 600 }}
                  formatter={(v) => [`${v}%`, "Confidence"]}
                  cursor={{ stroke: gaugeColor, strokeOpacity: 0.3, strokeWidth: 1 }} />
                <Area type="monotone" dataKey="score"
                  stroke={gaugeColor} strokeWidth={2}
                  fill="url(#confGrad)"
                  isAnimationActive={true} animationDuration={500}
                  activeDot={{ r: 4, fill: gaugeColor, stroke: "#0B1420", strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </motion.div>
      </div>

      {/* ── Bottom row: session + load distribution ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* Session overview */}
        <motion.div
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-xl p-5"
          style={{ background: "#0B1420", border: "1px solid rgba(100,170,190,0.14)" }}>
          <h3 className="text-[13px] font-semibold mb-4" style={{ color: "#EAF2F8" }}>Session Overview</h3>
          <div className="space-y-0.5">
            {[
              { icon: Keyboard,          label: "Typing events", value: quality?.totalKeys ?? stats?.typing_events ?? "—" },
              { icon: MousePointerClick, label: "Mouse clicks",  value: quality?.totalMouse ?? stats?.mouse_events ?? "—" },
              { icon: Cpu,               label: "Avg WPM",       value: stats?.avg_wpm ?? "—" },
              { icon: BrainCircuit,      label: "Model version", value: modelInfo?.version ? `v${modelInfo.version}` : "rule-based" },
              { icon: Calendar,          label: "Session ID",    value: session?.session_id ? `#${session.session_id}` : "—" },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label}
                className="flex items-center justify-between py-2.5"
                style={{ borderBottom: "1px solid rgba(100,170,190,0.07)" }}>
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(100,170,190,0.10)" }}>
                    <Icon className="w-3.5 h-3.5" style={{ color: "#536477" }} />
                  </div>
                  <span className="text-[13px]" style={{ color: "#8493A7" }}>{label}</span>
                </div>
                <span className="text-[13px] font-semibold nums" style={{ color: "#EAF2F8" }}>{value}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Load distribution */}
        <motion.div
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-xl p-5 xl:col-span-2"
          style={{ background: "#0B1420", border: "1px solid rgba(100,170,190,0.14)" }}>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(119,117,255,0.10)", border: "1px solid rgba(119,117,255,0.20)" }}>
              <TrendingUp className="w-[18px] h-[18px]" style={{ color: "#7775FF" }} />
            </div>
            <div>
              <h3 className="text-[13px] font-semibold" style={{ color: "#EAF2F8" }}>Load Distribution</h3>
              <p className="text-[11px] mt-0.5" style={{ color: "#8493A7" }}>This session</p>
            </div>
          </div>

          {history.length === 0 ? (
            <EmptyState icon={BarChart3} title="No data yet"
              description="Detected load levels will appear here as you work." />
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {Object.entries(counts).map(([level, count]) => {
                const pct = Math.round((count / history.length) * 100)
                const col = loadColors[level]
                return (
                  <div key={level} className="rounded-xl p-4 text-center"
                    style={{ background: `${col}0A`, border: `1px solid ${col}25` }}>
                    <div className="flex items-center justify-center gap-1.5 mb-2">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: col }} />
                      <span className="text-[11px] font-semibold capitalize" style={{ color: col }}>
                        {level}
                      </span>
                    </div>
                    <p className="text-[2rem] font-bold nums leading-none" style={{ color: "#EAF2F8" }}>{pct}%</p>
                    <p className="text-[11px] mt-1.5" style={{ color: "#8493A7" }}>
                      {count} reading{count === 1 ? "" : "s"}
                    </p>
                    <div className="mt-3 h-1 rounded-full overflow-hidden" style={{ background: "rgba(100,170,190,0.10)" }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                        className="h-full rounded-full"
                        style={{ background: col, boxShadow: `0 0 8px ${col}60` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}