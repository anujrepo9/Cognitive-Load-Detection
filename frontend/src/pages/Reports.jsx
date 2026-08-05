import { useState } from "react"
import { motion } from "framer-motion"
import {
  FileText, Download, Calendar, TrendingUp, Activity, BrainCircuit,
  MousePointerClick, Keyboard, Clock,
} from "lucide-react"
import { useAuth } from "../context/AuthContext"
import ChartCard from "../components/ui/ChartCard"
import ProgressRing from "../components/ui/ProgressRing"

const reports = [
  {
    id: 1, title: "Daily cognitive load summary", date: "Feb 18, 2025",
    avg: 42, total: "3h 24m", highlights: "Highest focus at 10 AM",
  },
  {
    id: 2, title: "Weekly focus analysis", date: "Week 7", avg: 55,
    total: "18h 45m", highlights: "Productive growth of 12%",
  },
  {
    id: 3, title: "Typing efficiency report", date: "Feb 17, 2025",
    avg: 68, total: "2h 10m", highlights: "Avg 52 WPM",
  },
]

export default function Reports() {
  const { user } = useAuth()
  const [active, setActive] = useState(reports[0])

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reports</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Detailed summaries of your cognitive performance
          </p>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl
          bg-primary text-white text-sm font-semibold hover:bg-primary-dark
          shadow-lg shadow-primary/20 transition-colors">
          <Download className="w-4 h-4" /> Export report
        </button>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Reports list */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white px-1">
            Available reports
          </h3>
          {reports.map((r) => (
            <motion.button key={r.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              onClick={() => setActive(r)}
              className={`w-full text-left p-4 rounded-xl border transition-all
                ${active.id === r.id
                  ? "border-primary/50 bg-primary/5 shadow-glow-primary"
                  : "border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-primary/30"}`}>
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center
                  ${active.id === r.id
                    ? "bg-primary/10 text-primary"
                    : "bg-gray-100 dark:bg-slate-800 text-gray-400"}`}>
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{r.title}</p>
                  <p className="text-xs text-gray-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> {r.date}
                  </p>
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{r.highlights}</p>
            </motion.button>
          ))}
        </div>

        {/* Report preview */}
        <motion.div
          key={active.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-2 card p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">{active.title}</h2>
              <p className="text-sm text-gray-400">Generated for {user?.name || "you"} · {active.date}</p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
              bg-primary/10 text-primary text-xs font-semibold">
              <TrendingUp className="w-3.5 h-3.5" /> {active.avg}% avg workload
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { icon: Activity, label: "Avg load", value: `${active.avg}%` },
              { icon: Clock, label: "Total time", value: active.total },
              { icon: Keyboard, label: "Avg WPM", value: "52" },
              { icon: MousePointerClick, label: "Clicks/day", value: "1.2k" },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="rounded-xl border border-gray-100 dark:border-slate-800
                p-4 text-center">
                <Icon className="w-5 h-5 text-primary mx-auto mb-2" />
                <p className="text-lg font-bold text-gray-900 dark:text-white">{value}</p>
                <p className="text-xs text-gray-400">{label}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="flex flex-col items-center">
              <ProgressRing value={active.avg} size={120}
                color="#2563EB" label={`${active.avg}%`} sublabel="Workload" />
              <BrainCircuit className="w-5 h-5 text-primary mt-3" />
            </div>
            <div className="flex-1 space-y-3">
              {[
                { label: "Focus efficiency", value: 78, color: "#10B981" },
                { label: "Fatigue risk", value: 32, color: "#F59E0B" },
                { label: "Stress level", value: 45, color: "#EF4444" },
              ].map(({ label, value, color }) => (
                <div key={label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-500 dark:text-gray-400">{label}</span>
                    <span className="font-medium text-gray-900 dark:text-white">{value}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 dark:bg-slate-800 overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${value}%` }}
                      transition={{ duration: 0.8 }} className="h-full rounded-full"
                      style={{ background: color }} />
                  </div>
                </div>
              ))}
              <p className="text-xs text-gray-400 bg-gray-50 dark:bg-slate-800/50
                rounded-lg px-3 py-2.5">
                💡 {active.highlights}
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
