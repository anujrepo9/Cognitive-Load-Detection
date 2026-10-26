import { useState, useCallback } from "react"
import { useAuthFetch } from "../hooks/useAuthFetch"
import { motion } from "framer-motion"
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie,
  Cell, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend,
} from "recharts"
import {
  TrendingUp, PieChart as PieIcon,
  Loader2, AlertCircle, RefreshCw, Monitor, Clock,
} from "lucide-react"
import { analyticsAPI, appUsageAPI, getErrorMessage } from "../services/api"
import ChartCard from "../components/ui/ChartCard"
import EmptyState from "../components/ui/EmptyState"
import { SkeletonPage } from "../components/ui/Skeleton"

// ── Design tokens ─────────────────────────────────────────────────────────────
const LOAD_COLORS = { low: "#37D9A0", medium: "#FFB547", high: "#FF5364" }

const APP_COLORS = [
  "#00D9E8", "#37D9A0", "#FFB547", "#FF5364",
  "#A78BFA", "#60A5FA", "#34D399", "#F472B6",
]

const TOOLTIP_STYLE = {
  background:           "rgba(9,15,24,0.96)",
  border:               "1px solid rgba(0,217,232,0.22)",
  borderRadius:         10,
  fontSize:             12,
  color:                "#EAF2F8",
  boxShadow:            "0 8px 24px rgba(0,0,0,0.5), 0 0 12px rgba(0,217,232,0.06)",
  backdropFilter:       "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  padding:              "8px 12px",
  fontFamily:           "'Space Grotesk', 'Inter', system-ui",
}

const LABEL_STYLE = { color: "#8493A7", fontSize: 11, marginBottom: 2 }
const ITEM_CYAN   = { color: "#00D9E8", fontSize: 12, fontWeight: 600 }
const ITEM_GREEN  = { color: "#37D9A0", fontSize: 12, fontWeight: 600 }
const GRID_STROKE = "rgba(100,170,190,0.08)"
const TICK_STYLE  = { fontSize: 11, fill: "#536477", fontFamily: "'Space Grotesk', system-ui" }
const CURSOR_CYAN = { stroke: "#00D9E8", strokeOpacity: 0.25, strokeWidth: 1 }
const CARD_STYLE  = { background: "#0B1420", border: "1px solid rgba(100,170,190,0.14)", borderRadius: 14 }

