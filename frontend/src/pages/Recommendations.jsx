import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import {
  Coffee, Droplets, Focus, Type, BellOff, Scissors, TrendingDown,
  Lightbulb, Sparkles,
} from "lucide-react"
import { dashboardAPI } from "../services/api"
import EmptyState from "../components/ui/EmptyState"
import { SkeletonPage } from "../components/ui/Skeleton"

const iconMap = {
  break:      { icon: Coffee, color: "bg-teal-500/10 text-teal-500" },
  water:      { icon: Droplets, color: "bg-blue-500/10 text-blue-500" },
  focus:      { icon: Focus, color: "bg-violet-500/10 text-violet-500" },
  font:       { icon: Type, color: "bg-indigo-500/10 text-indigo-500" },
  notify:     { icon: BellOff, color: "bg-amber-500/10 text-amber-500" },
  simplify:   { icon: Scissors, color: "bg-rose-500/10 text-rose-500" },
  difficulty: { icon: TrendingDown, color: "bg-emerald-500/10 text-emerald-500" },
}

export default function Recommendations() {
  const [recs, setRecs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    dashboardAPI.recommendation()
      .then(({ data }) => setRecs(data.recommendations || []))
      .catch(() => setRecs([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <SkeletonPage />

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Recommendations</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Personalized suggestions based on your cognitive load
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full
          bg-primary/10 text-primary text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5" /> AI generated
        </span>
      </motion.div>

      {recs.length === 0 ? (
        <div className="card">
          <EmptyState icon={Lightbulb} title="No recommendations yet"
            description="Keep using the app so the model can learn your patterns and suggest improvements." />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {recs.map((rec, i) => {
            const { icon: Icon, color } = iconMap[rec.type] || iconMap.break
            return (
              <motion.div key={i}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className="card p-5 flex gap-4 hover:-translate-y-1 transition-transform">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                    {rec.title}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                    {rec.reason}
                  </p>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
