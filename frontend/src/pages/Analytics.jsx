import { useState, useEffect, useCallback } from "react"
import { motion } from "framer-motion"
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie,
  Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts"
import { BarChart3, TrendingUp, PieChart as PieIcon, Loader2, AlertCircle, RefreshCw } from "lucide-react"
import { analyticsAPI, getErrorMessage } from "../services/api"
import ChartCard from "../components/ui/ChartCard"
import EmptyState from "../components/ui/EmptyState"
import { SkeletonPage } from "../components/ui/Skeleton"

const LOAD_COLORS = { low: "#10B981", medium: "#F59E0B", high: "#EF4444" }

const tooltipStyle = {
  background: "var(--tw-bg, #fff)",
  border: "1px solid #E2E8F0",
  borderRadius: 12,
  fontSize: 12,
  color: "#0F172A",
}

function buildPieData(points) {
  const counts = { low: 0, medium: 0, high: 0 }
  points.forEach((p) => { if (counts[p.load_level] != null) counts[p.load_level]++ })
  return Object.entries(counts)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }))
}

function downsample(points, maxPts = 60) {
  if (points.length <= maxPts) return points
  const step = Math.ceil(points.length / maxPts)
  return points.filter((_, i) => i % step === 0)
}

const RANGE_OPTIONS = [
  { label: "24h", value: 24  },
  { label: "7d",  value: 168 },
  { label: "30d", value: 720 },
]

