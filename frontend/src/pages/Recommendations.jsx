import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import {
  Coffee, Droplets, Focus, Type, BellOff, Scissors, TrendingDown,
  Lightbulb, Sparkles, Check, AlertCircle,
} from "lucide-react"
import { dashboardAPI, getErrorMessage } from "../services/api"
import EmptyState from "../components/ui/EmptyState"
import { SkeletonPage } from "../components/ui/Skeleton"

const iconMap = {
  break:      { icon: Coffee,       color: "bg-teal-500/10 text-teal-500"    },
  water:      { icon: Droplets,     color: "bg-blue-500/10 text-blue-500"    },
  focus:      { icon: Focus,        color: "bg-violet-500/10 text-violet-500" },
  font:       { icon: Type,         color: "bg-indigo-500/10 text-indigo-500" },
  notify:     { icon: BellOff,      color: "bg-amber-500/10 text-amber-500"  },
  simplify:   { icon: Scissors,     color: "bg-rose-500/10 text-rose-500"    },
  difficulty: { icon: TrendingDown, color: "bg-emerald-500/10 text-emerald-500" },
}

export default function Recommendations() {
  const [recs,     setRecs]     = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)
  // Track which recommendations have been acknowledged
  const [acked,    setAcked]    = useState(new Set())
  const [completed, setCompleted] = useState(new Set())

  useEffect(() => {
    dashboardAPI.recommendation()
      .then(({ data }) => setRecs(data.recommendations || []))
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Recommendations</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Actionable suggestions based on your current cognitive load
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full
          bg-primary/10 text-primary text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5" aria-hidden="true" /> Rule-based engine
        </span>
      </motion.div>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl bg-red-50
          dark:bg-red-900/20 border border-red-200 dark:border-red-800
          px-4 py-3 text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!error && recs.length === 0 && (
        <div className="card">
          <EmptyState icon={Lightbulb} title="No recommendations yet"
            description="Keep using the app so the system can analyse your patterns and suggest improvements." />
        </div>
      )}

      {recs.length > 0 && (
        <>
          {/* Summary row */}
          <div className="flex gap-3 text-sm text-gray-500 dark:text-gray-400">
            <span>{recs.length} suggestion{recs.length !== 1 ? "s" : ""}</span>
            {acked.size > 0 && <span>· {acked.size} acknowledged</span>}
            {completed.size > 0 && <span>· {completed.size} completed</span>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {recs.map((rec, i) => {
              const { icon: Icon, color } = iconMap[rec.type] || iconMap.break
              const isAcked     = acked.has(i)
              const isCompleted = completed.has(i)

              return (
                <motion.div key={i}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: i * 0.05 }}
                  className={`card p-5 flex gap-4 transition-all
                    ${isCompleted ? "opacity-60" : "hover:-translate-y-1"}`}>
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${color}`}
                    aria-hidden="true">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                      {rec.title}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mb-3">
                      {rec.reason}
                    </p>
                    {/* Status feedback */}
                    {isCompleted ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                        <Check className="w-3.5 h-3.5" /> Completed
                      </span>
                    ) : isAcked ? (
                      <div className="flex gap-2">
                        <span className="text-xs text-gray-400">Acknowledged</span>
                        <button onClick={() => complete(i)}
                          className="text-xs font-semibold text-success hover:underline">
                          Mark done
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => acknowledge(i)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold
                          text-primary hover:underline">
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
