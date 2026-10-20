import { useState } from "react"
import { useAuthFetch } from "../hooks/useAuthFetch"
import { motion } from "framer-motion"
import { Download, Loader2, AlertCircle } from "lucide-react"
import { reportsAPI, getErrorMessage } from "../services/api"
import { Tabs, TabPanel } from "../components/ui/Tabs"
import { PageHeader } from "../components/ui/PageHeader"
import LoadBadge from "../components/ui/LoadBadge"

/* Refined helper components — same data, polished presentation. */
function DateLabel({ date, prefix = "" }) {
  return (
    <span className="text-[13px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]
      tracking-[-0.005em]">
      {prefix}{date}
    </span>
  )
}

function StatPill({ label, value }) {
  return (
    <span className="text-[12px] text-[#86868b] dark:text-[#a1a1a6]">
      <strong className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] nums">{value}</strong>
      {" "}{label}
    </span>
  )
}

function LoadShare({ k, v }) {
  return (
    <span className="text-[11px] text-[#86868b] dark:text-[#a1a1a6] nums capitalize">
      {k}: {(v * 100).toFixed(0)}%
    </span>
  )
}

function DailyTab({ days }) {
  if (!days.length) return (
    <div className="text-center py-16">
      <p className="text-[13px] text-[#86868b] dark:text-[#a1a1a6]">
        No daily data yet. Complete some tracking sessions first.
      </p>
    </div>
  )
  return (
    <div className="space-y-3" role="list" aria-label="Daily report entries">
      {days.map((d) => (
        <motion.div key={d.date}
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          role="listitem"
          className="card p-4 flex flex-wrap items-center gap-4 hover:border-indigo-200/70
            dark:hover:border-indigo-500/25 transition-colors">
          <DateLabel date={d.date} />
          <div className="flex gap-4 flex-1 flex-wrap">
            <StatPill label="sessions"    value={d.sessions} />
            <StatPill label="predictions" value={d.predictions} />
            <StatPill label="avg WPM"     value={d.avg_wpm} />
          </div>
          {d.dominant_load && <LoadBadge level={d.dominant_load} />}
          <div className="flex gap-3" aria-label="Load distribution">
            {Object.entries(d.load_distribution).map(([k, v]) => (
              <LoadShare key={k} k={k} v={v} />
            ))}
          </div>
        </motion.div>
      ))}
    </div>
  )
}

function WeeklyTab({ weeks }) {
  if (!weeks.length) return (
    <div className="text-center py-16">
      <p className="text-[13px] text-[#86868b] dark:text-[#a1a1a6]">
        No weekly data yet. Complete sessions across multiple days to see weekly summaries.
      </p>
    </div>
  )
  return (
    <div className="space-y-3" role="list" aria-label="Weekly report entries">
      {weeks.map((w) => (
        <motion.div key={w.week_start}
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          role="listitem"
          className="card p-4 flex flex-wrap items-center gap-4 hover:border-indigo-200/70
            dark:hover:border-indigo-500/25 transition-colors">
          <DateLabel date={w.week_start} prefix="Week of " />
          <div className="flex gap-4 flex-1 flex-wrap">
            <StatPill label="sessions"    value={w.sessions} />
            <StatPill label="predictions" value={w.predictions} />
            <StatPill label="avg WPM"     value={w.avg_wpm} />
          </div>
          {w.dominant_load && <LoadBadge level={w.dominant_load} />}
          <div className="flex gap-3" aria-label="Load distribution">
            {Object.entries(w.load_distribution).map(([k, v]) => (
              <LoadShare key={k} k={k} v={v} />
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
  const [tab,       setTab]       = useState("daily")
  const [daily,     setDaily]     = useState([])
  const [weekly,    setWeekly]    = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)
  const [exporting, setExporting] = useState(false)
  const [exportErr, setExportErr] = useState(null)

  useAuthFetch(() => {
    setLoading(true)
    Promise.all([reportsAPI.daily(14), reportsAPI.weekly(8)])
      .then(([d, w]) => { setDaily(d.days); setWeekly(w.weeks) })
      .catch((err) => setError(getErrorMessage(err, "Could not load reports.")))
      .finally(() => setLoading(false))
  }, [])

  const handleExport = async () => {
    setExporting(true); setExportErr(null)
    try {
      const res = await reportsAPI.export()
      const url = URL.createObjectURL(new Blob([res]))
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

  // Build the Export CSV button + error as a single actions node — passed
  // through the `actions` prop so PageHeader actually renders it. (Passing
  // it as children was silently dropped by PageHeader.)
  const exportActions = (
    <div className="flex flex-col items-end gap-1.5">
      <button
        onClick={handleExport}
        disabled={exporting}
        aria-disabled={exporting}
        className="btn-primary text-[13px] py-1.5">
        {exporting
          ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Exporting…</>
          : <><Download className="w-3.5 h-3.5" /> Export CSV</>}
      </button>
      {exportErr && (
        <p className="text-[11px] text-red-600 dark:text-red-400">{exportErr}</p>
      )}
    </div>
  )

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <PageHeader
        title="Reports"
        description="Aggregated daily and weekly cognitive performance summaries"
        actions={exportActions}
      />

      {error && (
        <div role="alert"
          className="rounded-xl border border-red-200/70 dark:border-red-500/25
            bg-red-50/70 dark:bg-red-500/10 px-4 py-3 text-[13px]
            text-red-700 dark:text-red-300 flex gap-2 items-center">
          <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" /> {error}
        </div>
      )}

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {loading ? (
        <div className="flex justify-center py-16" aria-live="polite" aria-label="Loading reports">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-500 dark:text-indigo-300" />
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
