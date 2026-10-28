import { useState } from "react"
import { useAuthFetch } from "../hooks/useAuthFetch"
import { motion } from "framer-motion"
import { Download, Loader2, AlertCircle, Monitor, Clock } from "lucide-react"
import { reportsAPI, appUsageAPI, getErrorMessage } from "../services/api"
import { Tabs, TabPanel } from "../components/ui/Tabs"
import { PageHeader } from "../components/ui/PageHeader"
import LoadBadge from "../components/ui/LoadBadge"

// ── Shared helpers ────────────────────────────────────────────────────────────

function DateLabel({ date, prefix = "" }) {
  return (
    <span className="text-[13px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.005em]">
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

function fmtSeconds(sec) {
  if (!sec || sec <= 0) return "0s"
  if (sec < 60)   return `${Math.round(sec)}s`
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${Math.round(sec % 60)}s`
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return `${h}h ${m}m`
}

// Colour palette for app usage bars — cycles
const APP_COLORS = [
  "#00D9E8", "#37D9A0", "#FFB547", "#FF5364",
  "#A78BFA", "#60A5FA", "#34D399", "#F472B6",
  "#FBBF24", "#818CF8",
]

// ── Tab content components ────────────────────────────────────────────────────

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

function AppUsageTab({ data, loading, error, onRefresh }) {
  const [lookback, setLookback] = useState(24)

  if (loading) return (
    <div className="flex justify-center py-16">
      <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#00D9E8" }} />
    </div>
  )

  if (error) return (
    <div role="alert"
      className="rounded-xl border border-red-200/70 dark:border-red-500/25
        bg-red-50/70 dark:bg-red-500/10 px-4 py-3 text-[13px]
        text-red-700 dark:text-red-300 flex gap-2 items-center">
      <AlertCircle className="w-4 h-4 shrink-0" /> {error}
    </div>
  )

  if (!data || !data.apps?.length) return (
    <div className="text-center py-16">
      <Monitor className="w-8 h-8 mx-auto mb-3 opacity-30" style={{ color: "#00D9E8" }} />
      <p className="text-[13px] text-[#86868b] dark:text-[#a1a1a6]">
        No app usage data yet — start a tracking session to see results.
      </p>
    </div>
  )

  const totalTracked = data.total_tracked || 0
  const apps = data.apps || []

  return (
    <div className="space-y-4">

      {/* Summary bar */}
      <div className="flex flex-wrap items-center gap-4 px-1">
        <div className="flex items-center gap-2" style={{ color: "#536477" }}>
          <Clock className="w-3.5 h-3.5" />
          <span className="text-[12px]">
            Total tracked:{" "}
            <strong className="font-semibold" style={{ color: "#EAF2F8" }}>
              {fmtSeconds(totalTracked)}
            </strong>
            {" "}across{" "}
            <strong className="font-semibold" style={{ color: "#EAF2F8" }}>
              {apps.length}
            </strong>
            {" "}app{apps.length !== 1 ? "s" : ""}
          </span>
        </div>
        <span
          className="text-[11px] px-2 py-0.5 rounded-full"
          style={{ background: "rgba(0,217,232,0.10)", color: "#00D9E8" }}>
          Last {data.period_hours}h
        </span>
      </div>

      {/* App rows */}
      <div className="space-y-2" role="list" aria-label="App usage entries">
        {apps.map((app, i) => {
          const color = APP_COLORS[i % APP_COLORS.length]
          const name  = app.process.replace(/\.exe$/i, "")
          return (
            <motion.div
              key={app.process}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, delay: i * 0.03, ease: [0.22, 1, 0.36, 1] }}
              role="listitem"
              className="rounded-xl p-4"
              style={{
                background: "rgba(9,15,24,0.60)",
                border:     "1px solid rgba(100,170,190,0.12)",
              }}>
              <div className="flex items-center justify-between gap-4 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  {/* Colour dot */}
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                  <span
                    className="text-[13px] font-semibold truncate"
                    style={{ color: "#EAF2F8" }}
                    title={app.process}>
                    {name}
                  </span>
                  {app.last_window_title && (
                    <span
                      className="text-[11px] truncate hidden sm:block"
                      style={{ color: "#536477" }}
                      title={app.last_window_title}>
                      — {app.last_window_title.slice(0, 48)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[12px] font-semibold nums" style={{ color: "#EAF2F8" }}>
                    {fmtSeconds(app.total_seconds)}
                  </span>
                  <span
                    className="text-[11px] px-2 py-0.5 rounded-full nums"
                    style={{ background: `${color}18`, color }}>
                    {app.percentage}%
                  </span>
                </div>
              </div>
              {/* Usage bar */}
              <div
                className="h-1.5 rounded-full overflow-hidden"
                style={{ background: "rgba(100,170,190,0.10)" }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${app.percentage}%` }}
                  transition={{ duration: 0.55, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
                  className="h-full rounded-full"
                  style={{ background: color, boxShadow: `0 0 6px ${color}60` }}
                />
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

const TABS = [
  { key: "daily",     label: "Daily"     },
  { key: "weekly",    label: "Weekly"    },
  { key: "app-usage", label: "App Usage" },
]

export default function Reports() {
  const [tab,              setTab]              = useState("daily")
  const [daily,            setDaily]            = useState([])
  const [weekly,           setWeekly]           = useState([])
  const [appUsageData,     setAppUsageData]     = useState(null)
  const [appUsageLoading,  setAppUsageLoading]  = useState(true)
  const [appUsageError,    setAppUsageError]    = useState(null)
  const [loading,          setLoading]          = useState(true)
  const [error,            setError]            = useState(null)

  // Export behaviour CSV
  const [exportingBehavior, setExportingBehavior] = useState(false)
  const [exportBehaviorErr, setExportBehaviorErr] = useState(null)

  // Export app-usage CSV
  const [exportingApps,    setExportingApps]    = useState(false)
  const [exportAppsErr,    setExportAppsErr]    = useState(null)

  useAuthFetch(() => {
    setLoading(true)
    Promise.all([reportsAPI.daily(14), reportsAPI.weekly(8)])
      .then(([d, w]) => { setDaily(d.days); setWeekly(w.weeks) })
      .catch((err) => setError(getErrorMessage(err, "Could not load reports.")))
      .finally(() => setLoading(false))

    // Load app usage for the App Usage tab
    setAppUsageLoading(true)
    appUsageAPI.summary(24)
      .then((res) => setAppUsageData(res))
      .catch((err) => setAppUsageError(getErrorMessage(err, "Could not load app usage.")))
      .finally(() => setAppUsageLoading(false))
  }, [])

  const handleExportBehavior = async () => {
    setExportingBehavior(true); setExportBehaviorErr(null)
    try {
      const res = await reportsAPI.export()
      const url = URL.createObjectURL(new Blob([res], { type: "text/csv" }))
      const a   = document.createElement("a")
      a.href     = url
      a.download = `cogniload_behavior_${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setExportBehaviorErr(getErrorMessage(err, "Export failed."))
    } finally {
      setExportingBehavior(false)
    }
  }

  const handleExportAppUsage = async () => {
    setExportingApps(true); setExportAppsErr(null)
    try {
      const res = await reportsAPI.exportAppUsage()
      const url = URL.createObjectURL(new Blob([res], { type: "text/csv" }))
      const a   = document.createElement("a")
      a.href     = url
      a.download = `cogniload_app_usage_${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setExportAppsErr(getErrorMessage(err, "Export failed."))
    } finally {
      setExportingApps(false)
    }
  }

  // Render the right export button(s) depending on active tab
  const exportActions = (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex gap-2">
        {/* Always show the behavior export */}
        <button
          onClick={handleExportBehavior}
          disabled={exportingBehavior}
          aria-disabled={exportingBehavior}
          className="btn-secondary text-[13px] py-1.5">
          {exportingBehavior
            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Exporting…</>
            : <><Download className="w-3.5 h-3.5" /> Export Behavior CSV</>}
        </button>

        {/* Always show app-usage export */}
        <button
          onClick={handleExportAppUsage}
          disabled={exportingApps}
          aria-disabled={exportingApps}
          className="btn-secondary text-[13px] py-1.5">
          {exportingApps
            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Exporting…</>
            : <><Monitor className="w-3.5 h-3.5" /> Export App Usage CSV</>}
        </button>
      </div>

      {exportBehaviorErr && (
        <p className="text-[11px] text-red-600 dark:text-red-400">{exportBehaviorErr}</p>
      )}
      {exportAppsErr && (
        <p className="text-[11px] text-red-600 dark:text-red-400">{exportAppsErr}</p>
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

      {loading && tab !== "app-usage" ? (
        <div className="flex justify-center py-16" aria-live="polite" aria-label="Loading reports">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-500 dark:text-indigo-300" />
        </div>
      ) : (
        <>
          <TabPanel id="daily"     active={tab}><DailyTab  days={daily}   /></TabPanel>
          <TabPanel id="weekly"    active={tab}><WeeklyTab weeks={weekly}  /></TabPanel>
          <TabPanel id="app-usage" active={tab}>
            <AppUsageTab
              data={appUsageData}
              loading={appUsageLoading}
              error={appUsageError}
              onRefresh={() => {
                setAppUsageLoading(true); setAppUsageError(null)
                appUsageAPI.summary(24)
                  .then(setAppUsageData)
                  .catch((e) => setAppUsageError(getErrorMessage(e)))
                  .finally(() => setAppUsageLoading(false))
              }}
            />
          </TabPanel>
        </>
      )}
    </div>
  )
}