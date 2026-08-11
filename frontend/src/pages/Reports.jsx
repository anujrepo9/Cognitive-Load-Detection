import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import {
  FileText, Download, Calendar, TrendingUp, Activity,
  Loader2, AlertCircle,
} from "lucide-react"
import { useAuth } from "../context/AuthContext"
import { reportsAPI } from "../services/api"
import ProgressRing from "../components/ui/ProgressRing"

const LOAD_COLOR = { low: "text-green-500", medium: "text-yellow-500", high: "text-red-500" }

function LoadBadge({ level }) {
  const color = { low: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
                  medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
                  high: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" }
  return (
    <span className={`px-2 py-0.5 rounded-md text-xs font-semibold capitalize ${color[level] || color.medium}`}>
      {level || "—"}
    </span>
  )
}

function DailyTab({ days }) {
  if (!days.length) return (
    <p className="text-sm text-gray-400 text-center py-8">No data yet for this period.</p>
  )
  return (
    <div className="space-y-3">
      {days.map((d) => (
        <div key={d.date} className="card p-4 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 min-w-[110px]">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{d.date}</span>
          </div>
          <div className="flex gap-4 flex-1 flex-wrap text-sm text-gray-500 dark:text-gray-400">
            <span><strong className="text-gray-800 dark:text-gray-200">{d.sessions}</strong> sessions</span>
            <span><strong className="text-gray-800 dark:text-gray-200">{d.predictions}</strong> predictions</span>
            <span><strong className="text-gray-800 dark:text-gray-200">{d.avg_wpm}</strong> avg WPM</span>
          </div>
          {d.dominant_load && <LoadBadge level={d.dominant_load} />}
          <div className="flex gap-2 text-xs">
            {Object.entries(d.load_distribution).map(([k, v]) => (
              <span key={k} className="text-gray-400">{k}: {(v * 100).toFixed(0)}%</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function WeeklyTab({ weeks }) {
  if (!weeks.length) return (
    <p className="text-sm text-gray-400 text-center py-8">No data yet for this period.</p>
  )
  return (
    <div className="space-y-3">
      {weeks.map((w) => (
        <div key={w.week_start} className="card p-4 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 min-w-[130px]">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Week of {w.week_start}
            </span>
          </div>
          <div className="flex gap-4 flex-1 flex-wrap text-sm text-gray-500 dark:text-gray-400">
            <span><strong className="text-gray-800 dark:text-gray-200">{w.sessions}</strong> sessions</span>
            <span><strong className="text-gray-800 dark:text-gray-200">{w.predictions}</strong> predictions</span>
            <span><strong className="text-gray-800 dark:text-gray-200">{w.avg_wpm}</strong> avg WPM</span>
          </div>
          {w.dominant_load && <LoadBadge level={w.dominant_load} />}
        </div>
      ))}
    </div>
  )
}

export default function Reports() {
  const { user } = useAuth()
  const [tab,    setTab]    = useState("daily")
  const [daily,  setDaily]  = useState([])
  const [weekly, setWeekly] = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      reportsAPI.daily(14),
      reportsAPI.weekly(8),
    ])
      .then(([d, w]) => {
        setDaily(d.data.days)
        setWeekly(w.data.weeks)
      })
      .catch(() => setError("Could not load reports"))
      .finally(() => setLoading(false))
  }, [])

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await reportsAPI.export()
      const url = URL.createObjectURL(new Blob([res.data]))
      const a   = document.createElement("a")
      a.href    = url
      a.download = `cogniload_export_${new Date().toISOString().slice(0,10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setError("Export failed")
    } finally {
      setExporting(false)
    }
  }

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
        <button onClick={handleExport} disabled={exporting}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl
            bg-primary text-white text-sm font-semibold hover:bg-primary-dark
            shadow-lg shadow-primary/20 transition-colors disabled:opacity-60">
          {exporting
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Download className="w-4 h-4" />}
          {exporting ? "Exporting…" : "Export CSV"}
        </button>
      </motion.div>

      {error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200
          dark:border-red-800 px-4 py-3 text-sm text-red-600 dark:text-red-400 flex gap-2 items-center">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2">
        {["daily", "weekly"].map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-xl text-sm font-semibold capitalize transition-all
              ${tab === t
                ? "bg-primary text-white shadow-glow-primary"
                : "bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-700"}`}>
            {t}
          </button>
        ))}
      </div>

      {loading
        ? <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        : tab === "daily"
          ? <DailyTab  days={daily} />
          : <WeeklyTab weeks={weekly} />
      }
    </div>
  )
}
