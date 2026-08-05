import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie,
  Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts"
import { BarChart3, TrendingUp, PieChart as PieIcon } from "lucide-react"
import { dashboardAPI } from "../services/api"
import ChartCard from "../components/ui/ChartCard"
import { SkeletonPage } from "../components/ui/Skeleton"

const LOAD_COLORS = { low: "#10B981", medium: "#F59E0B", high: "#EF4444" }

const tooltipStyle = {
  background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12,
  fontSize: 12, color: "#0F172A",
}

export default function Analytics() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    dashboardAPI.overview()
      .then(({ data }) => setData(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const pieData = data?.label_distribution
    ? Object.entries(data.label_distribution).map(([name, value]) => ({ name, value }))
    : []

  if (loading) return <SkeletonPage />

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Deep insights into your cognitive performance
        </p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Load distribution pie */}
        <ChartCard title="Load distribution" subtitle="Proportion of each load level"
          icon={PieIcon}>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name"
                cx="50%" cy="50%" outerRadius={90} innerRadius={55}
                paddingAngle={3} label={({ percent }) => `${(percent * 100).toFixed(0)}%`}>
                {pieData.map((entry) => (
                  <Cell key={entry.name} fill={LOAD_COLORS[entry.name] || "#94A3B8"} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12, color: "#94A3B8" }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Typing WPM trend */}
        <ChartCard title="Typing WPM trend" subtitle="Words per minute over time"
          icon={TrendingUp}>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={data?.wpm_trend || []}>
              <defs>
                <linearGradient id="wpmGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10B981" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" vertical={false} />
              <XAxis dataKey="time" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="wpm" stroke="#10B981" strokeWidth={2} fill="url(#wpmGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Feature importance */}
        <ChartCard title="Feature importance" subtitle="From the ML model"
          icon={BarChart3} className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data?.feature_importance || []} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
              <YAxis dataKey="feature" type="category" width={140}
                tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="importance" fill="#2563EB" radius={[0, 8, 8, 0]} barSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  )
}
