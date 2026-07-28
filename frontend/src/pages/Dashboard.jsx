import { useState, useEffect } from "react"
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"
import { useAuth } from "../context/AuthContext"
import { useBehaviorTracker } from "../hooks/useBehaviorTracker"
import { behaviorAPI, dashboardAPI } from "../services/api"
import StatCard from "../components/ui/StatCard"
import LoadBadge from "../components/ui/LoadBadge"

const POLL_MS = 6000

export default function Dashboard() {
  const { user } = useAuth()
  const { extractFeatures } = useBehaviorTracker(true)

  const [loadLevel, setLoadLevel] = useState("unknown")
  const [confidence, setConfidence] = useState(null)
  const [history, setHistory] = useState([])
  const [stats, setStats] = useState(null)

  // Poll for a live prediction every 6 s
  useEffect(() => {
    const poll = setInterval(async () => {
      const features = extractFeatures()
      if (!features) return
      try {
        const { data } = await behaviorAPI.predict(features)
        setLoadLevel(data.load_level)
        setConfidence(data.confidence)
        setHistory((prev) => [
          ...prev.slice(-29),
          { time: new Date().toLocaleTimeString(), level: data.load_level,
            score: data.confidence * 100 },
        ])
      } catch { /* backend not up yet — graceful */ }
    }, POLL_MS)
    return () => clearInterval(poll)
  }, [extractFeatures])

  // Fetch dashboard summary once
  useEffect(() => {
    dashboardAPI.overview().then(({ data }) => setStats(data)).catch(() => {})
  }, [])

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-100">
            Hello, {user?.name || "there"} 👋
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">Live cognitive load monitoring</p>
        </div>
        <LoadBadge level={loadLevel} className="text-sm px-3 py-1" />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Current load" value={loadLevel} sub="updated every 6 s" />
        <StatCard
          label="Confidence"
          value={confidence ? `${(confidence * 100).toFixed(0)}` : "—"}
          unit="%"
        />
        <StatCard label="Sessions today" value={stats?.sessions_today ?? "—"} />
        <StatCard label="Avg load today" value={stats?.avg_load ?? "—"} />
      </div>

      {/* Live chart */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-sm font-medium text-gray-300 mb-4">
          Confidence over time
        </h3>
        {history.length === 0 ? (
          <p className="text-sm text-gray-600 py-8 text-center">
            Start typing to see live data…
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={history}>
              <XAxis dataKey="time" tick={{ fontSize: 11, fill: "#6b7280" }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#6b7280" }} />
              <Tooltip
                contentStyle={{ background: "#111827", border: "1px solid #374151",
                  borderRadius: 8, fontSize: 12 }}
              />
              <Line
                type="monotone" dataKey="score" stroke="#6C63FF"
                strokeWidth={2} dot={false} name="Confidence %"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
