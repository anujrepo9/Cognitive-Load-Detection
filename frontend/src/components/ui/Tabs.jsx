/**
 * Refined tab primitive — uses Apple-style pill tabs with a softer active
 * state (tinted background + matching text), instead of the old solid
 * indigo button. Inactive text is brighter in dark mode for readability.
 *
 * Usage:
 *   <Tabs tabs={[{key:"a",label:"Tab A"},{key:"b",label:"Tab B"}]}
 *         active={active} onChange={setActive} />
 *   {active === "a" && <TabContent />}
 */
export function Tabs({ tabs = [], active, onChange, className = "" }) {
  return (
    <div role="tablist" aria-label="Tabs" className={`flex gap-2 ${className}`}>
      {tabs.map(({ key, label, icon: Icon }) => {
        const isActive = active === key
        return (
          <button
            key={key}
            type="button"
            role="tab"
            id={`tab-${key}`}
            aria-selected={isActive}
            aria-controls={`tabpanel-${key}`}
            onClick={() => onChange(key)}
            className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full
              text-[13px] font-semibold tracking-[-0.005em] capitalize
              transition-all duration-150 focus-visible:outline-none
              focus-visible:ring-2 focus-visible:ring-indigo-500/40
              ${isActive
                ? "bg-indigo-100/90 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-200"
                : "bg-[#f5f5f7]/80 dark:bg-white/5 text-[#6e6e73] dark:text-[#a1a1a6] hover:bg-[#ebebf0] dark:hover:bg-white/10 hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7]"
              }`}>
            {Icon && (
              <Icon className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            {label}
          </button>
        )
      })}
    </div>
  )
}

export function TabPanel({ id, active, children }) {
  return (
    <div
      id={`tabpanel-${id}`}
      role="tabpanel"
      aria-labelledby={`tab-${id}`}
      hidden={active !== id}
    >
      {active === id && children}
    </div>
  )
}

export default Tabs
