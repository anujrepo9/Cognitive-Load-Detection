import { motion } from "framer-motion"

export default function EmptyState({
  icon: Icon, title, description, action, className = "",
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`flex flex-col items-center justify-center text-center
        py-16 px-6 ${className}`}
    >
      {Icon && (
        <div className="w-16 h-16 rounded-2xl bg-primary/10 dark:bg-primary/20
          flex items-center justify-center mb-4">
          <Icon className="w-8 h-8 text-primary" />
        </div>
      )}
      <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1.5">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mb-5">
          {description}
        </p>
      )}
      {action}
    </motion.div>
  )
}
