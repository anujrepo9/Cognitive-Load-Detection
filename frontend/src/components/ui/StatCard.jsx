import { motion } from "framer-motion"
import { TrendingUp, TrendingDown } from "lucide-react"

/* Refined palette per accent. We removed the loud top-gradient bar — it read
 * as a generic admin template. Instead each accent uses a soft, monochrome
 * tinted chip and a 2px left accent stripe that fades in on hover. */
const accentConfig = {
  primary: {
    chipBg:    "bg-indigo-50 dark:bg-indigo-500/10",
    chipColor: "text-indigo-600 dark:text-indigo-300",
    stripe:    "bg-indigo-500",
    trendPos:  "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10",
    trendNeg:  "text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-500/10",
  },
  accent: {
    chipBg:    "bg-violet-50 dark:bg-violet-500/10",
    chipColor: "text-violet-600 dark:text-violet-300",
    stripe:    "bg-violet-500",
    trendPos:  "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10",
    trendNeg:  "text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-500/10",
  },
  success: {
    chipBg:    "bg-emerald-50 dark:bg-emerald-500/10",
    chipColor: "text-emerald-600 dark:text-emerald-300",
    stripe:    "bg-emerald-500",
    trendPos:  "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10",
    trendNeg:  "text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-500/10",
  },
  warning: {
    chipBg:    "bg-amber-50 dark:bg-amber-500/10",
    chipColor: "text-amber-600 dark:text-amber-300",
    stripe:    "bg-amber-500",
    trendPos:  "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10",
    trendNeg:  "text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-500/10",
  },
  danger: {
    chipBg:    "bg-red-50 dark:bg-red-500/10",
    chipColor: "text-red-600 dark:text-red-300",
    stripe:    "bg-red-500",
    trendPos:  "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10",
    trendNeg:  "text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-500/10",
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
      transition={{ duration: 0.32, delay, ease: [0.22, 1, 0.36, 1] }}
      className={`card-hover p-5 relative overflow-hidden group ${className}`}
    >
      {/* Left accent stripe — appears on hover only, very subtle */}
      <span
        aria-hidden="true"
        className={`absolute left-0 top-4 bottom-4 w-[2px] rounded-full ${cfg.stripe}
          opacity-0 group-hover:opacity-100 transition-opacity duration-200`}
      />

      <div className="flex items-start justify-between gap-3 relative">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-medium tracking-wide uppercase
            text-[#86868b] dark:text-[#a1a1a6] mb-3">
            {label}
          </p>
          <p className="font-rounded text-[1.75rem] font-semibold tracking-[-0.022em]
            text-[#1d1d1f] dark:text-[#f5f5f7] leading-none nums">
            {value}
            {unit && (
              <span className="ml-1 text-[0.875rem] font-medium text-[#86868b] dark:text-[#a1a1a6]">
                {unit}
              </span>
            )}
          </p>
        </div>
        {Icon && (
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${cfg.chipBg}
            transition-transform duration-200 group-hover:scale-[1.04]`}>
            <Icon className={`w-[18px] h-[18px] ${cfg.chipColor}`} aria-hidden="true" />
          </div>
        )}
      </div>

      {(sub || trend != null) && (
        <div className="flex items-center gap-2 mt-3 relative">
          {trend != null && (
            <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-md
              ${trend >= 0 ? cfg.trendPos : cfg.trendNeg}`}>
              {trend >= 0
                ? <TrendingUp className="w-3 h-3" />
                : <TrendingDown className="w-3 h-3" />}
              {Math.abs(trend)}%
            </span>
          )}
          {sub && (
            <span className="text-[11px] text-[#86868b] dark:text-[#a1a1a6] truncate">
              {sub}
            </span>
          )}
        </div>
      )}

      {delta != null && (
        <p className="text-[11px] text-[#86868b] dark:text-[#a1a1a6] mt-1 nums">
          {delta >= 0 ? "+" : ""}{delta} vs last period
        </p>
      )}

      {chart}
    </motion.div>
  )
}
