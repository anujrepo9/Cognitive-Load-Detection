/**
 * Reusable page-header primitive — Swiss/Minimal edition.
 * Strict typographic hierarchy, no decoration.
 */
import { motion } from "framer-motion"

export function PageHeader({ title, subtitle, children, className = "" }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className={`flex flex-wrap items-start justify-between gap-4
        pb-5 mb-6 border-b border-[#E5E5E5] dark:border-[#1E1E1E] ${className}`}
    >
      <div>
        <h1 className="text-xl font-semibold tracking-tight
          text-gray-900 dark:text-white leading-none">
          {title}
        </h1>
        {subtitle && (
          <p className="text-[13px] text-gray-400 dark:text-gray-500 mt-1.5 leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>
      {children && (
        <div className="flex items-center gap-2 flex-wrap">
          {children}
        </div>
      )}
    </motion.div>
  )
}

export default PageHeader