const activeDot = (color) => ({ r: 5, fill: color, stroke: "#0B1420", strokeWidth: 2 })

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtSec(sec) {
  if (sec < 60)   return `${Math.round(sec)}s`
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${Math.round(sec % 60)}s`
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return `${h}h ${m}m`
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
  const step   = points.length / (maxPts - 1)
  const result = []
  for (let i = 0; i < maxPts; i++) {
    result.push(points[Math.min(Math.round(i * step), points.length - 1)])
  }
  return result.filter((p, i, arr) => i === 0 || p !== arr[i - 1])
}

function smartDomain([dMin, dMax]) {
  const pad = Math.max(5, Math.ceil((dMax - dMin) * 0.12))
  return [Math.max(0, dMin - pad), dMax + pad]
}

const RANGE_OPTIONS = [
  { label: "24h", value: 24  },
  { label: "7d",  value: 168 },
  { label: "30d", value: 720 },
]

// ── Custom Pie label ──────────────────────────────────────────────────────────
function PieLabel({ cx, cy, midAngle, outerRadius, percent, name }) {
  if (percent < 0.05) return null
  const RAD = Math.PI / 180
  const r   = outerRadius + 22
  const x   = cx + r * Math.cos(-midAngle * RAD)
  const y   = cy + r * Math.sin(-midAngle * RAD)
  return (
    <text x={x} y={y} fill={LOAD_COLORS[name] || "#8493A7"}
      textAnchor={x > cx ? "start" : "end"}
      dominantBaseline="central"
      style={{ fontSize: 11, fontWeight: 600, fontFamily: "'Space Grotesk', system-ui" }}>
      {name} {(percent * 100).toFixed(0)}%
    </text>
  )
}

// ── Range button style ────────────────────────────────────────────────────────
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

// ── App Usage section ─────────────────────────────────────────────────────────
function AppUsageSection({ hours }) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const fetch = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await appUsageAPI.summary(hours)
      setData(res)
    } catch (e) {
      setError(e?.message ?? "Failed to load app usage")
    } finally {
      setLoading(false)
    }
  }, [hours])

  useAuthFetch(fetch, [hours])

  const apps = data?.apps ?? []
  // Top app bar chart (horizontal) — all apps
  const barData = apps.slice(0, 10).map((a) => ({
    name:    a.process.replace(/\.exe$/i, ""),
    seconds: a.total_seconds,
    pct:     a.percentage,
  }))

  // Donut chart — top 6 + "Others"
  const donutSlices = (() => {
    if (apps.length === 0) return []
    const top = apps.slice(0, 6)
    const othersSeconds = apps.slice(6).reduce((s, a) => s + a.total_seconds, 0)
    const slices = top.map((a) => ({ name: a.process.replace(/\.exe$/i, ""), value: a.total_seconds }))
    if (othersSeconds > 0) slices.push({ name: "Others", value: othersSeconds })
    return slices
  })()

  const topApp = apps[0] ?? null

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.05 }}
      className="space-y-4"
    >
      {/* Section header */}
      <div className="flex items-center gap-2">
        <Monitor className="w-4 h-4" style={{ color: "#00D9E8" }} />
        <h2 className="text-sm font-semibold" style={{ color: "#EAF2F8" }}>App Usage</h2>
        <span className="text-[11px] px-2 py-0.5 rounded-full"
          style={{ background: "rgba(0,217,232,0.08)", color: "#00D9E8", border: "1px solid rgba(0,217,232,0.18)" }}>
          Last {hours}h
        </span>
      </div>

      {loading && (
        <div className="flex justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: "#00D9E8" }} />
        </div>
      )}

      {error && !loading && (
        <div className="rounded-xl px-4 py-3 text-sm flex items-center gap-2"
          style={{ background: "rgba(255,83,100,0.10)", border: "1px solid rgba(255,83,100,0.25)", color: "#FF5364" }}>
          <AlertCircle className="w-4 h-4 shrink-0" />{error}
        </div>
      )}

      {!loading && !error && apps.length === 0 && (
        <div className="rounded-xl p-6" style={CARD_STYLE}>
          <EmptyState icon={Monitor} title="No app usage data"
            description="Start the desktop collector to track which apps you use and for how long." />
        </div>
      )}

      {!loading && !error && apps.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* ── Left: Summary stats ── */}
          <div className="space-y-3">

            {/* Top app card */}
            <div className="rounded-xl p-4" style={CARD_STYLE}>
              <p className="text-[10px] font-semibold tracking-widest uppercase mb-2"
                style={{ color: "#536477" }}>Most used app</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: "rgba(0,217,232,0.10)", border: "1px solid rgba(0,217,232,0.20)" }}>
                  <Monitor className="w-5 h-5" style={{ color: "#00D9E8" }} />
                </div>
                <div>
                  <p className="text-[15px] font-bold" style={{ color: "#EAF2F8" }}>
                    {topApp.process.replace(/\.exe$/i, "")}
                  </p>
                  <p className="text-[12px]" style={{ color: "#00D9E8" }}>
                    {fmtSec(topApp.total_seconds)} &nbsp;·&nbsp; {topApp.percentage}%
                  </p>
                </div>
              </div>
            </div>

            {/* Total tracked */}
            <div className="rounded-xl p-4" style={CARD_STYLE}>
              <p className="text-[10px] font-semibold tracking-widest uppercase mb-2"
                style={{ color: "#536477" }}>Total tracked</p>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" style={{ color: "#FFB547" }} />
                <span className="text-[18px] font-bold" style={{ color: "#EAF2F8" }}>
                  {fmtSec(data.total_tracked)}
                </span>
              </div>
              <p className="text-[11px] mt-1" style={{ color: "#536477" }}>
                across {apps.length} app{apps.length !== 1 ? "s" : ""}
              </p>
            </div>

            {/* Donut */}
            <div className="rounded-xl p-4" style={CARD_STYLE}>
              <p className="text-[10px] font-semibold tracking-widest uppercase mb-2"
                style={{ color: "#536477" }}>Share</p>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={donutSlices}
                    dataKey="value"
                    cx="50%" cy="50%"
                    innerRadius={44} outerRadius={68}
                    paddingAngle={2}
                    strokeWidth={0}
                    isAnimationActive
                    animationDuration={700}
                    animationEasing="ease-out"
                  >
                    {donutSlices.map((_, i) => (
                      <Cell key={i} fill={APP_COLORS[i % APP_COLORS.length]} opacity={0.9} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    labelStyle={LABEL_STYLE}
                    formatter={(v, name) => [fmtSec(v), name]}
                    cursor={false}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── Right: Horizontal bar chart ── */}
          <div className="lg:col-span-2 rounded-xl p-5" style={CARD_STYLE}>
            <p className="text-[13px] font-semibold mb-1" style={{ color: "#EAF2F8" }}>
              Time per application
            </p>
            <p className="text-[11px] mb-4" style={{ color: "#536477" }}>
              Top {barData.length} apps by foreground time
            </p>
            <ResponsiveContainer width="100%" height={Math.max(220, barData.length * 32)}>
              <BarChart
                data={barData}
                layout="vertical"
                margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="0" stroke={GRID_STROKE} horizontal={false} />
                <XAxis
                  type="number"
                  tickFormatter={(v) => fmtSec(v)}
                  tick={TICK_STYLE}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={90}
                  tick={{ fontSize: 11, fill: "#8FA3B1", fontFamily: "'Space Grotesk', system-ui" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  labelStyle={LABEL_STYLE}
                  formatter={(v, _n, p) => [`${fmtSec(v)}  (${p.payload.pct}%)`, "Time in focus"]}
                  cursor={{ fill: "rgba(0,217,232,0.05)" }}
                />
                <Bar dataKey="seconds" radius={[0, 5, 5, 0]} barSize={16}
                  isAnimationActive animationDuration={600} animationEasing="ease-out">
                  {barData.map((_, i) => (
                    <Cell key={i} fill={APP_COLORS[i % APP_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

        </div>
      )}
    </motion.div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Analytics() {
  const [trends,  setTrends]  = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [hours,   setHours]   = useState(24)

  const load = useCallback((h) => {
    setLoading(true)
    setError(null)
    analyticsAPI.trends(h, 500)
      .then((res) => setTrends(res))
      .catch((err) => setError(getErrorMessage(err, "Could not load analytics trends.")))
      .finally(() => setLoading(false))
  }, [])

  useAuthFetch(() => { load(hours) }, [])

  const changeRange = (h) => { setHours(h); load(h) }

  // ── Derived data ─────────────────────────────────────────────────────────────
  const trendPoints    = trends?.points ?? []
  const rawDownsampled = downsample(trendPoints)

  const chartPoints = rawDownsampled.map((p) => ({
    time:  new Date(p.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    score: typeof p.confidence === "number" ? Math.round(p.confidence * 100) : null,
    wpm:   typeof p.wpm === "number" && p.wpm > 0 ? Math.round(p.wpm) : null,
    level: p.load_level ?? "unknown",
  }))

  const wpmPoints = chartPoints.filter((p) => p.wpm !== null)
  const pieData   = buildPieData(trendPoints)

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
        <>
          {/* ── App Usage ── */}
          <AppUsageSection hours={hours} />

          {/* ── Divider ── */}
          <div style={{ borderTop: "1px solid rgba(100,170,190,0.08)" }} />

          {/* ── Cognitive load charts ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* 1. Load distribution — Pie */}
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
                      dataKey="value" nameKey="name"
                      cx="50%" cy="50%"
                      outerRadius={90} innerRadius={52}
                      paddingAngle={3} strokeWidth={0}
                      labelLine={false} label={PieLabel}
                      isAnimationActive animationBegin={0}
                      animationDuration={700} animationEasing="ease-out">
                      {pieData.map((entry) => (
                        <Cell key={entry.name} fill={LOAD_COLORS[entry.name] || "#8493A7"} opacity={0.9} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={LABEL_STYLE}
                      formatter={(value, name) => [value, `${name} load`]} cursor={false} />
                    <Legend iconType="circle" iconSize={8}
                      wrapperStyle={{ fontSize: 12, color: "#8493A7", fontFamily: "'Space Grotesk', system-ui", paddingTop: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            {/* 2. Confidence trend — Area */}
            <ChartCard title="Model confidence over time" iconTone="primary"
              subtitle="Higher = model is more certain about its prediction"
              icon={TrendingUp}>
              {chartPoints.filter((p) => p.score !== null).length < 2 ? (
                <EmptyState icon={TrendingUp} title="Not enough data"
                  description="More sessions are needed to build a confidence trend." />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
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
                    <XAxis dataKey="time" tick={TICK_STYLE} axisLine={false} tickLine={false} dy={8}
                      interval={Math.max(0, Math.floor(chartPoints.length / 6) - 1)} />
                    <YAxis domain={[0, 100]} tick={TICK_STYLE} axisLine={false} tickLine={false}
                      tickFormatter={(v) => `${v}%`} width={40} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={LABEL_STYLE} itemStyle={ITEM_CYAN}
                      formatter={(v) => v !== null ? [`${v}%`, "Confidence"] : null}
                      cursor={CURSOR_CYAN} />
                    <Area type="monotone" dataKey="score"
                      stroke="#00D9E8" strokeWidth={2} fill="url(#confGradAnalytics)"
                      name="Confidence" connectNulls={false} dot={false}
                      activeDot={activeDot("#00D9E8")}
                      isAnimationActive animationDuration={600} animationEasing="ease-out" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            {/* 3. WPM trend — Area */}
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
                    <XAxis dataKey="time" tick={TICK_STYLE} axisLine={false} tickLine={false} dy={8}
                      interval={Math.max(0, Math.floor(wpmPoints.length / 6) - 1)} />
                    <YAxis domain={smartDomain} tick={TICK_STYLE} axisLine={false} tickLine={false}
                      tickFormatter={(v) => `${v}`} width={40} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={LABEL_STYLE} itemStyle={ITEM_GREEN}
                      formatter={(v) => v !== null ? [`${v} wpm`, "Typing speed"] : null}
                      cursor={CURSOR_CYAN} />
                    <Area type="monotone" dataKey="wpm"
                      stroke="#37D9A0" strokeWidth={2} fill="url(#wpmGradAnalytics)"
                      name="WPM" connectNulls={false} dot={false}
                      activeDot={activeDot("#37D9A0")}
                      isAnimationActive animationDuration={600} animationEasing="ease-out" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

          </div>
        </>
      )}
    </div>
  )
}
