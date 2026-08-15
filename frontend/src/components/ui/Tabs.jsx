/**
 * Reusable tab primitive.
 *
 * Usage:
 *   <Tabs tabs={[{key:"a",label:"Tab A"},{key:"b",label:"Tab B"}]}
 *         active={active} onChange={setActive} />
 *   {active === "a" && <TabContent />}
 */
export function Tabs({ tabs = [], active, onChange, className = "" }) {
  return (
    <div role="tablist" aria-label="Tabs" className={`flex gap-2 ${className}`}>
      {tabs.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          role="tab"
          id={`tab-${key}`}
          aria-selected={active === key}
          aria-controls={`tabpanel-${key}`}
          onClick={() => onChange(key)}
          className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold
            capitalize transition-all focus-visible:outline-none focus-visible:ring-2
            focus-visible:ring-primary/50
            ${active === key
              ? "bg-primary text-white shadow-glow-primary"
              : "bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-700"}`}
        >
          {Icon && <Icon className="w-4 h-4" aria-hidden="true" />}
          {label}
        </button>
      ))}
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
