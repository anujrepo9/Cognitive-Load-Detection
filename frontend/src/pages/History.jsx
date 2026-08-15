import { useState, useEffect, useCallback } from "react"
import { motion } from "framer-motion"
import {
  History as HistoryIcon, Download, Search,
  ChevronLeft, ChevronRight, Loader2, X, Info,
} from "lucide-react"
import { dashboardAPI, reportsAPI, getErrorMessage } from "../services/api"
import LoadBadge from "../components/ui/LoadBadge"
import EmptyState from "../components/ui/EmptyState"
import { SkeletonPage } from "../components/ui/Skeleton"

const PER_PAGE = 10

export default function History() {
  const [sessions,   setSessions]   = useState([])
  const [total,      setTotal]      = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading,    setLoading]    = useState(true)
  const [exporting,  setExporting]  = useState(false)
  const [exportErr,  setExportErr]  = useState(null)
  const [page,       setPage]       = useState(1)
  const [fromDate,   setFromDate]   = useState("")
  const [toDate,     setToDate]     = useState("")

  const fetchHistory = useCallback((p = 1, from = fromDate, to = toDate) => {
    setLoading(true)
    const params = { page: p, per_page: PER_PAGE }
    if (from) params.from_date = from
    if (to)   params.to_date   = to
    dashboardAPI.history(params)
      .then(({ data }) => {
        setSessions(data.sessions || [])
        setTotal(data.total || 0)
        setTotalPages(data.total_pages || 1)
      })
      .catch(() => setSessions([]))
      .finally(() => setLoading(false))
  }, [fromDate, toDate])

  useEffect(() => { fetchHistory(page) }, [page])  // eslint-disable-line

  const applyFilters = () => { setPage(1); fetchHistory(1, fromDate, toDate) }

  const clearFilters = () => {
    setFromDate(""); setToDate(""); setPage(1)
    fetchHistory(1, "", "")
  }

  const handleExport = async () => {
    setExporting(true); setExportErr(null)
    try {
      const res = await reportsAPI.export()
      const url = URL.createObjectURL(new Blob([res.data]))
      const a   = document.createElement("a")
      a.href     = url
      a.download = `cogniload_sessions_${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setExportErr(getErrorMessage(err, "Export failed. Please try again."))
    } finally {
      setExporting(false)
    }
  }

  const formatTime = (iso) => {
    if (!iso) return "—"
    try { return new Date(iso).toLocaleString() } catch { return iso }
  }

  if (loading && page === 1 && !fromDate && !toDate) return <SkeletonPage />

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Session history</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            All past monitoring sessions — each row is one continuous tracking period
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button onClick={handleExport} disabled={exporting}
            className="btn-secondary" aria-disabled={exporting}>
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {exporting ? "Exporting…" : "Export CSV"}
          </button>
          {exportErr && (
            <p className="text-xs text-red-500">{exportErr}</p>
          )}
        </div>
      </motion.div>

      {/* Date filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="from-date"
            className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            From
          </label>
          <input id="from-date" type="date" value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="input text-sm" />
        </div>
        <div>
          <label htmlFor="to-date"
            className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            To
          </label>
          <input id="to-date" type="date" value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="input text-sm" />
        </div>
        <button onClick={applyFilters}
          className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold
            hover:bg-primary-dark transition-colors flex items-center gap-2">
          <Search className="w-4 h-4" aria-hidden="true" /> Filter
        </button>
        {(fromDate || toDate) && (
          <button onClick={clearFilters}
            className="px-4 py-2 rounded-xl bg-gray-100 dark:bg-slate-800 text-gray-500
              dark:text-gray-400 text-sm font-medium hover:bg-gray-200 dark:hover:bg-slate-700
              transition-colors flex items-center gap-2">
            <X className="w-4 h-4" aria-hidden="true" /> Clear
          </button>
        )}
        {(fromDate || toDate) && !loading && (
          <span className="text-xs text-gray-400 self-end pb-2">
            {total} session{total !== 1 ? "s" : ""} found
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16" aria-live="polite" aria-label="Loading">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="card">
          <EmptyState icon={HistoryIcon} title="No sessions found"
            description={fromDate || toDate
              ? "No sessions match your date filter. Try adjusting the range or clearing the filter."
              : "You haven't started any tracking sessions yet. Go to the Dashboard and click 'Start tracking'."} />
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="Session history">
              <thead>
                <tr className="border-b border-gray-100 dark:border-slate-800
                  bg-gray-50 dark:bg-slate-800/50">
                  {[
                    { label: "Session",     tip: null },
                    { label: "Started",     tip: null },
                    { label: "Duration",    tip: "Time between session start and end" },
                    { label: "Avg load",    tip: "Most common cognitive load level in the session" },
                    { label: "Predictions", tip: "Number of ML predictions made during the session" },
                  ].map(({ label, tip }) => (
                    <th key={label} scope="col"
                      className="text-left px-5 py-3 text-xs text-gray-500
                        font-medium uppercase tracking-wider">
                      <span className="flex items-center gap-1">
                        {label}
                        {tip && (
                          <span title={tip} aria-label={tip}>
                            <Info className="w-3 h-3 text-gray-400" aria-hidden="true" />
                          </span>
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sessions.map((s, i) => (
                  <tr key={s.session_id ?? i}
                    className="border-b border-gray-50 dark:border-slate-800/50
                      hover:bg-gray-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-3">
                      <span className="text-gray-900 dark:text-white font-mono text-xs
                        bg-gray-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
                        #{s.session_id}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-500 dark:text-gray-400">
                      {formatTime(s.start_time)}
                    </td>
                    <td className="px-5 py-3 text-gray-500 dark:text-gray-400">
                      {s.duration
                        ? s.duration
                        : s.end_time
                          ? "—"
                          : <span className="text-green-500 text-xs font-medium">Active</span>}
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
              Page {page} of {totalPages} — {total} total session{total !== 1 ? "s" : ""}
            </p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-500
                  hover:bg-gray-200 dark:hover:bg-slate-700 disabled:opacity-40
                  disabled:cursor-not-allowed transition-colors"
                aria-label="Previous page">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-gray-500" aria-live="polite">
                {page} / {totalPages}
              </span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-2 rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-500
                  hover:bg-gray-200 dark:hover:bg-slate-700 disabled:opacity-40
                  disabled:cursor-not-allowed transition-colors"
                aria-label="Next page">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}
