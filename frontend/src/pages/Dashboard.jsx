import { useState, useEffect, useRef } from "react"
import { useAuthFetch } from "../hooks/useAuthFetch"
import { motion } from "framer-motion"
import {
  Activity, BarChart3, RotateCcw, BrainCircuit, TrendingUp,
  Clock, Cpu, MousePointerClick, Keyboard, Calendar, WifiOff,
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

const loadColors  = { low: "#34c759", medium: "#ff9f0a", high: "#ff3b30" }
const loadDetails = {
  low:    { label: "Low",    color: "#34c759", desc: "Comfortable focus pace — your effort is sustainable." },
  medium: { label: "Medium", color: "#ff9f0a", desc: "Steady but engaged — keep an eye on sustained effort." },
  high:   { label: "High",   color: "#ff3b30", desc: "Close to overload — consider a short recovery break." },
}

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m`
  return `${m}m ${s.toString().padStart(2, "0")}s`
}

/* Mini metric tile — used inside the hero's right panel (2×2 grid).
 * Slimmer than a full StatCard so four of them fit cleanly without
 * competing with the gauge for attention. */
function MiniMetric({ icon: Icon, label, value, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-xl border border-[#e5e5ea]/70 dark:border-white/5
        bg-white/60 dark:bg-white/[0.03] p-3.5">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className="w-3.5 h-3.5 text-[#86868b] dark:text-[#a1a1a6]" aria-hidden="true" />
        <span className="text-[10px] font-medium uppercase tracking-[0.06em]
          text-[#86868b] dark:text-[#a1a1a6]">
          {label}
        </span>
      </div>
      <p className="text-[1.125rem] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]
        nums tracking-[-0.018em] leading-none">
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

  // Session timer — survives page navigation (component remount).
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
      localTimerStartRef.current = null
      baseSecondsRef.current     = 0
      setElapsed(0)
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

  // React to WebSocket prediction pushes
  useEffect(() => {
    if (!prediction) return
    const { load_level, confidence: conf } = prediction
    setLoadLevel(load_level)
    setConfidence(conf)
    setLastUpdated(new Date())
    setPredictions((p) => p + 1)
    setHistory((prev) => [
      ...prev.slice(-29),
      { time: new Date().toLocaleTimeString(), level: load_level, score: Math.round(conf * 100) },
    ])
  }, [prediction])

  useAuthFetch(() => {
    Promise.allSettled([
      dashboardAPI.overview(),
      modelAPI.info(),
    ]).then(([statsRes, modelRes]) => {
      if (statsRes.status === "fulfilled") setStats(statsRes.value)
      if (modelRes.status === "fulfilled") setModelInfo(modelRes.value)
    }).finally(() => setLoading(false))
  }, [])

  const counts = { low: 0, medium: 0, high: 0 }
  history.forEach((h) => { if (counts[h.level] != null) counts[h.level]++ })

  const currentConf = confidence ? Math.round(confidence * 100) : 0
  const gaugeColor  = loadColors[loadLevel] || "#6366f1"
  const loadDesc    = loadDetails[loadLevel]?.desc || "Waiting for first prediction — start tracking to see live insights."
  const loadLabel   = loadDetails[loadLevel]?.label || "Unknown"

  if (loading) return <SkeletonPage />

  const wsConnected = wsStatus === "connected" || wsStatus === "native"

  return (
    <div className="p-4 lg:p-6 space-y-6">

      {/* ===== 1. Compact header — title + WS status + controls ===== */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <h1 className="text-[1.625rem] font-semibold tracking-[-0.024em]
              text-[#1d1d1f] dark:text-[#f5f5f7] leading-tight">
              {user?.name?.split(" ")[0] ? `Welcome back, ${user.name.split(" ")[0]}` : "Cognitive Dashboard"}
            </h1>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
              text-[11px] font-semibold transition-colors
              ${wsConnected
                ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30"
                : "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30"}`}
              role="status" aria-live="polite">
              {wsConnected ? (
                <>
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full
                      rounded-full bg-emerald-500 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                  </span>
                  Live
                </>
              ) : (
                <><WifiOff className="w-3 h-3" /> {wsStatus}</>
              )}
            </span>
          </div>
          <p className="text-[13px] text-[#6e6e73] dark:text-[#a1a1a6]">
            Your cognitive workload in real time — stay balanced.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => { setHistory([]); setPredictions(0) }}
            className="btn-secondary text-[13px] py-1.5">
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
          <TrackingControls />
        </div>
      </div>

      {/* ===== 2. Tracking status ===== */}
      <TrackingStatus />

      {/* ===== 3. HERO BAND — Cognitive Load Gauge (focal point) =====
       *  Layout: gauge on the left (~40%), AI status + 2×2 mini-metrics on
       *  the right (~60%). The previously separate "Current load" and
       *  "Confidence" stat cards are removed — the gauge already shows both.
       *  The remaining "Sessions today" and "Avg load today" cards are
       *  folded into the hero's mini-metric grid so the page reads as
       *  one focused unit instead of gauge + redundant cards + chart.
       */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="card p-6 lg:p-8 relative overflow-hidden"
      >
        {/* Ambient glow — only behind the gauge, very restrained */}
        <div
          aria-hidden="true"
          className="absolute -left-12 top-1/2 -translate-y-1/2 w-72 h-72 rounded-full
            blur-3xl pointer-events-none opacity-50"
          style={{ background: `radial-gradient(circle, ${gaugeColor}40 0%, transparent 70%)` }}
        />

        <div className="relative grid grid-cols-1 lg:grid-cols-5 gap-8 items-center">

          {/* Gauge — the focal point (left, ~40%) */}
          <div className="lg:col-span-2 flex flex-col items-center justify-center">
            <ProgressRing
              value={currentConf}
              size={260}
              strokeWidth={16}
              color={gaugeColor}
              loadLevel={loadLevel}
              label={
                <>
                  <span className="font-rounded text-[3.25rem] font-semibold leading-none
                    text-[#1d1d1f] dark:text-[#f5f5f7] nums tracking-[-0.028em]">
                    {currentConf}
                    <span className="text-[1.75rem] text-[#86868b] dark:text-[#a1a1a6] font-medium ml-0.5">%</span>
                  </span>
                  <span className="text-[11px] font-medium uppercase tracking-[0.08em]
                    text-[#86868b] dark:text-[#a1a1a6] mt-1">Confidence</span>
                </>
              }
              sublabel={
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2">
                  <LoadBadge level={loadLevel} animate={trackingState === "tracking"} />
                </div>
              }
            />
          </div>

          {/* Right panel — AI status + 2×2 mini-metrics (~60%) */}
          <div className="lg:col-span-3 space-y-5">
            {/* AI status heading */}
            <div className="flex items-center gap-2 flex-wrap">
              <BrainCircuit className="w-4 h-4 text-indigo-500 dark:text-indigo-300" aria-hidden="true" />
              <h2 className="text-[13px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]
                uppercase tracking-[0.06em]">
                AI Status
              </h2>
              <span className="text-[11px] text-[#86868b] dark:text-[#a1a1a6]">·</span>
              <span className="text-[11px] text-[#86868b] dark:text-[#a1a1a6]">
                {loadLabel} load detected
              </span>
              {lastUpdated && (
                <span className="ml-auto text-[11px] text-[#86868b] dark:text-[#a1a1a6] nums">
                  Last update {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </div>

            <p className="text-[14px] leading-relaxed text-[#6e6e73] dark:text-[#a1a1a6]
              max-w-md">
              {loadDesc}
            </p>

            {/* 2×2 mini-metrics — Tracked | Predictions | Sessions today | Avg load today */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <MiniMetric icon={Clock}     label="Tracked"        value={formatDuration(elapsed)} delay={0.05} />
              <MiniMetric icon={Activity}  label="Predictions"    value={predictions}            delay={0.10} />
              <MiniMetric icon={Calendar}  label="Sessions today" value={stats?.sessions_today ?? 0} delay={0.15} />
              <MiniMetric icon={BarChart3} label="Avg load today" value={stats?.avg_load ?? "—"}  delay={0.20} />
            </div>
          </div>
        </div>
      </motion.div>

      {/* ===== 4. Main grid — Live chart (2/3) + Session overview (1/3) =====
       *  Chart now gets the full left column (no Load distribution below it),
       *  so it becomes the clean secondary focal point after the gauge.
       */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Live confidence chart */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="card p-5 xl:col-span-2"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-50/80 dark:bg-indigo-500/12
                flex items-center justify-center">
                <Activity className="w-[18px] h-[18px] text-indigo-500 dark:text-indigo-300" />
              </div>
              <div>
                <h3 className="text-[13px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]
                  tracking-[-0.005em]">
                  Confidence over time
                </h3>
                <p className="text-[11px] text-[#86868b] dark:text-[#a1a1a6] mt-0.5">
                  Real-time WebSocket push
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium
                text-[#6e6e73] dark:text-[#a1a1a6]">
                <span className="w-2 h-2 rounded-full" style={{ background: gaugeColor }} /> Confidence
              </span>
              <LoadBadge level={loadLevel} />
            </div>
          </div>

          {history.length < 2 ? (
            <EmptyState
              icon={Activity}
              title="No live data yet"
              description="Start typing or moving the mouse to generate predictions."
              tone="primary"
            />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={history} margin={{ top: 6, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="confGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={gaugeColor} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={gaugeColor} stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="0"
                  stroke="rgba(120,120,128,0.12)"
                  vertical={false}
                />
                <XAxis dataKey="time"
                  tick={{ fontSize: 11, fill: "#86868b" }}
                  axisLine={false} tickLine={false} dy={8} />
                <YAxis domain={[0, 100]}
                  tick={{ fontSize: 11, fill: "#86868b" }}
                  axisLine={false} tickLine={false}
                  tickFormatter={(v) => `${v}%`} width={42} />
                <Tooltip
                  contentStyle={{
                    background: "rgba(255,255,255,0.85)",
                    border: "1px solid rgba(255,255,255,0.6)",
                    borderRadius: 12,
                    fontSize: 12,
                    boxShadow: "0 8px 24px rgba(0,0,0,0.10), 0 0 0 0.5px rgba(0,0,0,0.04)",
                    backdropFilter: "blur(20px) saturate(180%)",
                    WebkitBackdropFilter: "blur(20px) saturate(180%)",
                    color: "#1d1d1f",
                    padding: "8px 12px",
                  }}
                  labelStyle={{ color: "#6e6e73", fontSize: 11, marginBottom: 2 }}
                  itemStyle={{ color: "#1d1d1f", fontSize: 12, fontWeight: 600 }}
                  formatter={(v) => [`${v}%`, "Confidence"]}
                  cursor={{ stroke: gaugeColor, strokeOpacity: 0.3, strokeWidth: 1 }}
                />
                <Area
                  type="monotone"
                  dataKey="score"
                  stroke={gaugeColor}
                  strokeWidth={1.75}
                  fill="url(#confGrad)"
                  isAnimationActive={true}
                  animationDuration={500}
                  activeDot={{
                    r: 4,
                    fill: gaugeColor,
                    stroke: "#fff",
                    strokeWidth: 2,
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        {/* Session overview — right column (1/3) */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="card p-5"
        >
          <h3 className="text-[13px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] mb-4 tracking-[-0.005em]">
            Session overview
          </h3>
          <div className="space-y-1">
            {[
              { icon: Keyboard,           label: "Typing events", value: quality?.totalKeys > 0 ? quality.totalKeys : (stats?.typing_events ?? "—") },
              { icon: MousePointerClick,  label: "Mouse clicks",  value: quality?.totalMouse > 0 ? quality.totalMouse : (stats?.mouse_events ?? "—") },
              { icon: Cpu,                label: "Avg WPM",       value: stats?.avg_wpm        ?? "—" },
              { icon: BrainCircuit,       label: "Model version", value: modelInfo?.version ? `v${modelInfo.version}` : "rule-based" },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label}
                className="flex items-center justify-between py-2.5
                  border-b border-[#f5f5f7] dark:border-white/5 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-[#f5f5f7] dark:bg-white/5
                    flex items-center justify-center">
                    <Icon className="w-3.5 h-3.5 text-[#86868b] dark:text-[#a1a1a6]" />
                  </div>
                  <span className="text-[13px] text-[#6e6e73] dark:text-[#a1a1a6]">{label}</span>
                </div>
                <span className="text-[13px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] nums">
                  {value}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* ===== 5. Load distribution — full width at the bottom =====
       *  Moved out of the left column so the chart gets full vertical
       *  space above. Acts as a session summary band at the foot of the page.
       */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className="card p-5"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-violet-50/80 dark:bg-violet-500/12
            flex items-center justify-center">
            <TrendingUp className="w-[18px] h-[18px] text-violet-500 dark:text-violet-300" />
          </div>
          <div>
            <h3 className="text-[13px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.005em]">
              Load distribution
            </h3>
            <p className="text-[11px] text-[#86868b] dark:text-[#a1a1a6] mt-0.5">This session</p>
          </div>
        </div>

        {history.length === 0 ? (
          <EmptyState icon={BarChart3} title="No data yet"
            description="Detected load levels will appear here as you work." />
        ) : (
          <div className="grid grid-cols-3 gap-4 max-w-3xl">
            {Object.entries(counts).map(([level, value]) => {
              const pct = Math.round((value / history.length) * 100)
              return (
                <div key={level}
                  className="rounded-xl border border-[#e5e5ea]/70 dark:border-white/5
                    bg-white/50 dark:bg-white/[0.03] p-4 text-center">
                  <div className="flex items-center justify-center gap-1.5 mb-2">
                    <span className="w-1.5 h-1.5 rounded-full"
                      style={{ background: loadColors[level] }} />
                    <span className="text-[11px] font-medium capitalize text-[#6e6e73] dark:text-[#a1a1a6]">
                      {level}
                    </span>
                  </div>
                  <p className="text-[1.625rem] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] nums tracking-[-0.022em] leading-none">
                    {pct}%
                  </p>
                  <p className="text-[11px] text-[#86868b] dark:text-[#a1a1a6] mt-1.5">
                    {value} reading{value === 1 ? "" : "s"}
                  </p>
                  <div className="mt-3 h-1.5 rounded-full bg-[#f5f5f7] dark:bg-white/5 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                      className="h-full rounded-full"
                      style={{ background: loadColors[level] }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </motion.div>
    </div>
  )
}