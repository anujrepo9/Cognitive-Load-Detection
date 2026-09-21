import { motion } from "framer-motion"

const accentLine = {
  primary: "bg-[#0066FF]",
  accent:  "bg-[#0066FF]",
  success: "bg-[#16A34A]",
  warning: "bg-[#CA8A04]",
  danger:  "bg-[#DC2626]",
}

const accentText = {
  primary: "text-[#0066FF]",
  accent:  "text-[#0066FF]",
  success: "text-[#16A34A]",
  warning: "text-[#CA8A04]",
  danger:  "text-[#DC2626]",
}

export default function StatCard({
  label, value, unit = "", sub, icon: Icon, accent = "primary",
  trend, delta, chart, delay = 0, className = "",
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay }}
      className={`card p-5 relative overflow-hidden ${className}`}
    >
      {/* Top accent line — single 2px rule, the only decoration */}
      <div className={`absolute top-0 left-0 right-0 h-[2px] ${accentLine[accent]}`} />

      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold tracking-widest uppercase
            text-gray-400 dark:text-gray-500 mb-2">
            {label}
          </p>
          <p className="text-[28px] font-semibold tracking-tight
            text-gray-900 dark:text-white leading-none">
            {value}
            {unit && (
              <span className="text-base font-normal text-gray-400 ml-1">{unit}</span>
            )}
          </p>
        </div>
        {Icon && (
          <Icon className={`w-4 h-4 mt-1 shrink-0 ${accentText[accent]}`}
            aria-hidden="true" />
        )}
      </div>

      {(sub || trend != null) && (
        <div className="flex items-center gap-2 mt-3">
          {trend != null && (
            <span className={`text-[11px] font-semibold
              ${trend >= 0 ? "text-[#16A34A]" : "text-[#DC2626]"}`}>
              {trend >= 0 ? "↑" : "↓"} {Math.abs(trend)}%
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
