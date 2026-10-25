import { useState } from "react"
import { useAuthFetch } from "../hooks/useAuthFetch"
import { motion } from "framer-motion"
import {
  Coffee, Droplets, Focus, Type, BellOff, Scissors, TrendingDown,
  Lightbulb, Sparkles, Check, AlertCircle,
} from "lucide-react"
import { dashboardAPI, getErrorMessage } from "../services/api"
import EmptyState from "../components/ui/EmptyState"
import { SkeletonPage } from "../components/ui/Skeleton"

const iconMap = {
  break:      { icon: Coffee,       bg: "rgba(0,191,166,0.10)",   color: "#00BFA6",  border: "rgba(0,191,166,0.22)" },
  water:      { icon: Droplets,     bg: "rgba(0,217,232,0.10)",   color: "#00D9E8",  border: "rgba(0,217,232,0.22)" },
  focus:      { icon: Focus,        bg: "rgba(119,117,255,0.10)", color: "#7775FF",  border: "rgba(119,117,255,0.22)" },
  font:       { icon: Type,         bg: "rgba(0,217,232,0.10)",   color: "#00D9E8",  border: "rgba(0,217,232,0.22)" },
  notify:     { icon: BellOff,      bg: "rgba(255,181,71,0.10)",  color: "#FFB547",  border: "rgba(255,181,71,0.22)" },
  simplify:   { icon: Scissors,     bg: "rgba(255,83,100,0.10)",  color: "#FF5364",  border: "rgba(255,83,100,0.22)" },
  difficulty: { icon: TrendingDown, bg: "rgba(55,217,160,0.10)",  color: "#37D9A0",  border: "rgba(55,217,160,0.22)" },
}

export default function Recommendations() {
  const [recs,      setRecs]      = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)
  const [acked,     setAcked]     = useState(new Set())
  const [completed, setCompleted] = useState(new Set())

  useAuthFetch(() => {
    dashboardAPI.recommendation()
      .then((data) => setRecs(data.recommendations || []))
      .catch((err) => setError(getErrorMessage(err, "Could not load recommendations.")))
      .finally(() => setLoading(false))
  }, [])

  const acknowledge = (idx) => setAcked((prev) => new Set([...prev, idx]))
  const complete    = (idx) => setCompleted((prev) => new Set([...prev, idx]))

  if (loading) return <SkeletonPage />

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="live-dot w-1.5 h-1.5 rounded-full" style={{ background: "#00D9E8" }} />
            <span className="text-[10px] font-semibold tracking-[0.10em] uppercase" style={{ color: "#536477" }}>AI Engine</span>
          </div>
          <h1 style={{ color: "#EAF2F8" }}>Recommendations</h1>
          <p className="text-sm mt-1" style={{ color: "#8493A7" }}>
            Actionable suggestions based on your current cognitive load
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
          style={{ background: "rgba(119,117,255,0.10)", border: "1px solid rgba(119,117,255,0.25)", color: "#7775FF" }}>
          <Sparkles className="w-3.5 h-3.5" /> Rule-based engine
        </span>
      </motion.div>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl px-4 py-3 text-sm"
          style={{ background: "rgba(255,83,100,0.10)", border: "1px solid rgba(255,83,100,0.25)", color: "#FF5364" }}>
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /><span>{error}</span>
        </div>
      )}

      {!error && recs.length === 0 && (
        <div className="rounded-xl" style={{ background: "#0B1420", border: "1px solid rgba(100,170,190,0.14)" }}>
          <EmptyState icon={Lightbulb} title="No recommendations yet"
            description="Keep using the app so the system can analyse your patterns and suggest improvements." />
        </div>
      )}

      {recs.length > 0 && (
        <>
          <div className="flex gap-3 text-sm" style={{ color: "#8493A7" }}>
            <span>{recs.length} suggestion{recs.length !== 1 ? "s" : ""}</span>
            {acked.size > 0 && <span>· {acked.size} acknowledged</span>}
            {completed.size > 0 && <span>· {completed.size} completed</span>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {recs.map((rec, i) => {
              const cfg = iconMap[rec.type] || iconMap.break
              const Icon = cfg.icon
              const isAcked     = acked.has(i)
              const isCompleted = completed.has(i)

              return (
                <motion.div key={i}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: i * 0.05 }}
                  className="p-5 flex gap-4 rounded-xl transition-all"
                  style={{
                    background: "#0B1420",
                    border: "1px solid rgba(100,170,190,0.14)",
                    opacity: isCompleted ? 0.55 : 1,
                  }}
                  onMouseEnter={e => { if (!isCompleted) { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.borderColor = "rgba(0,217,232,0.22)" } }}
                  onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.borderColor = "rgba(100,170,190,0.14)" }}>
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                    <Icon className="w-5 h-5" style={{ color: cfg.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold mb-1" style={{ color: "#EAF2F8" }}>{rec.title}</p>
                    <p className="text-xs leading-relaxed mb-3" style={{ color: "#8493A7" }}>{rec.reason}</p>
                    {isCompleted ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: "#37D9A0" }}>
                        <Check className="w-3.5 h-3.5" /> Completed
                      </span>
                    ) : isAcked ? (
                      <div className="flex gap-2 items-center">
                        <span className="text-xs" style={{ color: "#536477" }}>Acknowledged</span>
                        <button onClick={() => complete(i)} className="text-xs font-semibold transition-colors" style={{ color: "#37D9A0" }}
                          onMouseEnter={e => e.currentTarget.style.opacity = "0.7"} onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
                          Mark done
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => acknowledge(i)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold transition-colors"
                        style={{ color: "#00D9E8" }}>
                        <Check className="w-3.5 h-3.5" /> Acknowledge
                      </button>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
