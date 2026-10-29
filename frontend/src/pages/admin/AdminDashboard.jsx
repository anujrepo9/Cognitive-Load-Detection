import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import {
  Users, ShieldCheck, Bell, TrendingUp, AlertTriangle,
  CheckCircle2, Activity, Monitor, ChevronRight, RefreshCw,
} from "lucide-react"
import { adminAPI } from "../../services/api"
import LoadBadge from "../../components/ui/LoadBadge"
import { SkeletonPage } from "../../components/ui/Skeleton"
import { useToast } from "../../components/ui/Toast"
import { PageHeader } from "../../components/ui/PageHeader"

function SnapshotCard({ snap, index }) {
  const loadColor = {
    high:    "#FF5364",
    medium:  "#FFB547",
    low:     "#37D9A0",
  }[snap.latest_load] || "#536477"

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: index * 0.04, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-xl p-4 group"
      style={{
        background: "#0B1420",
        border: "1px solid rgba(100,170,190,0.14)",
        transition: "border-color 0.2s, box-shadow 0.2s",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = "rgba(0,217,232,0.22)"
        e.currentTarget.style.boxShadow = "0 4px 24px rgba(0,0,0,0.4)"
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = "rgba(100,170,190,0.14)"
        e.currentTarget.style.boxShadow = ""
      }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-[#EAF2F8] truncate">{snap.employee_name}</p>
          <p className="text-[11px] truncate mt-0.5" style={{ color: "#536477" }}>{snap.email}</p>
        </div>
        {snap.latest_load ? (
          <LoadBadge level={snap.latest_load} animate={snap.latest_load === "high"} />
        ) : (
          <span className="badge" style={{
            background: "rgba(83,100,119,0.12)",
            border: "1px solid rgba(83,100,119,0.2)",
            color: "#536477",
          }}>No data</span>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="rounded-lg p-2 text-center" style={{ background: "rgba(255,255,255,0.02)" }}>
          <p className="text-[16px] font-bold nums" style={{ color: "#EAF2F8" }}>
            {snap.sessions_today}
          </p>
          <p className="text-[9px] uppercase tracking-[0.08em] mt-0.5" style={{ color: "#536477" }}>
            Sessions
          </p>
        </div>
        <div className="rounded-lg p-2 text-center" style={{ background: "rgba(255,255,255,0.02)" }}>
          <p className="text-[13px] font-bold capitalize" style={{ color: loadColor }}>
            {snap.avg_load_today || "—"}
          </p>
          <p className="text-[9px] uppercase tracking-[0.08em] mt-0.5" style={{ color: "#536477" }}>
            Avg Load
          </p>
        </div>
        <div className="rounded-lg p-2 text-center" style={{ background: "rgba(255,255,255,0.02)" }}>
          <p className="text-[13px] font-bold truncate" style={{ color: snap.unread_alerts > 0 ? "#FF5364" : "#EAF2F8" }}>
            {snap.unread_alerts}
          </p>
          <p className="text-[9px] uppercase tracking-[0.08em] mt-0.5" style={{ color: "#536477" }}>
            Unread
          </p>
        </div>
      </div>

      {snap.top_app && (
        <p className="text-[11px] flex items-center gap-1.5 mb-3" style={{ color: "#8493A7" }}>
          <Monitor className="w-3 h-3 shrink-0" />
          <span className="truncate">Top app: <span className="text-[#EAF2F8]">{snap.top_app}</span></span>
        </p>
      )}

      {snap.latest_load === "high" && (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg mb-3"
          style={{ background: "rgba(255,83,100,0.08)", border: "1px solid rgba(255,83,100,0.20)" }}>
          <AlertTriangle className="w-3 h-3 shrink-0" style={{ color: "#FF5364" }} />
          <span className="text-[11px] font-medium" style={{ color: "#FF5364" }}>High cognitive load detected</span>
        </div>
      )}

      <Link
        to={`/admin/employees/${snap.employee_id}`}
        className="flex items-center justify-between w-full px-3 py-2 rounded-lg text-[12px] font-medium transition-all duration-150"
        style={{
          background: "rgba(0,217,232,0.06)",
          border: "1px solid rgba(0,217,232,0.14)",
          color: "#00D9E8",
        }}
        onMouseEnter={e => e.currentTarget.style.background = "rgba(0,217,232,0.12)"}
        onMouseLeave={e => e.currentTarget.style.background = "rgba(0,217,232,0.06)"}
      >
        View Details
        <ChevronRight className="w-3.5 h-3.5" />
      </Link>
    </motion.div>
  )
}

export default function AdminDashboard() {
  const { toast } = useToast()
  const [snapshots, setSnapshots] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const data = await adminAPI.dashboard()
      setSnapshots(data)
    } catch (err) {
      toast("error", err?.message || "Failed to load team data")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [])

  // Derived stats
  const highCount   = snapshots.filter(s => s.latest_load === "high").length
  const activeToday = snapshots.filter(s => s.sessions_today > 0).length
  const alertCount  = snapshots.reduce((sum, s) => sum + s.unread_alerts, 0)

  if (loading) return <SkeletonPage />

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader
          icon={ShieldCheck}
          title="Team Overview"
          subtitle={`Monitoring ${snapshots.length} team member${snapshots.length !== 1 ? "s" : ""}`}
        />
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-medium transition-all"
          style={{
            background: "rgba(0,217,232,0.07)",
            border: "1px solid rgba(0,217,232,0.18)",
            color: "#00D9E8",
          }}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Team Size",      value: snapshots.length, icon: Users,        accent: "#00D9E8" },
          { label: "Active Today",   value: activeToday,      icon: Activity,     accent: "#37D9A0" },
          { label: "High Load Now",  value: highCount,        icon: AlertTriangle, accent: highCount > 0 ? "#FF5364" : "#37D9A0" },
          { label: "Unread Alerts",  value: alertCount,       icon: Bell,         accent: alertCount > 0 ? "#FFB547" : "#536477" },
        ].map(({ label, value, icon: Icon, accent }, i) => (
          <motion.div key={label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="rounded-xl p-4"
            style={{ background: "#0B1420", border: "1px solid rgba(100,170,190,0.14)" }}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.10em]" style={{ color: "#536477" }}>{label}</p>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: `${accent}14`, border: `1px solid ${accent}28` }}>
                <Icon className="w-3.5 h-3.5" style={{ color: accent }} />
              </div>
            </div>
            <p className="text-[1.75rem] font-bold nums" style={{ color: accent === "#536477" ? "#8493A7" : "#EAF2F8" }}>
              {value}
            </p>
          </motion.div>
        ))}
      </div>

      {/* High load banner */}
      {highCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{ background: "rgba(255,83,100,0.08)", border: "1px solid rgba(255,83,100,0.24)" }}>
          <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: "#FF5364" }} />
          <p className="text-[13px]" style={{ color: "#EAF2F8" }}>
            <span className="font-semibold" style={{ color: "#FF5364" }}>{highCount} team member{highCount > 1 ? "s" : ""}</span>
            {" "}currently showing high cognitive load. Consider sending a break reminder.
          </p>
          <Link to="/admin/alerts"
            className="ml-auto text-[12px] font-semibold px-3 py-1.5 rounded-lg shrink-0"
            style={{ background: "rgba(255,83,100,0.15)", color: "#FF5364", border: "1px solid rgba(255,83,100,0.30)" }}>
            Send Alert
          </Link>
        </motion.div>
      )}

      {/* Employee grid */}
      {snapshots.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Users className="w-10 h-10 mb-4" style={{ color: "#536477" }} />
          <p className="text-[15px] font-semibold" style={{ color: "#EAF2F8" }}>No team members yet</p>
          <p className="text-[13px] mt-1" style={{ color: "#536477" }}>
            Go to{" "}
            <Link to="/admin/employees" className="underline" style={{ color: "#00D9E8" }}>Employees</Link>
            {" "}to add your first team member.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {snapshots.map((snap, i) => (
            <SnapshotCard key={snap.employee_id} snap={snap} index={i} />
          ))}
        </div>
      )}
    </div>
  )
}