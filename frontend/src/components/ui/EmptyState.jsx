import { motion } from "framer-motion"

export default function EmptyState({
  icon: Icon, title, description, action, className = "",
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className={`flex flex-col items-center justify-center text-center
        py-16 px-6 ${className}`}
    >
      {Icon && (
        <div className="w-10 h-10 border border-[#E5E5E5] dark:border-[#2A2A2A]
          flex items-center justify-center mb-5">
          <Icon className="w-5 h-5 text-gray-300 dark:text-gray-600" />
        </div>
      )}
      <h3 className="text-[13px] font-semibold text-gray-900 dark:text-white mb-1">
        {title}
      </h3>
      {description && (
        <p className="text-[13px] text-gray-400 max-w-xs mb-5 leading-relaxed">
          {description}
        </p>
      )}
      {action}
    </motion.div>
  )
}
