import { motion } from "framer-motion"

/**
 * Chart card — refined. Removed the heavy `bg-primary/10` icon well in favour
 * of a slimmer treatment with a hairline accent. Subtitle is now in the
 * secondary label colour.
 */
export default function ChartCard({
  title, subtitle, icon: Icon, iconTone = "primary", action, children, className = "",
}) {
  const tone = iconTone === "accent"  ? "bg-violet-50/70 dark:bg-violet-500/10 text-violet-500 dark:text-violet-300"
              : iconTone === "success" ? "bg-emerald-50/70 dark:bg-emerald-500/10 text-emerald-500 dark:text-emerald-300"
              : iconTone === "warning" ? "bg-amber-50/70 dark:bg-amber-500/10 text-amber-500 dark:text-amber-300"
              : "bg-indigo-50/70 dark:bg-indigo-500/10 text-indigo-500 dark:text-indigo-300"

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={`card p-5 ${className}`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${tone}`}>
              <Icon className="w-[18px] h-[18px]" aria-hidden="true" />
            </div>
          )}
          <div>
            <h3 className="text-[13px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]
              tracking-[-0.005em]">
              {title}
            </h3>
            {subtitle && (
              <p className="text-[11px] text-[#86868b] dark:text-[#a1a1a6] mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>
        {action}
      </div>
      {children}
    </motion.div>
  )
}
