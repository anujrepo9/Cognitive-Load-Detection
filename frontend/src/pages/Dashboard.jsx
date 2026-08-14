import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import {
  Activity, Zap, Target, Calendar, BarChart3, RotateCcw,
  BrainCircuit, TrendingUp, Clock, Cpu, MousePointerClick, Keyboard,
  Sparkles, WifiOff,
} from "lucide-react"
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts"
import { useAuth } from "../context/AuthContext"
import { useTracking } from "../context/TrackingContext"
import { dashboardAPI, modelAPI } from "../services/api"
import StatCard from "../components/ui/StatCard"
import LoadBadge from "../components/ui/LoadBadge"
import ProgressRing from "../components/ui/ProgressRing"
import EmptyState from "../components/ui/EmptyState"
import { SkeletonPage } from "../components/ui/Skeleton"
import TrackingControls from "../components/tracking/TrackingControls"
import TrackingStatus from "../components/tracking/TrackingStatus"

const loadColors  = { low: "#10B981", medium: "#F59E0B", high: "#EF4444" }
const loadDetails = {
  low:    { label: "Low",    color: "#10B981", desc: "Comfortable focus pace" },
  medium: { label: "Medium", color: "#F59E0B", desc: "Steady but engaged" },
  high:   { label: "High",   color: "#EF4444", desc: "Close to overload" },
}

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m`
  return `${m}m ${s.toString().padStart(2, "0")}s`
}

export default function Dashboard() {
  const { user } = useAuth()
  // Behavior tracker drives the flush loop → POST /predict → WS broadcast
  const { prediction, websocketStatus: wsStatus, session, trackingState } = useTracking()

  const [loadLevel,    setLoadLevel]    = useState("unknown")
  const [confidence,   setConfidence]   = useState(null)
  const [history,      setHistory]      = useState([])
  const [stats,        setStats]        = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [lastUpdated,  setLastUpdated]  = useState(null)
  const [elapsed,      setElapsed]      = useState(0)
  const [predictions,  setPredictions]  = useState(0)
  const [modelInfo,    setModelInfo]    = useState(null)

  // Session timer
  useEffect(() => {
    const tick = setInterval(
      () => setElapsed(session?.start_time ? Math.max(0, Math.floor((Date.now() - new Date(session.start_time).getTime()) / 1000)) : 0),
      1000,
    )
    return () => clearInterval(tick)
  }, [session?.session_id, session?.start_time, trackingState])

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

  // Fetch dashboard summary + model info once on mount
  useEffect(() => {
    Promise.allSettled([
      dashboardAPI.overview(),
      modelAPI.info(),
    ]).then(([statsRes, modelRes]) => {
      if (statsRes.status === "fulfilled") setStats(statsRes.value.data)
      if (modelRes.status === "fulfilled") setModelInfo(modelRes.value.data)
    }).finally(() => setLoading(false))
  }, [])

  const counts = { low: 0, medium: 0, high: 0 }
  history.forEach((h) => { if (counts[h.level] != null) counts[h.level]++ })

  const currentConf = confidence ? Math.round(confidence * 100) : 0

  if (loading) return <SkeletonPage />

  const wsConnected = wsStatus === "connected"

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* ===== Hero / Header ===== */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="card p-5 lg:p-6 relative overflow-hidden"
      >
        <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full
          bg-primary/10 dark:bg-primary/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-16 w-64 h-64 rounded-full
          bg-accent/10 blur-3xl pointer-events-none" />

        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Welcome back, {user?.name?.split(" ")[0] || "there"} 👋
              </h1>
              {/* Live / WS status badge */}
              <span className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1
                rounded-full text-xs font-semibold transition-colors
                ${wsConnected
                  ? "bg-success/10 text-success"
                  : "bg-warning/10 text-warning"}`}>
                {wsConnected ? (
                  <>
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full
                        rounded-full bg-success opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
                    </span>
                    Live
                  </>
                ) : (
                  <><WifiOff className="w-3 h-3" /> {wsStatus}</>
                )}
              </span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Here's your cognitive workload in real time. Stay balanced.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => { setHistory([]); setPredictions(0) }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm
                font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-slate-800
                hover:bg-gray-200 dark:hover:bg-slate-700 border border-gray-200
                dark:border-slate-700 transition-colors">
              <RotateCcw className="w-4 h-4" /> Reset
            </button>
            <TrackingControls />
          </div>
        </div>
      </motion.div>

      <TrackingStatus />

      {/* ===== Stat Cards ===== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Current load" value={loadLevel.charAt(0).toUpperCase() + loadLevel.slice(1)}
          icon={Zap} accent="primary" delay={0} sub="Updated via WebSocket"
        />
        <StatCard
          label="Confidence" value={currentConf} unit="%"
          icon={Target} accent="accent" delay={0.05} sub="Prediction confidence"
        />
        <StatCard
          label="Sessions today" value={stats?.sessions_today ?? 0}
          icon={Calendar} accent="success" delay={0.1} sub="Completed sessions"
        />
        <StatCard
          label="Avg load today" value={stats?.avg_load ?? "—"}
          icon={BarChart3} accent="warning" delay={0.15} sub="Daily average"
        />
      </div>

      {/* ===== Main grid ===== */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left column (2/3) */}
        <div className="xl:col-span-2 space-y-6">
          {/* Live confidence chart */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="card p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 dark:bg-primary/20
                  flex items-center justify-center">
                  <Activity className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                    Confidence over time
                  </h3>
                  <p className="text-xs text-gray-400">Real-time WebSocket push</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-medium
                  text-gray-500 dark:text-gray-400">
                  <span className="w-2 h-2 rounded-full bg-primary" /> Confidence
                </span>
                <LoadBadge level={loadLevel} />
              </div>
            </div>

            {history.length < 2 ? (
              <EmptyState
                icon={Activity}
                title="No live data yet"
                description="Start typing or moving the mouse to generate predictions."
              />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={history}>
                  <defs>
                    <linearGradient id="confGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563EB" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#2563EB" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3"
                    stroke="rgba(148,163,184,0.12)" vertical={false} />
                  <XAxis dataKey="time" tick={{ fontSize: 11, fill: "#94A3B8" }}
                    axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#94A3B8" }}
                    axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: "#fff", border: "1px solid #E2E8F0",
                      borderRadius: 12, fontSize: 12, boxShadow: "0 8px 24px rgba(15,23,42,0.1)",
                      color: "#0F172A" }}
                    labelStyle={{ color: "#64748B" }}
                  />
                  <Area type="monotone" dataKey="score" stroke="#2563EB"
                    strokeWidth={2} fill="url(#confGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </motion.div>

          {/* Load distribution */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="card p-5"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-accent/10 dark:bg-accent/20
                flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-accent" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Load distribution
                </h3>
                <p className="text-xs text-gray-400">This session</p>
              </div>
            </div>

            {history.length === 0 ? (
              <EmptyState icon={BarChart3} title="No data yet"
                description="Detected load levels will appear here as you work." />
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {Object.entries(counts).map(([level, value]) => {
                  const pct = Math.round((value / history.length) * 100)
                  return (
                    <div key={level}
                      className="rounded-xl border border-gray-100 dark:border-slate-800 p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5 mb-1">
                        <span className="w-2 h-2 rounded-full"
                          style={{ background: loadColors[level] }} />
                        <span className="text-xs font-medium text-gray-500 capitalize">{level}</span>
                      </div>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">{pct}%</p>
                      <p className="text-[10px] text-gray-400">{value} readings</p>
                      <div className="mt-2 h-1.5 rounded-full bg-gray-100 dark:bg-slate-800 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.6 }}
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

        {/* Right column (1/3) */}
        <div className="space-y-6">
          {/* AI prediction panel */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="card p-5 text-center"
          >
            <div className="flex items-center justify-center gap-2 mb-4">
              <BrainCircuit className="w-5 h-5 text-primary" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">AI Status</h3>
            </div>

            <div className="flex justify-center mb-4">
              <ProgressRing
                value={currentConf}
                color={loadColors[loadLevel] || "#2563EB"}
                label={`${currentConf}%`}
                sublabel="Confidence"
                size={140}
              />
            </div>

            <LoadBadge level={loadLevel} className="mb-3" />

            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {loadDetails[loadLevel]?.desc || "Waiting for data…"}
            </p>

            <div className="grid grid-cols-3 gap-2 pt-4 border-t border-gray-100 dark:border-slate-800">
              <div>
                <Clock className="w-4 h-4 text-primary mx-auto mb-1" />
                <p className="text-xs font-semibold text-gray-900 dark:text-white">
                  {formatDuration(elapsed)}
                </p>
                <p className="text-[10px] text-gray-400">Tracked</p>
              </div>
              <div>
                <Activity className="w-4 h-4 text-accent mx-auto mb-1" />
                <p className="text-xs font-semibold text-gray-900 dark:text-white">{predictions}</p>
                <p className="text-[10px] text-gray-400">Predictions</p>
              </div>
              <div>
                <Sparkles className="w-4 h-4 text-warning mx-auto mb-1" />
                <p className="text-xs font-semibold text-gray-900 dark:text-white">
                  {lastUpdated
                    ? lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                    : "—"}
                </p>
                <p className="text-[10px] text-gray-400">Last update</p>
              </div>
            </div>
          </motion.div>

          {/* Session metrics */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.25 }}
            className="card p-5"
          >
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
              Session overview
            </h3>
            <div className="space-y-3">
              {[
                { icon: Keyboard,          label: "Typing events",  value: stats?.typing_events  ?? predictions + " preds" },
                { icon: MousePointerClick, label: "Mouse clicks",   value: stats?.mouse_events   ?? "—" },
                { icon: Cpu,              label: "Avg WPM",        value: stats?.avg_wpm        ?? "—" },
                { icon: BrainCircuit,     label: "Model version",  value: modelInfo?.version ? `v${modelInfo.version}` : "rule-based" },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center justify-between py-2
                  border-b border-gray-50 dark:border-slate-800/50 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-slate-800
                      flex items-center justify-center">
                      <Icon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    </div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">{value}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
