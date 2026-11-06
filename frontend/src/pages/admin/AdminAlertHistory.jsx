/**
 * AdminAlertHistory.jsx
 *
 * Full alert history for the admin:
 *  - Filter by employee, type (high_load / low_load / custom),
 *    read status, source (auto / manual), and date range
 *  - Paginated table with sort by date (newest first)
 *  - Summary stats bar (total, unread, auto-fired)
 *  - Delete individual alerts
 *  - Export visible page as CSV
 */

import { useState, useEffect, useCallback, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  History, Filter, X, Trash2, Download, ChevronLeft, ChevronRight,
  AlertTriangle, Bell, Zap, CheckCircle2, Clock, Search,
} from "lucide-react"
import { adminAPI, getErrorMessage } from "../../services/api"
import { useToast } from "../../components/ui/Toast"
import { PageHeader } from "../../components/ui/PageHeader"
import { SkeletonPage } from "../../components/ui/Skeleton"

// ── Constants ─────────────────────────────────────────────────────────────────

const TYPE_META = {
  high_load: { label: "High Load", color: "#FF5364", bg: "rgba(255,83,100,0.10)",  border: "rgba(255,83,100,0.22)"  },
  low_load:  { label: "Low Load",  color: "#FFB547", bg: "rgba(255,181,71,0.10)",  border: "rgba(255,181,71,0.22)"  },
  custom:    { label: "Custom",    color: "#00D9E8", bg: "rgba(0,217,232,0.08)",   border: "rgba(0,217,232,0.18)"   },
}

