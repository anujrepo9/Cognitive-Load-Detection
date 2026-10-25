export function SkeletonCard({ lines = 3, className = "" }) {
  return (
    <div className={`rounded-xl p-5 ${className}`}
      style={{ background: "#0B1420", border: "1px solid rgba(100,170,190,0.10)" }}>
      <div className="skeleton h-3 w-24 mb-4 rounded" />
      <div className="skeleton h-8 w-20 mb-3 rounded" />
      {Array.from({ length: lines - 2 }).map((_, i) => (
        <div key={i} className="skeleton h-2.5 rounded mb-2" style={{ width: `${60 + i * 10}%` }} />
      ))}
    </div>
  )
}

export function SkeletonPage() {
  return (
    <div className="p-4 lg:p-6 space-y-6 animate-fade-in">
      {/* Header skeleton */}
      <div>
        <div className="skeleton h-4 w-20 rounded mb-3" />
        <div className="skeleton h-8 w-48 rounded mb-2" />
        <div className="skeleton h-3 w-72 rounded" />
      </div>
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <SkeletonCard key={i} lines={3} />
        ))}
      </div>
      {/* Main panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SkeletonCard lines={6} className="lg:col-span-2" />
        <SkeletonCard lines={5} />
      </div>
    </div>
  )
}