export default function Analytics() {
  const [trends,   setTrends]   = useState(null)
  const [features, setFeatures] = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)
  const [hours,    setHours]    = useState(24)

  const load = useCallback((h) => {
    setLoading(true)
    setError(null)
    Promise.allSettled([analyticsAPI.trends(h, 500), analyticsAPI.features()])
      .then(([tRes, fRes]) => {
        if (tRes.status === "fulfilled") {
          setTrends(tRes.value.data)
        } else {
          setError(getErrorMessage(tRes.reason, "Could not load analytics trends."))
        }
        if (fRes.status === "fulfilled") {
          setFeatures(fRes.value.data)
        }
        // features endpoint failing is non-fatal — charts still render without it
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load(hours) }, [])  // eslint-disable-line

  const changeRange = (h) => { setHours(h); load(h) }

  const trendPoints = trends?.points ?? []
  const chartPoints = downsample(trendPoints).map((p) => ({
    time:  new Date(p.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    score: Math.round(p.confidence * 100),
    wpm:   p.wpm ?? 0,
    level: p.load_level,
  }))
  const pieData = buildPieData(trendPoints)

  const featureVariability = features?.stats
    ?.map((s) => ({
      feature:    s.feature.replace(/_/g, " "),
      importance: parseFloat(s.std.toFixed(3)),
    }))
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 10) ?? []

  if (loading && !trends) return <SkeletonPage />

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Deep insights into your cognitive performance patterns
          </p>
        </div>

        <div className="flex items-center gap-2" role="group" aria-label="Time range">
          {RANGE_OPTIONS.map(({ label, value }) => (
            <button key={value}
              onClick={() => changeRange(value)}
              aria-pressed={hours === value}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all
                ${hours === value
                  ? "bg-primary text-white shadow-glow-primary"
                  : "bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-700"}`}>
              {label}
            </button>
          ))}
          <button onClick={() => load(hours)}
            aria-label="Refresh analytics"
            className="p-2 rounded-xl bg-gray-100 dark:bg-slate-800 text-gray-500
              hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </motion.div>

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-xl bg-red-50
          dark:bg-red-900/20 border border-red-200 dark:border-red-800
          px-4 py-3 text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-8" aria-live="polite" aria-label="Loading">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Load distribution pie */}
          <ChartCard title="Load distribution" subtitle="Proportion of each cognitive load level" icon={PieIcon}>
            {pieData.length === 0 ? (
              <EmptyState icon={PieIcon} title="No data yet"
                description="Start a tracking session to see your load distribution." />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name"
                    cx="50%" cy="50%" outerRadius={90} innerRadius={55}
                    paddingAngle={3}
                    label={({ percent, name }) => `${name}: ${(percent * 100).toFixed(0)}%`}>
                    {pieData.map((entry) => (
                      <Cell key={entry.name} fill={LOAD_COLORS[entry.name] || "#94A3B8"} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle}
                    formatter={(value, name) => [value, `${name} load`]} />
                  <Legend wrapperStyle={{ fontSize: 12, color: "#94A3B8" }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          {/* Confidence trend */}
          <ChartCard title="Model confidence over time"
            subtitle="Higher confidence means the model is more certain of the prediction" icon={TrendingUp}>
            {chartPoints.length < 2 ? (
              <EmptyState icon={TrendingUp} title="Not enough data"
                description="More sessions are needed to build a confidence trend." />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={chartPoints}>
                  <defs>
                    <linearGradient id="confGrad2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563EB" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#2563EB" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" vertical={false} />
                  <XAxis dataKey="time" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#94A3B8" }}
                    axisLine={false} tickLine={false}
                    tickFormatter={(v) => `${v}%`} />
                  <Tooltip contentStyle={tooltipStyle}
                    formatter={(v) => [`${v}%`, "Confidence"]} />
                  <Area type="monotone" dataKey="score" stroke="#2563EB" strokeWidth={2}
                    fill="url(#confGrad2)" name="Confidence" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          {/* WPM trend */}
          <ChartCard title="Typing speed over time"
            subtitle="Words per minute — lower WPM may correlate with higher cognitive load" icon={TrendingUp}>
            {chartPoints.filter((p) => p.wpm > 0).length < 2 ? (
              <EmptyState icon={TrendingUp} title="No WPM data yet"
                description="Keep typing during sessions to see your WPM trend." />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={chartPoints}>
                  <defs>
                    <linearGradient id="wpmGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10B981" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" vertical={false} />
                  <XAxis dataKey="time" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false}
                    tickFormatter={(v) => `${v} wpm`} />
                  <Tooltip contentStyle={tooltipStyle}
                    formatter={(v) => [`${v} wpm`, "Typing speed"]} />
                  <Area type="monotone" dataKey="wpm" stroke="#10B981" strokeWidth={2}
                    fill="url(#wpmGrad)" name="WPM" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          {/* Feature variability */}
          <ChartCard title="Feature variability"
            subtitle="Standard deviation per feature — higher variability means more discriminative signal"
            icon={BarChart3}>
            {featureVariability.length === 0 ? (
              <EmptyState icon={BarChart3} title="No feature data yet"
                description="Collect more sessions for feature analysis." />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={featureVariability} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="feature" type="category" width={135}
                    tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle}
                    formatter={(v) => [v, "Std deviation"]} />
                  <Bar dataKey="importance" fill="#2563EB" radius={[0, 8, 8, 0]} barSize={16}
                    name="Std deviation" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>
      )}

      {/* Raw stats table */}
      {features && features.total_records > 0 && !loading && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className="card p-5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
            Feature statistics
          </h3>
          <p className="text-xs text-gray-400 mb-4">
            Computed across {features.total_records.toLocaleString()} behavior records
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs" aria-label="Feature statistics">
              <thead>
                <tr className="border-b border-gray-100 dark:border-slate-800">
                  {["Feature", "Mean", "Std dev", "Min", "Max"].map((h) => (
                    <th key={h} scope="col"
                      className="text-left py-2 px-3 font-medium text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {features.stats.map((s) => (
                  <tr key={s.feature}
                    className="border-b border-gray-50 dark:border-slate-800/50
                      hover:bg-gray-50 dark:hover:bg-slate-800/40">
                    <td className="py-2 px-3 font-mono text-gray-700 dark:text-gray-300">{s.feature}</td>
                    <td className="py-2 px-3 text-gray-600 dark:text-gray-400">{s.mean}</td>
                    <td className="py-2 px-3 text-gray-600 dark:text-gray-400">{s.std}</td>
                    <td className="py-2 px-3 text-gray-600 dark:text-gray-400">{s.min}</td>
                    <td className="py-2 px-3 text-gray-600 dark:text-gray-400">{s.max}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </div>
  )
}