const PILL = ({ children, color, bg, border, onClick, active }) => (
  <button
    onClick={onClick}
    className="px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all whitespace-nowrap"
    style={active
      ? { background: bg, border: `1px solid ${border}`, color }
      : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(100,170,190,0.12)", color: "#536477" }}
  >
    {children}
  </button>
)

// ── CSV export ────────────────────────────────────────────────────────────────

function exportCSV(alerts, employeeMap) {
  const header = ["ID", "Employee", "Type", "Title", "Message", "Source", "Read", "Sent At", "Read At"]
  const rows = alerts.map(a => [
    a.id,
    employeeMap[a.employee_id] || `#${a.employee_id}`,
    a.alert_type,
    `"${a.title.replace(/"/g, '""')}"`,
    `"${a.message.replace(/"/g, '""')}"`,
    a.is_auto ? "auto" : "manual",
    a.is_read ? "yes" : "no",
    a.created_at ? new Date(a.created_at).toLocaleString() : "",
    a.read_at   ? new Date(a.read_at).toLocaleString()    : "",
  ])
  const csv = [header, ...rows].map(r => r.join(",")).join("\n")
  const blob = new Blob([csv], { type: "text/csv" })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement("a")
  a.href = url
  a.download = `alert-history-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Filter bar ────────────────────────────────────────────────────────────────

function FilterBar({ employees, filters, onChange, onReset }) {
  const hasActive = Object.values(filters).some(v => v !== "" && v !== null && v !== undefined)

  return (
    <div className="rounded-2xl p-4" style={{ background: "#0B1420", border: "1px solid rgba(100,170,190,0.14)" }}>
      <div className="flex items-center gap-2 mb-3">
        <Filter className="w-3.5 h-3.5" style={{ color: "#536477" }} />
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: "#536477" }}>Filters</span>
        {hasActive && (
          <button onClick={onReset}
            className="ml-auto flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg transition-all"
            style={{ color: "#FFB547", background: "rgba(255,181,71,0.08)", border: "1px solid rgba(255,181,71,0.18)" }}>
            <X className="w-3 h-3" /> Clear all
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">

        {/* Employee */}
        <div className="lg:col-span-2">
          <label className="block text-[10px] font-semibold uppercase tracking-[0.06em] mb-1" style={{ color: "#8493A7" }}>Employee</label>
          <select
            value={filters.employee_id}
            onChange={e => onChange("employee_id", e.target.value)}
            className="w-full px-2.5 py-2 rounded-lg text-[12px] outline-none appearance-none"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(100,170,190,0.18)", color: "#EAF2F8" }}
          >
            <option value="" style={{ background: "#0B1420" }}>All employees</option>
            {employees.map(e => (
              <option key={e.id} value={e.id} style={{ background: "#0B1420" }}>{e.name}</option>
            ))}
          </select>
        </div>

        {/* Type */}
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-[0.06em] mb-1" style={{ color: "#8493A7" }}>Type</label>
          <select
            value={filters.alert_type}
            onChange={e => onChange("alert_type", e.target.value)}
            className="w-full px-2.5 py-2 rounded-lg text-[12px] outline-none appearance-none"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(100,170,190,0.18)", color: "#EAF2F8" }}
          >
            <option value="" style={{ background: "#0B1420" }}>All types</option>
            <option value="high_load" style={{ background: "#0B1420" }}>High Load</option>
            <option value="low_load"  style={{ background: "#0B1420" }}>Low Load</option>
            <option value="custom"    style={{ background: "#0B1420" }}>Custom</option>
          </select>
        </div>

        {/* Read status */}
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-[0.06em] mb-1" style={{ color: "#8493A7" }}>Read</label>
          <select
            value={filters.is_read}
            onChange={e => onChange("is_read", e.target.value)}
            className="w-full px-2.5 py-2 rounded-lg text-[12px] outline-none appearance-none"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(100,170,190,0.18)", color: "#EAF2F8" }}
          >
            <option value=""      style={{ background: "#0B1420" }}>All</option>
            <option value="false" style={{ background: "#0B1420" }}>Unread</option>
            <option value="true"  style={{ background: "#0B1420" }}>Read</option>
          </select>
        </div>

        {/* Source */}
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-[0.06em] mb-1" style={{ color: "#8493A7" }}>Source</label>
          <select
            value={filters.is_auto}
            onChange={e => onChange("is_auto", e.target.value)}
            className="w-full px-2.5 py-2 rounded-lg text-[12px] outline-none appearance-none"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(100,170,190,0.18)", color: "#EAF2F8" }}
          >
            <option value=""      style={{ background: "#0B1420" }}>All sources</option>
            <option value="false" style={{ background: "#0B1420" }}>Manual</option>
            <option value="true"  style={{ background: "#0B1420" }}>Auto</option>
          </select>
        </div>

        {/* Date from */}
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-[0.06em] mb-1" style={{ color: "#8493A7" }}>From</label>
          <input
            type="date"
            value={filters.date_from}
            onChange={e => onChange("date_from", e.target.value)}
            className="w-full px-2.5 py-2 rounded-lg text-[12px] outline-none"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(100,170,190,0.18)",
              color: filters.date_from ? "#EAF2F8" : "#536477",
              colorScheme: "dark",
            }}
          />
        </div>

        {/* Date to */}
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-[0.06em] mb-1" style={{ color: "#8493A7" }}>To</label>
          <input
            type="date"
            value={filters.date_to}
            onChange={e => onChange("date_to", e.target.value)}
            className="w-full px-2.5 py-2 rounded-lg text-[12px] outline-none"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(100,170,190,0.18)",
              color: filters.date_to ? "#EAF2F8" : "#536477",
              colorScheme: "dark",
            }}
          />
        </div>

      </div>
    </div>
  )
}

// ── Stats bar ─────────────────────────────────────────────────────────────────

function StatBar({ total, unread, autoFired }) {
  const stats = [
    { label: "Total Alerts",  value: total,     color: "#EAF2F8", icon: Bell          },
    { label: "Unread",        value: unread,     color: "#FFB547", icon: Clock         },
    { label: "Auto-fired",    value: autoFired,  color: "#FF5364", icon: Zap           },
    { label: "Read",          value: total - unread, color: "#37D9A0", icon: CheckCircle2 },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {stats.map(({ label, value, color, icon: Icon }) => (
        <div key={label} className="rounded-xl px-4 py-3 flex items-center gap-3"
          style={{ background: "#0B1420", border: "1px solid rgba(100,170,190,0.12)" }}>
          <Icon className="w-4 h-4 shrink-0" style={{ color }} />
          <div>
            <p className="text-[18px] font-bold nums leading-none" style={{ color }}>{value}</p>
            <p className="text-[11px] mt-0.5" style={{ color: "#536477" }}>{label}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Alert row ─────────────────────────────────────────────────────────────────

function AlertRow({ alert, employeeName, onDelete, index }) {
  const meta = TYPE_META[alert.alert_type] || TYPE_META.custom

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.025 }}
      className="rounded-xl p-4 transition-all"
      style={{
        background: "#0B1420",
        border: alert.is_auto
          ? "1px solid rgba(255,83,100,0.20)"
          : "1px solid rgba(100,170,190,0.12)",
      }}
    >
      <div className="flex items-start gap-3">

        {/* Type icon */}
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
          style={{ background: meta.bg, border: `1px solid ${meta.border}` }}>
          {alert.alert_type === "high_load"
            ? <AlertTriangle className="w-4 h-4" style={{ color: meta.color }} />
            : <Bell className="w-4 h-4" style={{ color: meta.color }} />}
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Title row */}
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-[13px] font-semibold truncate" style={{ color: "#EAF2F8" }}>
              {alert.title}
            </span>

            {/* Type badge */}
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
              style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }}>
              {meta.label}
            </span>

            {/* Auto badge */}
            {alert.is_auto && (
              <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded"
                style={{ background: "rgba(255,83,100,0.10)", color: "#FF5364", border: "1px solid rgba(255,83,100,0.22)" }}>
                <Zap className="w-2.5 h-2.5" /> AUTO
              </span>
            )}

            {/* Read status */}
            {alert.is_read
              ? <span className="flex items-center gap-1 text-[10px]" style={{ color: "#37D9A0" }}>
                  <CheckCircle2 className="w-3 h-3" /> Read
                </span>
              : <span className="flex items-center gap-1 text-[10px]" style={{ color: "#FFB547" }}>
                  <Clock className="w-3 h-3" /> Unread
                </span>}
          </div>

          {/* Employee + message */}
          <p className="text-[11px] mb-1" style={{ color: "#7775FF" }}>
            → {employeeName(alert.employee_id)}
          </p>
          <p className="text-[12px] line-clamp-2" style={{ color: "#8493A7" }}>
            {alert.message}
          </p>

          {/* Timestamps */}
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span className="text-[11px]" style={{ color: "#536477" }}>
              Sent: {alert.created_at ? new Date(alert.created_at).toLocaleString() : "—"}
            </span>
            {alert.is_read && alert.read_at && (
              <span className="text-[11px]" style={{ color: "#37D9A0" }}>
                Read: {new Date(alert.read_at).toLocaleString()}
              </span>
            )}
          </div>
        </div>

        {/* Delete */}
        <button
          onClick={() => onDelete(alert.id)}
          className="p-1.5 rounded-lg shrink-0 transition-all"
          style={{ color: "#536477" }}
          onMouseEnter={e => { e.currentTarget.style.color = "#FF5364"; e.currentTarget.style.background = "rgba(255,83,100,0.08)" }}
          onMouseLeave={e => { e.currentTarget.style.color = "#536477"; e.currentTarget.style.background = "transparent" }}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  )
}

// ── Pagination controls ───────────────────────────────────────────────────────

function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null

  const pages = []
  const start = Math.max(1, page - 2)
  const end   = Math.min(totalPages, page + 2)
  for (let i = start; i <= end; i++) pages.push(i)

  return (
    <div className="flex items-center justify-center gap-2 mt-4">
      <button
        onClick={() => onChange(page - 1)} disabled={page === 1}
        className="w-8 h-8 flex items-center justify-center rounded-lg transition-all"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(100,170,190,0.18)",
          color: page === 1 ? "#2D3A4A" : "#8493A7",
        }}>
        <ChevronLeft className="w-4 h-4" />
      </button>

      {start > 1 && (
        <>
          <button onClick={() => onChange(1)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[12px] transition-all"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(100,170,190,0.12)", color: "#8493A7" }}>
            1
          </button>
          {start > 2 && <span className="text-[12px]" style={{ color: "#536477" }}>…</span>}
        </>
      )}

      {pages.map(p => (
        <button key={p} onClick={() => onChange(p)}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-[12px] font-medium transition-all"
          style={p === page
            ? { background: "rgba(0,217,232,0.12)", border: "1px solid rgba(0,217,232,0.28)", color: "#00D9E8" }
            : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(100,170,190,0.12)", color: "#8493A7" }}>
          {p}
        </button>
      ))}

      {end < totalPages && (
        <>
          {end < totalPages - 1 && <span className="text-[12px]" style={{ color: "#536477" }}>…</span>}
          <button onClick={() => onChange(totalPages)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[12px] transition-all"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(100,170,190,0.12)", color: "#8493A7" }}>
            {totalPages}
          </button>
        </>
      )}

      <button
        onClick={() => onChange(page + 1)} disabled={page === totalPages}
        className="w-8 h-8 flex items-center justify-center rounded-lg transition-all"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(100,170,190,0.18)",
          color: page === totalPages ? "#2D3A4A" : "#8493A7",
        }}>
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

const DEFAULT_FILTERS = {
  employee_id: "",
  alert_type:  "",
  is_read:     "",
  is_auto:     "",
  date_from:   "",
  date_to:     "",
}

export default function AdminAlertHistory() {
  const { toast } = useToast()

  const [employees, setEmployees] = useState([])
  const [alerts,    setAlerts]    = useState([])
  const [meta,      setMeta]      = useState({ total: 0, page: 1, per_page: 25, total_pages: 1 })
  const [loading,   setLoading]   = useState(true)

  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS })
  const [page,    setPage]    = useState(1)

  // Stats (all-time, unaffected by filters — fetched once)
  const [statsTotal,     setStatsTotal]     = useState(0)
  const [statsUnread,    setStatsUnread]    = useState(0)
  const [statsAutoFired, setStatsAutoFired] = useState(0)

  // Track if this is the first load so we show skeleton
  const firstLoad = useRef(true)

  // ── Load employees once ─────────────────────────────────────────────────
  useEffect(() => {
    adminAPI.listEmployees()
      .then(setEmployees)
      .catch(() => {})
  }, [])

  // ── Fetch alerts (re-runs on filter/page change) ────────────────────────
  const fetchAlerts = useCallback(async (f, p) => {
    if (firstLoad.current) setLoading(true)
    try {
      const params = {
        page,
        per_page: 25,
      }
      if (f.employee_id) params.employee_id = Number(f.employee_id)
      if (f.alert_type)  params.alert_type  = f.alert_type
      if (f.is_read !== "") params.is_read   = f.is_read === "true"
      if (f.is_auto !== "") params.is_auto   = f.is_auto === "true"
      if (f.date_from)   params.date_from    = f.date_from
      if (f.date_to)     params.date_to      = f.date_to
      params.page = p

      const data = await adminAPI.listAlertsHistory(params)
      setAlerts(data.alerts)
      setMeta({ total: data.total, page: data.page, per_page: data.per_page, total_pages: data.total_pages })
    } catch (err) {
      toast("error", getErrorMessage(err))
    } finally {
      setLoading(false)
      firstLoad.current = false
    }
  }, [])

  // ── Stats (all-time totals — no filters) ───────────────────────────────
  const fetchStats = useCallback(async () => {
    try {
      const all    = await adminAPI.listAlertsHistory({ page: 1, per_page: 1 })
      const unread = await adminAPI.listAlertsHistory({ page: 1, per_page: 1, is_read: false })
      const auto   = await adminAPI.listAlertsHistory({ page: 1, per_page: 1, is_auto: true })
      setStatsTotal(all.total)
      setStatsUnread(unread.total)
      setStatsAutoFired(auto.total)
    } catch { /* non-critical */ }
  }, [])

  useEffect(() => { fetchStats() }, [fetchStats])
  useEffect(() => { fetchAlerts(filters, page) }, [filters, page])

  const handleFilterChange = (key, val) => {
    setFilters(prev => ({ ...prev, [key]: val }))
    setPage(1)
  }

  const handleReset = () => {
    setFilters({ ...DEFAULT_FILTERS })
    setPage(1)
  }

  const handleDelete = async (alertId) => {
    try {
      await adminAPI.deleteAlert(alertId)
      setAlerts(prev => prev.filter(a => a.id !== alertId))
      setMeta(prev => ({ ...prev, total: prev.total - 1 }))
      setStatsTotal(prev => prev - 1)
      toast("success", "Alert deleted")
    } catch (err) {
      toast("error", getErrorMessage(err))
    }
  }

  const employeeName = (id) => employees.find(e => e.id === id)?.name || `#${id}`
  const employeeMap  = Object.fromEntries(employees.map(e => [e.id, e.name]))

  if (loading && firstLoad.current) return <SkeletonPage />

  const hasFilters = Object.values(filters).some(v => v !== "")

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">

      {/* Header row */}
      <div className="flex items-center justify-between gap-4">
        <PageHeader
          icon={History}
          title="Alert History"
          subtitle="All alerts sent to your team — filter, search, and export"
        />
        <button
          onClick={() => exportCSV(alerts, employeeMap)}
          disabled={alerts.length === 0}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-semibold transition-all shrink-0"
          style={{
            background: alerts.length === 0 ? "rgba(255,255,255,0.03)" : "rgba(0,217,232,0.08)",
            border: `1px solid ${alerts.length === 0 ? "rgba(100,170,190,0.12)" : "rgba(0,217,232,0.22)"}`,
            color: alerts.length === 0 ? "#536477" : "#00D9E8",
          }}>
          <Download className="w-3.5 h-3.5" />
          Export CSV
        </button>
      </div>

      {/* Stats bar */}
      <StatBar total={statsTotal} unread={statsUnread} autoFired={statsAutoFired} />

      {/* Filters */}
      <FilterBar
        employees={employees}
        filters={filters}
        onChange={handleFilterChange}
        onReset={handleReset}
      />

      {/* Results header */}
      <div className="flex items-center justify-between">
        <p className="text-[12px]" style={{ color: "#536477" }}>
          {loading
            ? "Loading…"
            : hasFilters
              ? `${meta.total} result${meta.total !== 1 ? "s" : ""} matching filters`
              : `${meta.total} alert${meta.total !== 1 ? "s" : ""} total`}
          {meta.total_pages > 1 && ` — page ${meta.page} of ${meta.total_pages}`}
        </p>
        {loading && !firstLoad.current && (
          <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: "rgba(0,217,232,0.3)", borderTopColor: "#00D9E8" }} />
        )}
      </div>

      {/* Alert list */}
      {alerts.length === 0 && !loading ? (
        <div className="flex flex-col items-center justify-center py-24 rounded-2xl"
          style={{ border: "1px dashed rgba(100,170,190,0.14)" }}>
          <Bell className="w-8 h-8 mb-3" style={{ color: "#536477" }} />
          <p className="text-[14px]" style={{ color: "#536477" }}>
            {hasFilters ? "No alerts match the current filters." : "No alerts sent yet."}
          </p>
          {hasFilters && (
            <button onClick={handleReset}
              className="mt-3 text-[12px] px-3 py-1.5 rounded-lg transition-all"
              style={{ color: "#00D9E8", border: "1px solid rgba(0,217,232,0.20)", background: "rgba(0,217,232,0.06)" }}>
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="wait">
            {alerts.map((alert, i) => (
              <AlertRow
                key={alert.id}
                alert={alert}
                index={i}
                employeeName={employeeName}
                onDelete={handleDelete}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Pagination */}
      <Pagination
        page={meta.page}
        totalPages={meta.total_pages}
        onChange={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: "smooth" }) }}
      />

    </div>
  )
}