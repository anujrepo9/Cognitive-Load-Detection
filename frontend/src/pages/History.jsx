import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { History as HistoryIcon, Download, Search, ChevronLeft, ChevronRight } from "lucide-react"
import { dashboardAPI } from "../services/api"
import LoadBadge from "../components/ui/LoadBadge"
import EmptyState from "../components/ui/EmptyState"
import { SkeletonPage } from "../components/ui/Skeleton"

const PER_PAGE = 8

export default function History() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(1)

  useEffect(() => {
    dashboardAPI.history(100)
      .then(({ data }) => setSessions(data.sessions || []))
      .catch(() => setSessions([]))
      .finally(() => setLoading(false))
  }, [])

  const filtered = sessions.filter((s) =>
    String(s.session_id || "").toLowerCase().includes(query.toLowerCase()) ||
    String(s.start_time || "").toLowerCase().includes(query.toLowerCase())
  )

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const current = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  if (loading) return <SkeletonPage />

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Session history</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Review all your past monitoring sessions
          </p>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl
          bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-200 text-sm
          font-semibold hover:bg-gray-200 dark:hover:bg-slate-700 border
          border-gray-200 dark:border-slate-700 transition-colors">
          <Download className="w-4 h-4" /> Export
        </button>
      </motion.div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1) }}
          className="input pl-9" placeholder="Search by session ID or date…" />
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState icon={HistoryIcon} title="No sessions found"
            description={query ? "Try a different search term." : "Your recorded sessions will appear here."} />
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-slate-800 bg-gray-50
                  dark:bg-slate-800/50">
                  {["Session", "Start", "Duration", "Avg load", "Predictions"].map((h) => (
                    <th key={h} className="text-left px-5 py-3 text-xs text-gray-500
                      font-medium uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {current.map((s, i) => (
                  <tr key={s.session_id || i}
                    className="border-b border-gray-50 dark:border-slate-800/50
                      hover:bg-gray-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-3">
                      <span className="text-gray-900 dark:text-white font-mono text-xs
                        bg-gray-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
                        {String(s.session_id || i + 1).slice(0, 8)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-500 dark:text-gray-400">
                      {s.start_time || "—"}
                    </td>
                    <td className="px-5 py-3 text-gray-500 dark:text-gray-400">
                      {s.duration || "—"}
                    </td>
                    <td className="px-5 py-3">
                      <LoadBadge level={s.avg_load || "unknown"} />
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-gray-900 dark:text-white font-medium">
                        {s.prediction_count ?? "—"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-5 py-3 border-t
            border-gray-100 dark:border-slate-800">
            <p className="text-xs text-gray-400">
              Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)} of {filtered.length}
            </p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-500
                  hover:bg-gray-200 dark:hover:bg-slate-700 disabled:opacity-40
                  disabled:cursor-not-allowed transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-gray-500">
                {page} / {totalPages}
              </span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-500
                  hover:bg-gray-200 dark:hover:bg-slate-700 disabled:opacity-40
                  disabled:cursor-not-allowed transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}
