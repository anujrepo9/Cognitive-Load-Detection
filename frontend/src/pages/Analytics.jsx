import { useState, useEffect } from "react"
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts"
import { dashboardAPI } from "../services/api"

const COLORS = { low: "#22c55e", medium: "#f59e0b", high: "#ef4444" }

export default function Analytics() {
  const [data, setData] = useState(null)

  useEffect(() => {
    dashboardAPI.overview().then(({ data }) => setData(data)).catch(() => {})
  }, [])

  const pieData = data?.label_distribution
    ? Object.entries(data.label_distribution).map(([name, value]) => ({ name, value }))
    : []

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-xl font-semibold text-gray-100">Analytics</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Load distribution */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-sm font-medium text-gray-300 mb-4">Load distribution</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name"
                cx="50%" cy="50%" outerRadius={70} label>
                {pieData.map((entry) => (
                  <Cell key={entry.name} fill={COLORS[entry.name] || "#6b7280"} />
                ))}
              </Pie>
              <Legend wrapperStyle={{ fontSize: 12, color: "#9ca3af" }} />
              <Tooltip
                contentStyle={{ background: "#111827", border: "1px solid #374151",
                  borderRadius: 8, fontSize: 12 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Typing speed trend */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-sm font-medium text-gray-300 mb-4">Typing WPM trend</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data?.wpm_trend || []}>
              <XAxis dataKey="time" tick={{ fontSize: 11, fill: "#6b7280" }} />
              <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} />
              <Tooltip
                contentStyle={{ background: "#111827", border: "1px solid #374151",
                  borderRadius: 8, fontSize: 12 }}
              />
              <Line type="monotone" dataKey="wpm" stroke="#6C63FF"
                strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Feature importance */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 lg:col-span-2">
          <h3 className="text-sm font-medium text-gray-300 mb-4">
            Feature importance (from model)
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data?.feature_importance || []} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 11, fill: "#6b7280" }} />
              <YAxis dataKey="feature" type="category"
                tick={{ fontSize: 11, fill: "#9ca3af" }} width={130} />
              <Tooltip
                contentStyle={{ background: "#111827", border: "1px solid #374151",
                  borderRadius: 8, fontSize: 12 }}
              />
              <Bar dataKey="importance" fill="#6C63FF" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
