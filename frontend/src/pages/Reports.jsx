import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Download, Loader2, AlertCircle } from "lucide-react"
import { reportsAPI, getErrorMessage } from "../services/api"
import { Tabs, TabPanel } from "../components/ui/Tabs"
import { PageHeader } from "../components/ui/PageHeader"
import LoadBadge from "../components/ui/LoadBadge"

function DateLabel({ date, prefix = "" }) {
  return (
    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
      {prefix}{date}
    </span>
  )
}

function StatPill({ label, value }) {
  return (
    <span className="text-sm text-gray-500 dark:text-gray-400">
      <strong className="text-gray-800 dark:text-gray-200">{value}</strong>{" "}{label}
    </span>
  )
}

function DailyTab({ days }) {
  if (!days.length) return (
    <p className="text-sm text-gray-400 text-center py-12">
      No daily data yet. Complete some tracking sessions first.
    </p>
  )
  return (
    <div className="space-y-3" role="list" aria-label="Daily report entries">
      {days.map((d) => (
        <motion.div key={d.date}
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          role="listitem"
          className="card p-4 flex flex-wrap items-center gap-4">
          <DateLabel date={d.date} />
          <div className="flex gap-4 flex-1 flex-wrap">
            <StatPill label="sessions"    value={d.sessions} />
            <StatPill label="predictions" value={d.predictions} />
            <StatPill label="avg WPM"     value={d.avg_wpm} />
          </div>
          {d.dominant_load && <LoadBadge level={d.dominant_load} />}
          <div className="flex gap-3 text-xs text-gray-400" aria-label="Load distribution">
            {Object.entries(d.load_distribution).map(([k, v]) => (
              <span key={k}>{k}: {(v * 100).toFixed(0)}%</span>
            ))}
          </div>
        </motion.div>
      ))}
    </div>
  )
}

function WeeklyTab({ weeks }) {
  if (!weeks.length) return (
    <p className="text-sm text-gray-400 text-center py-12">
      No weekly data yet. Complete sessions across multiple days to see weekly summaries.
    </p>
  )
  return (
    <div className="space-y-3" role="list" aria-label="Weekly report entries">
      {weeks.map((w) => (
        <motion.div key={w.week_start}
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          role="listitem"
          className="card p-4 flex flex-wrap items-center gap-4">
          <DateLabel date={w.week_start} prefix="Week of " />
          <div className="flex gap-4 flex-1 flex-wrap">
            <StatPill label="sessions"    value={w.sessions} />
            <StatPill label="predictions" value={w.predictions} />
            <StatPill label="avg WPM"     value={w.avg_wpm} />
          </div>
          {w.dominant_load && <LoadBadge level={w.dominant_load} />}
          <div className="flex gap-3 text-xs text-gray-400" aria-label="Load distribution">
            {Object.entries(w.load_distribution).map(([k, v]) => (
              <span key={k}>{k}: {(v * 100).toFixed(0)}%</span>
            ))}
          </div>
        </motion.div>
      ))}
    </div>
  )
}

const TABS = [
  { key: "daily",  label: "Daily"  },
  { key: "weekly", label: "Weekly" },
]

export default function Reports() {
  const [tab,      setTab]      = useState("daily")
  const [daily,    setDaily]    = useState([])
  const [weekly,   setWeekly]   = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)
  const [exporting,setExporting]= useState(false)
  const [exportErr,setExportErr]= useState(null)

  useEffect(() => {
    setLoading(true)
    Promise.all([reportsAPI.daily(14), reportsAPI.weekly(8)])
      .then(([d, w]) => { setDaily(d.data.days); setWeekly(w.data.weeks) })
      .catch((err) => setError(getErrorMessage(err, "Could not load reports.")))
      .finally(() => setLoading(false))
  }, [])

  const handleExport = async () => {
    setExporting(true); setExportErr(null)
    try {
      const res = await reportsAPI.export()
      const url = URL.createObjectURL(new Blob([res.data]))
      const a   = document.createElement("a")
      a.href     = url
      a.download = `cogniload_export_${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setExportErr(getErrorMessage(err, "Export failed."))
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <PageHeader
        title="Reports"
        subtitle="Aggregated daily and weekly cognitive performance summaries"
      >
        <div className="flex flex-col items-end gap-1">
          <button onClick={handleExport} disabled={exporting} className="btn-primary"
            aria-disabled={exporting}>
            {exporting
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Exporting…</>
              : <><Download className="w-4 h-4" /> Export CSV</>}
          </button>
          {exportErr && <p className="text-xs text-red-500">{exportErr}</p>}
        </div>
      </PageHeader>

      {error && (
        <div role="alert" className="rounded-xl bg-red-50 dark:bg-red-900/20
          border border-red-200 dark:border-red-800 px-4 py-3 text-sm
          text-red-600 dark:text-red-400 flex gap-2 items-center">
          <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" /> {error}
        </div>
      )}

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {loading ? (
        <div className="flex justify-center py-16" aria-live="polite" aria-label="Loading reports">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <TabPanel id="daily"  active={tab}><DailyTab  days={daily}  /></TabPanel>
          <TabPanel id="weekly" active={tab}><WeeklyTab weeks={weekly} /></TabPanel>
        </>
      )}
    </div>
  )
}
