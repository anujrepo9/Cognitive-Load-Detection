import { useState, useEffect, useRef, useCallback } from "react"
import { motion } from "framer-motion"
import {
  Radio, Cpu, Keyboard, MousePointerClick, Timer, Zap,
} from "lucide-react"
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts"
import { useBehaviorTracker } from "../hooks/useBehaviorTracker"
import { behaviorAPI } from "../services/api"
import StatCard from "../components/ui/StatCard"
import LoadBadge from "../components/ui/LoadBadge"

const POLL_MS = 5000

const LOAD_COLORS = { low: "#10B981", medium: "#F59E0B", high: "#EF4444" }

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s.toString().padStart(2, "0")}s`
}

export default function LiveMonitoring() {
  const { extractFeatures } = useBehaviorTracker(true)
  const [history, setHistory] = useState([])
  const [wpmHistory, setWpmHistory] = useState([])
  const [loadLevel, setLoadLevel] = useState("unknown")
  const [confidence, setConfidence] = useState(0)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [elapsed, setElapsed] = useState(0)
  const startRef = useRef(Date.now())

  useEffect(() => {
    const tick = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000)
    return () => clearInterval(tick)
  }, [])

  const poll = useCallback(async () => {
    const features = extractFeatures()
    if (!features) return
    try {
      const { data } = await behaviorAPI.predict(features)
      setLoadLevel(data.load_level)
      setConfidence(Math.round(data.confidence * 100))
      setLastUpdated(new Date())
      const time = new Date().toLocaleTimeString()
      setHistory((prev) => [...prev.slice(-29), { time, score: data.confidence * 100 }])
      setWpmHistory((prev) => [...prev.slice(-29), { time, wpm: features.wpm || 0 }])
    } catch { /* graceful */ }
  }, [extractFeatures])

  useEffect(() => {
    const i = setInterval(poll, POLL_MS)
    return () => clearInterval(i)
  }, [poll])

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Live Monitoring</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Real-time biometric and behavioral signals
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-gray-400">
              Last update: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
            bg-danger/10 text-danger text-xs font-semibold">
            <Radio className="w-3.5 h-3.5 animate-pulse" /> REC
          </span>
          <LoadBadge level={loadLevel} />
        </div>
      </motion.div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Confidence" value={confidence} unit="%" icon={Zap}
          accent="primary" sub="Model confidence score" />
        <StatCard label="Session time" value={formatDuration(elapsed)}
          icon={Timer} accent="accent" sub="Time tracked" />
        <StatCard label="Typing WPM" value={wpmHistory.length ? wpmHistory[wpmHistory.length - 1].wpm : "—"}
          icon={Keyboard} accent="success" sub="Live words per minute" />
        <StatCard label="Mouse events" value={history.length * 3}
          icon={MousePointerClick} accent="warning" sub="Clicks & movement" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Confidence live chart */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }} className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <Cpu className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Confidence stream</h3>
                <p className="text-xs text-gray-400">Live prediction confidence</p>
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={history}>
              <defs>
                <linearGradient id="liveGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563EB" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#2563EB" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" vertical={false} />
              <XAxis dataKey="time" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E2E8F0",
                borderRadius: 12, fontSize: 12, color: "#0F172A" }} />
              <Area type="monotone" dataKey="score" stroke="#2563EB" strokeWidth={2} fill="url(#liveGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* WPM chart */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }} className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-success/10 flex items-center justify-center">
                <Keyboard className="w-5 h-5 text-success" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Typing speed</h3>
                <p className="text-xs text-gray-400">Words per minute</p>
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={wpmHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" vertical={false} />
              <XAxis dataKey="time" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E2E8F0",
                borderRadius: 12, fontSize: 12, color: "#0F172A" }} />
              <Line type="monotone" dataKey="wpm" stroke="#10B981" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>
      </div>
    </div>
  )
}
