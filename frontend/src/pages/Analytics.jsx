import { useState, useCallback } from "react"
import { useAuthFetch } from "../hooks/useAuthFetch"
import { motion } from "framer-motion"
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie,
  Cell, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend,
} from "recharts"
import {
  BarChart3, TrendingUp, PieChart as PieIcon,
  Loader2, AlertCircle, RefreshCw,
} from "lucide-react"
import { analyticsAPI, getErrorMessage } from "../services/api"
import ChartCard from "../components/ui/ChartCard"
import EmptyState from "../components/ui/EmptyState"
import { SkeletonPage } from "../components/ui/Skeleton"

// ── Design tokens ────────────────────────────────────────────────────────────
const LOAD_COLORS = { low: "#37D9A0", medium: "#FFB547", high: "#FF5364" }

const TOOLTIP_STYLE = {
  background:         "rgba(9,15,24,0.96)",
  border:             "1px solid rgba(0,217,232,0.22)",
  borderRadius:       10,
  fontSize:           12,
  color:              "#EAF2F8",
  boxShadow:          "0 8px 24px rgba(0,0,0,0.5), 0 0 12px rgba(0,217,232,0.06)",
  backdropFilter:     "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  padding:            "8px 12px",
  fontFamily:         "'Space Grotesk', 'Inter', system-ui",
}

const LABEL_STYLE  = { color: "#8493A7", fontSize: 11, marginBottom: 2 }
const ITEM_CYAN    = { color: "#00D9E8", fontSize: 12, fontWeight: 600 }
const ITEM_GREEN   = { color: "#37D9A0", fontSize: 12, fontWeight: 600 }
const ITEM_VIOLET  = { color: "#7775FF", fontSize: 12, fontWeight: 600 }
const GRID_STROKE  = "rgba(100,170,190,0.08)"
const TICK_STYLE   = { fontSize: 11, fill: "#536477", fontFamily: "'Space Grotesk', system-ui" }
const CURSOR_CYAN  = { stroke: "#00D9E8", strokeOpacity: 0.25, strokeWidth: 1 }

// Shared active dot factory — ensures the dot always renders on hover
const activeDot = (color) => ({ r: 5, fill: color, stroke: "#0B1420", strokeWidth: 2 })

// ── Helpers ──────────────────────────────────────────────────────────────────
function buildPieData(points) {
  const counts = { low: 0, medium: 0, high: 0 }
  points.forEach((p) => { if (counts[p.load_level] != null) counts[p.load_level]++ })
  return Object.entries(counts)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }))
}

// Adaptive downsample — keeps at most maxPts evenly-spaced points
// but always keeps the FIRST and LAST point so the line anchors properly
function downsample(points, maxPts = 60) {
  if (points.length <= maxPts) return points
  const step   = points.length / (maxPts - 1)
  const result = []
  for (let i = 0; i < maxPts; i++) {
    result.push(points[Math.min(Math.round(i * step), points.length - 1)])
  }
  // Deduplicate in case rounding created duplicates
  return result.filter((p, i, arr) => i === 0 || p !== arr[i - 1])
}

// Y-axis domain helper — adds 10 % padding top + bottom, never below 0
function smartDomain([dMin, dMax]) {
  const pad = Math.max(5, Math.ceil((dMax - dMin) * 0.12))
  return [Math.max(0, dMin - pad), dMax + pad]
}

const RANGE_OPTIONS = [
  { label: "24h", value: 24  },
  { label: "7d",  value: 168 },
  { label: "30d", value: 720 },
]

// ── Custom Pie label ─────────────────────────────────────────────────────────
function PieLabel({ cx, cy, midAngle, outerRadius, percent, name }) {
  if (percent < 0.05) return null // hide tiny slices
  const RAD  = Math.PI / 180
  const r    = outerRadius + 22
  const x    = cx + r * Math.cos(-midAngle * RAD)
  const y    = cy + r * Math.sin(-midAngle * RAD)
  return (
    <text x={x} y={y} fill={LOAD_COLORS[name] || "#8493A7"}
      textAnchor={x > cx ? "start" : "end"}
      dominantBaseline="central"
      style={{ fontSize: 11, fontWeight: 600, fontFamily: "'Space Grotesk', system-ui" }}>
      {name} {(percent * 100).toFixed(0)}%
    </text>
  )
}

