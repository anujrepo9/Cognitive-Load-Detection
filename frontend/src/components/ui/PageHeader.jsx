/**
 * Page header — refined. Slimmer badge, tighter spacing, refined typography.
 * Used on Live Monitoring / Analytics / Reports / History / Settings / etc.
 */
export function PageHeader({ title, description, actions, badge }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
      <div>
        {badge && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
            bg-indigo-50/80 dark:bg-indigo-500/12 text-indigo-600 dark:text-indigo-300
            text-[11px] font-semibold border border-indigo-200/70 dark:border-indigo-500/20 mb-2">
            {badge}
          </span>
        )}
        <h1 className="text-[1.625rem] font-semibold tracking-[-0.024em]
          text-[#1d1d1f] dark:text-[#f5f5f7] leading-tight">
          {title}
        </h1>
        {description && (
          <p className="text-[13px] text-[#6e6e73] dark:text-[#a1a1a6] mt-1">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0 flex-wrap">{actions}</div>
      )}
    </div>
  )
}

export default PageHeader
