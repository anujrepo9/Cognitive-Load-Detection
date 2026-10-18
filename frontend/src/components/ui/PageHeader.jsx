export function PageHeader({ title, description, actions, badge }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
      <div>
        {badge && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
            bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400
            text-xs font-semibold border border-indigo-100 dark:border-indigo-500/20 mb-2">
            {badge}
          </span>
        )}
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h1>
        {description && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0">{actions}</div>
      )}
    </div>
  )
}
