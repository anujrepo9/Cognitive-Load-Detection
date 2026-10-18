import { motion } from "framer-motion"
import { TrendingUp, TrendingDown } from "lucide-react"

const accentConfig = {
  primary: {
    iconBg: "bg-indigo-50 dark:bg-indigo-500/10",
    iconColor: "text-indigo-500",
    borderTop: "from-indigo-500 to-violet-500",
    trendPos: "text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10",
    trendNeg: "text-red-600 bg-red-50 dark:bg-red-500/10",
  },
  accent: {
    iconBg: "bg-violet-50 dark:bg-violet-500/10",
    iconColor: "text-violet-500",
    borderTop: "from-violet-500 to-purple-500",
    trendPos: "text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10",
    trendNeg: "text-red-600 bg-red-50 dark:bg-red-500/10",
  },
  success: {
    iconBg: "bg-emerald-50 dark:bg-emerald-500/10",
    iconColor: "text-emerald-500",
    borderTop: "from-emerald-500 to-teal-500",
    trendPos: "text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10",
    trendNeg: "text-red-600 bg-red-50 dark:bg-red-500/10",
  },
  warning: {
    iconBg: "bg-amber-50 dark:bg-amber-500/10",
    iconColor: "text-amber-500",
    borderTop: "from-amber-500 to-orange-500",
    trendPos: "text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10",
    trendNeg: "text-red-600 bg-red-50 dark:bg-red-500/10",
  },
  danger: {
    iconBg: "bg-red-50 dark:bg-red-500/10",
    iconColor: "text-red-500",
    borderTop: "from-red-500 to-rose-500",
    trendPos: "text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10",
    trendNeg: "text-red-600 bg-red-50 dark:bg-red-500/10",
  },
}

export default function StatCard({
  label, value, unit = "", sub, icon: Icon, accent = "primary",
  trend, delta, chart, delay = 0, className = "",
}) {
  const cfg = accentConfig[accent] || accentConfig.primary

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay, ease: "easeOut" }}
      className={`card p-5 relative overflow-hidden group hover:border-gray-300 dark:hover:border-gray-700 transition-all duration-200 ${className}`}
    >
      {/* Top gradient accent */}
      <div className={`absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r ${cfg.borderTop}`} />

      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3">
            {label}
          </p>
          <p className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white leading-none">
            {value}
            {unit && (
              <span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>
            )}
          </p>
        </div>
        {Icon && (
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${cfg.iconBg}
            group-hover:scale-110 transition-transform duration-200`}>
            <Icon className={`w-4.5 h-4.5 w-[18px] h-[18px] ${cfg.iconColor}`} aria-hidden="true" />
          </div>
        )}
      </div>

      {(sub || trend != null) && (
        <div className="flex items-center gap-2 mt-3">
          {trend != null && (
            <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-md
              ${trend >= 0 ? cfg.trendPos : cfg.trendNeg}`}>
              {trend >= 0
                ? <TrendingUp className="w-3 h-3" />
                : <TrendingDown className="w-3 h-3" />}
              {Math.abs(trend)}%
            </span>
          )}
          {sub && <span className="text-[11px] text-gray-400">{sub}</span>}
        </div>
      )}

      {delta != null && (
        <p className="text-[11px] text-gray-400 mt-1">
          {delta >= 0 ? "+" : ""}{delta} vs last period
        </p>
      )}

      {chart}
    </motion.div>
  )
}