// ── Range button style ───────────────────────────────────────────────────────
const rangeBtnStyle = (active) => ({
  padding:      "0.375rem 0.875rem",
  borderRadius: 9999,
  fontSize:     "0.8125rem",
  fontWeight:   active ? 600 : 500,
  cursor:       "pointer",
  transition:   "all 0.15s ease",
  background:   active ? "rgba(0,217,232,0.12)" : "rgba(100,170,190,0.06)",
  color:        active ? "#00D9E8" : "#536477",
  border:       active ? "1px solid rgba(0,217,232,0.30)" : "1px solid rgba(100,170,190,0.12)",
  boxShadow:    active ? "0 0 10px rgba(0,217,232,0.18)" : "none",
})

// ── Section card wrapper ─────────────────────────────────────────────────────
const CARD_STYLE = {
  background:   "#0B1420",
  border:       "1px solid rgba(100,170,190,0.14)",
  borderRadius: 14,
}

// ── Main component ───────────────────────────────────────────────────────────
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
          setTrends(tRes.value)
        } else {
          setError(getErrorMessage(tRes.reason, "Could not load analytics trends."))
        }
        if (fRes.status === "fulfilled") setFeatures(fRes.value)
      })
      .finally(() => setLoading(false))
  }, [])

  useAuthFetch(() => { load(hours) }, [])

  const changeRange = (h) => { setHours(h); load(h) }

  // ── Derived data ────────────────────────────────────────────────────────────
  const trendPoints  = trends?.points ?? []
  const rawDownsampled = downsample(trendPoints)

  // Build chart points — ensure every point has a valid numeric value
  // null/undefined values cause Recharts to drop the dot and break the line
  const chartPoints = rawDownsampled.map((p) => ({
    time:  new Date(p.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    score: typeof p.confidence === "number" ? Math.round(p.confidence * 100) : null,
    wpm:   typeof p.wpm === "number" && p.wpm > 0 ? Math.round(p.wpm) : null,
    level: p.load_level ?? "unknown",
  }))

  // Separate valid WPM points so the chart only gets clean data
  const wpmPoints = chartPoints.filter((p) => p.wpm !== null)

  const pieData = buildPieData(trendPoints)

  const featureVariability = features?.stats
    ?.map((s) => ({
      feature:    s.feature.replace(/_/g, " "),
      importance: parseFloat(parseFloat(s.std).toFixed(3)),
    }))
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 10) ?? []

  if (loading && !trends) return <SkeletonPage />

  return (
    <div className="p-4 lg:p-6 space-y-6">

      {/* ── Page header ── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="live-dot w-1.5 h-1.5 rounded-full" style={{ background: "#00D9E8" }} />
            <span className="text-[10px] font-semibold tracking-[0.10em] uppercase" style={{ color: "#536477" }}>
              Insights
            </span>
          </div>
          <h1 style={{ color: "#EAF2F8" }}>Analytics</h1>
          <p className="text-sm mt-1" style={{ color: "#8493A7" }}>
            Deep insights into your cognitive performance patterns
          </p>
        </div>

        {/* Range + refresh */}
        <div className="flex items-center gap-2" role="group" aria-label="Time range">
          {RANGE_OPTIONS.map(({ label, value }) => (
            <button key={value}
              onClick={() => changeRange(value)}
              aria-pressed={hours === value}
              style={rangeBtnStyle(hours === value)}>
              {label}
            </button>
          ))}
          <button onClick={() => load(hours)} aria-label="Refresh analytics"
            className="p-2 rounded-full transition-all"
            style={{ background: "rgba(100,170,190,0.06)", border: "1px solid rgba(100,170,190,0.12)", color: "#536477" }}
            onMouseEnter={e => { e.currentTarget.style.color = "#00D9E8"; e.currentTarget.style.borderColor = "rgba(0,217,232,0.25)" }}
            onMouseLeave={e => { e.currentTarget.style.color = "#536477"; e.currentTarget.style.borderColor = "rgba(100,170,190,0.12)" }}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </motion.div>

      {/* Error */}
      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm"
          style={{ background: "rgba(255,83,100,0.10)", border: "1px solid rgba(255,83,100,0.25)", color: "#FF5364" }}>
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Loading overlay */}
      {loading && (
        <div className="flex justify-center py-8" aria-live="polite">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#00D9E8" }} />
        </div>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ── 1. Load distribution — Pie ── */}
          <ChartCard title="Load distribution" iconTone="success"
            subtitle="Proportion of each cognitive load level this period"
            icon={PieIcon}>
            {pieData.length === 0 ? (
              <EmptyState icon={PieIcon} title="No data yet"
                description="Start a tracking session to see your load distribution." />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart margin={{ top: 16, right: 16, bottom: 16, left: 16 }}>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    innerRadius={52}
                    paddingAngle={3}
                    strokeWidth={0}
                    // Custom label keeps labels outside the ring cleanly
                    labelLine={false}
                    label={PieLabel}
                    // isAnimationActive must be true for the arc to fill correctly on first render
                    isAnimationActive={true}
                    animationBegin={0}
                    animationDuration={700}
                    animationEasing="ease-out">
                    {pieData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={LOAD_COLORS[entry.name] || "#8493A7"}
                        opacity={0.9}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    labelStyle={LABEL_STYLE}
                    formatter={(value, name) => [value, `${name} load`]}
                    cursor={false}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{
                      fontSize: 12,
                      color: "#8493A7",
                      fontFamily: "'Space Grotesk', system-ui",
                      paddingTop: 8,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          {/* ── 2. Confidence trend — Area ── */}
          <ChartCard title="Model confidence over time" iconTone="primary"
            subtitle="Higher = model is more certain about its prediction"
            icon={TrendingUp}>
            {chartPoints.filter((p) => p.score !== null).length < 2 ? (
              <EmptyState icon={TrendingUp} title="Not enough data"
                description="More sessions are needed to build a confidence trend." />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                {/*
                  KEY FIX: We pass a stable `key` to AreaChart so React fully
                  remounts the chart when the data range changes. Without this,
                  Recharts keeps internal cursor state from the old dataset and
                  the active dot gets stuck at an outdated index.
                */}
                <AreaChart
                  key={`conf-${hours}-${chartPoints.length}`}
                  data={chartPoints}
                  margin={{ top: 6, right: 8, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="confGradAnalytics" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#00D9E8" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#00D9E8" stopOpacity={0}    />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="0" stroke={GRID_STROKE} vertical={false} />
                  <XAxis
                    dataKey="time"
                    tick={TICK_STYLE}
                    axisLine={false}
                    tickLine={false}
                    dy={8}
                    // Show at most 6 ticks so they don't crowd each other
                    interval={Math.max(0, Math.floor(chartPoints.length / 6) - 1)}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={TICK_STYLE}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${v}%`}
                    width={40}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    labelStyle={LABEL_STYLE}
                    itemStyle={ITEM_CYAN}
                    formatter={(v) => v !== null ? [`${v}%`, "Confidence"] : null}
                    cursor={CURSOR_CYAN}
                  />
                  <Area
                    type="monotone"
                    dataKey="score"
                    stroke="#00D9E8"
                    strokeWidth={2}
                    fill="url(#confGradAnalytics)"
                    name="Confidence"
                    // connectNulls=false so gaps in data show as breaks, not interpolated lines
                    connectNulls={false}
                    // dot=false hides the static dots; the activeDot handles hover
                    dot={false}
                    activeDot={activeDot("#00D9E8")}
                    isAnimationActive={true}
                    animationDuration={600}
                    animationEasing="ease-out"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          {/* ── 3. WPM trend — Area ── */}
          <ChartCard title="Typing speed over time" iconTone="success"
            subtitle="Words per minute — lower WPM may correlate with higher cognitive load"
            icon={TrendingUp}>
            {wpmPoints.length < 2 ? (
              <EmptyState icon={TrendingUp} title="No WPM data yet"
                description="Keep typing during sessions to see your speed trend." />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart
                  key={`wpm-${hours}-${wpmPoints.length}`}
                  data={wpmPoints}
                  margin={{ top: 6, right: 8, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="wpmGradAnalytics" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#37D9A0" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#37D9A0" stopOpacity={0}    />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="0" stroke={GRID_STROKE} vertical={false} />
                  <XAxis
                    dataKey="time"
                    tick={TICK_STYLE}
                    axisLine={false}
                    tickLine={false}
                    dy={8}
                    interval={Math.max(0, Math.floor(wpmPoints.length / 6) - 1)}
                  />
                  <YAxis
                    domain={smartDomain}
                    tick={TICK_STYLE}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${v}`}
                    width={40}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    labelStyle={LABEL_STYLE}
                    itemStyle={ITEM_GREEN}
                    formatter={(v) => v !== null ? [`${v} wpm`, "Typing speed"] : null}
                    cursor={CURSOR_CYAN}
                  />
                  <Area
                    type="monotone"
                    dataKey="wpm"
                    stroke="#37D9A0"
                    strokeWidth={2}
                    fill="url(#wpmGradAnalytics)"
                    name="WPM"
                    connectNulls={false}
                    dot={false}
                    activeDot={activeDot("#37D9A0")}
                    isAnimationActive={true}
                    animationDuration={600}
                    animationEasing="ease-out"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          {/* ── 4. Feature variability — Horizontal Bar ── */}
          <ChartCard title="Feature variability" iconTone="accent"
            subtitle="Standard deviation per signal — higher means more discriminative"
            icon={BarChart3}>
            {featureVariability.length === 0 ? (
              <EmptyState icon={BarChart3} title="No feature data yet"
                description="Collect more sessions for feature analysis." />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  key={`feat-${hours}-${featureVariability.length}`}
                  data={featureVariability}
                  layout="vertical"
                  margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="0" stroke={GRID_STROKE} horizontal={false} />
                  <XAxis
                    type="number"
                    tick={TICK_STYLE}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    dataKey="feature"
                    type="category"
                    width={130}
                    tick={{ fontSize: 11, fill: "#8493A7", fontFamily: "'Space Grotesk', system-ui" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    labelStyle={LABEL_STYLE}
                    itemStyle={ITEM_VIOLET}
                    formatter={(v) => [v, "Std deviation"]}
                    cursor={{ fill: "rgba(119,117,255,0.06)" }}
                  />
                  <Bar
                    dataKey="importance"
                    radius={[0, 6, 6, 0]}
                    barSize={14}
                    name="Std deviation"
                    isAnimationActive={true}
                    animationDuration={600}
                    animationEasing="ease-out">
                    {featureVariability.map((entry, index) => (
                      // Gradient colour based on rank — top features get cyan, lower get violet
                      <Cell
                        key={`cell-${index}`}
                        fill={index < 3 ? "#00D9E8" : index < 6 ? "#7775FF" : "#536477"}
                        opacity={1 - index * 0.055}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

        </div>
      )}

      {/* ── Feature stats table ── */}
      {features && features.total_records > 0 && !loading && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-xl p-5"
          style={CARD_STYLE}>
          <h3 className="text-sm font-semibold mb-0.5" style={{ color: "#EAF2F8" }}>
            Feature statistics
          </h3>
          <p className="text-xs mb-4" style={{ color: "#536477" }}>
            Computed across {features.total_records.toLocaleString()} behavior records
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs" aria-label="Feature statistics">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(100,170,190,0.10)" }}>
                  {["Feature", "Mean", "Std dev", "Min", "Max"].map((h) => (
                    <th key={h} scope="col"
                      className="text-left py-2 px-3 font-semibold tracking-wide"
                      style={{ color: "#536477" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {features.stats.map((s, i) => (
                  <tr key={s.feature}
                    style={{ borderBottom: "1px solid rgba(100,170,190,0.06)" }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(0,217,232,0.03)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <td className="py-2 px-3 font-mono" style={{ color: "#00D9E8", fontSize: 11 }}>
                      {s.feature}
                    </td>
                    <td className="py-2 px-3 nums" style={{ color: "#EAF2F8" }}>{s.mean}</td>
                    <td className="py-2 px-3 nums" style={{ color: "#8493A7" }}>{s.std}</td>
                    <td className="py-2 px-3 nums" style={{ color: "#8493A7" }}>{s.min}</td>
                    <td className="py-2 px-3 nums" style={{ color: "#8493A7" }}>{s.max}</td>
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