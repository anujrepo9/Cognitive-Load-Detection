/**
 * AppUsagePanel.jsx
 * Shows per-app foreground time for the selected lookback window.
 *
 * Usage — drop into Dashboard or any page:
 *   import AppUsagePanel from "../components/AppUsagePanel"
 *   <AppUsagePanel hours={24} />
 */

import { useState, useEffect } from "react"
import { appUsageAPI } from "../services/api"
import { Monitor, Clock, RefreshCw } from "lucide-react"
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts"
import { motion } from "framer-motion"

// Colour palette — cycles for bars
const COLORS = [
  "#00D9E8", "#37D9A0", "#FFB547", "#FF5364",
  "#A78BFA", "#60A5FA", "#34D399", "#F472B6",
]

function fmtSeconds(sec) {
  if (sec < 60)   return `${Math.round(sec)}s`
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${Math.round(sec % 60)}s`
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return `${h}h ${m}m`
}

const cardStyle = {
  background:             "rgba(9,15,24,0.80)",
  border:                 "1px solid rgba(0,217,232,0.14)",
  borderRadius:           16,
  backdropFilter:         "blur(20px)",
  WebkitBackdropFilter:   "blur(20px)",
}

const tooltipStyle = {
  background:   "rgba(9,15,24,0.95)",
  border:       "1px solid rgba(0,217,232,0.22)",
  borderRadius: 10,
  fontSize:     12,
  color:        "#EAF2F8",
  padding:      "8px 12px",
}

export default function AppUsagePanel({ hours = 24 }) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await appUsageAPI.summary(hours)
      setData(res)
    } catch (e) {
      setError(e?.message ?? "Failed to load app usage")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [hours])

  // Top 10 apps for the chart
  const chartData = (data?.apps ?? []).slice(0, 10).map((app) => ({
    name:    app.process.replace(/\.exe$/i, ""),
    seconds: app.total_seconds,
    pct:     app.percentage,
  }))

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      style={cardStyle}
      className="p-5 space-y-4"
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Monitor className="w-4 h-4" style={{ color: "#00D9E8" }} />
          <span className="text-sm font-semibold tracking-wide" style={{ color: "#EAF2F8" }}>
            App Usage
          </span>
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: "rgba(0,217,232,0.10)", color: "#00D9E8" }}
          >
            Last {hours}h
          </span>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="p-1.5 rounded-lg transition-colors"
          style={{ color: "#536477" }}
          title="Refresh"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div className="h-32 flex items-center justify-center">
          <div
            className="w-6 h-6 border-2 rounded-full animate-spin"
            style={{ borderColor: "#00D9E8", borderTopColor: "transparent" }}
          />
        </div>
      )}

      {/* ── Error ── */}
      {error && !loading && (
        <p className="text-xs text-center py-4" style={{ color: "#FF5364" }}>
          {error}
        </p>
      )}

      {/* ── Empty ── */}
      {!loading && !error && chartData.length === 0 && (
        <p className="text-xs text-center py-6" style={{ color: "#536477" }}>
          No app usage data yet — start tracking to see results.
        </p>
      )}

      {/* ── Chart + summary ── */}
      {!loading && !error && chartData.length > 0 && (
        <>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
            >
              <XAxis
                type="number"
                tickFormatter={(v) => fmtSeconds(v)}
                tick={{ fill: "#536477", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={84}
                tick={{ fill: "#8FA3B1", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(val, _name, props) => [
                  `${fmtSeconds(val)}  (${props.payload.pct}%)`,
                  "Time in focus",
                ]}
                cursor={{ fill: "rgba(0,217,232,0.05)" }}
              />
              <Bar dataKey="seconds" radius={[0, 4, 4, 0]}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Summary footer */}
          <div className="flex items-center gap-1.5 pt-1" style={{ color: "#536477" }}>
            <Clock className="w-3 h-3" />
            <span className="text-xs">
              Total tracked:{" "}
              <span style={{ color: "#EAF2F8" }}>{fmtSeconds(data.total_tracked)}</span>
              {" "}across{" "}
              <span style={{ color: "#EAF2F8" }}>{data.apps.length}</span> app
              {data.apps.length !== 1 ? "s" : ""}
            </span>
          </div>
        </>
      )}
    </motion.div>
  )
}