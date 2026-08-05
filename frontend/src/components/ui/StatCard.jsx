import { motion } from "framer-motion"

const accentMap = {
  primary: "from-primary/15 to-primary/5",
  accent:  "from-accent/15 to-accent/5",
  success: "from-success/15 to-success/5",
  warning: "from-warning/15 to-warning/5",
  danger:  "from-danger/15 to-danger/5",
}

const iconMap = {
  primary: "bg-primary/10 text-primary",
  accent:  "bg-accent/10 text-accent",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger:  "bg-danger/10 text-danger",
}

export default function StatCard({
  label, value, unit = "", sub, icon: Icon, accent = "primary",
  trend, delta, chart, delay = 0, className = "",
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className={`card p-5 overflow-hidden ${className}`}
    >
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r opacity-60 ${accentMap[accent]}`} />

      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400
            uppercase tracking-wider">{label}</p>
          <p className="mt-1.5 text-2xl font-bold text-gray-900 dark:text-white">
            {value}
            {unit && <span className="text-sm text-gray-400 font-medium ml-1">{unit}</span>}
          </p>
        </div>
        {Icon && (
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconMap[accent]}`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>

      {(sub || trend != null) && (
        <div className="flex items-center gap-2">
          {trend != null && (
            <span className={`text-xs font-semibold inline-flex items-center gap-0.5
              ${trend >= 0 ? "text-success" : "text-danger"}`}>
              {trend >= 0 ? "↑" : "↓"} {Math.abs(trend)}%
            </span>
          )}
          {sub && <span className="text-xs text-gray-400">{sub}</span>}
        </div>
      )}

      {delta != null && (
        <span className="text-xs font-medium text-gray-400">
          {delta >= 0 ? "+" : ""}{delta} vs last period
        </span>
      )}

      {chart}
    </motion.div>
  )
}
