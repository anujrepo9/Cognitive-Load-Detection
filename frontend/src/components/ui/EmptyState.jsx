import { motion } from "framer-motion"

/**
 * Empty state — softer, more elegant. Replaced the square box with a
 * circular soft-tinted icon well + a refined layout. Removed the heavy
 * hairline border that read as "data table empty cell".
 */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className = "",
  tone = "neutral",   // "neutral" | "primary"
}) {
  const iconWell = tone === "primary"
    ? "bg-indigo-50/70 dark:bg-indigo-500/10 text-indigo-500 dark:text-indigo-300"
    : "bg-[#f5f5f7]/80 dark:bg-white/5 text-[#86868b] dark:text-[#a1a1a6]"

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      className={`flex flex-col items-center justify-center text-center
        py-14 px-6 ${className}`}
    >
      {Icon && (
        <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${iconWell}`}>
          <Icon className="w-5 h-5" aria-hidden="true" />
        </div>
      )}
      <h3 className="text-[13px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] mb-1 tracking-[-0.005em]">
        {title}
      </h3>
      {description && (
        <p className="text-[13px] text-[#86868b] dark:text-[#a1a1a6]
          max-w-xs mb-5 leading-relaxed">
          {description}
        </p>
      )}
      {action}
    </motion.div>
  )
}
