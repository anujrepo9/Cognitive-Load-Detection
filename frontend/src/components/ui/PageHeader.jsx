/**
 * Reusable page-header primitive.
 *
 * Usage:
 *   <PageHeader title="Dashboard" subtitle="Your cognitive load at a glance">
 *     <button>Action</button>
 *   </PageHeader>
 */
import { motion } from "framer-motion"

export function PageHeader({ title, subtitle, children, className = "" }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={`flex flex-wrap items-center justify-between gap-4 ${className}`}
    >
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h1>
        {subtitle && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>
        )}
      </div>
      {children && <div className="flex items-center gap-2 flex-wrap">{children}</div>}
    </motion.div>
  )
}

export default PageHeader
