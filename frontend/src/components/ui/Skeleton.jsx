/**
 * Skeleton — refined. Uses the new `.skeleton` component class (which has its
 * own shimmer), aligned with the new card radius. SkeletonPage reflects the
 * redesigned Dashboard layout:
 *   1. Header
 *   2. Hero band — gauge + 2×2 mini-metrics
 *   3. Main grid — chart (2/3) + session overview (1/3)
 *   4. Load distribution (full width)
 * The previously separate 4-card stat row is gone, so the skeleton mirrors
 * the new arrangement.
 */
export function Skeleton({ className = "" }) {
  return <div className={`skeleton ${className}`} />
}

export function SkeletonCard({ className = "" }) {
  return (
    <div className={`card p-5 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-9 w-9 rounded-xl" />
      </div>
      <Skeleton className="h-9 w-28 mb-2" />
      <Skeleton className="h-3 w-36" />
    </div>
  )
}

export function SkeletonPage() {
  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* 1. Page header */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-7 w-48 mb-2" />
          <Skeleton className="h-3 w-64" />
        </div>
        <Skeleton className="h-10 w-32 rounded-full" />
      </div>

      {/* 2. Tracking status strip */}
      <div className="card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i}>
              <Skeleton className="h-3 w-16 mb-2" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      </div>

      {/* 3. Hero band — gauge + 2×2 mini-metrics */}
      <div className="card p-6 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-center">
          <div className="lg:col-span-2 flex items-center justify-center">
            <Skeleton className="w-[260px] h-[260px] rounded-full" />
          </div>
          <div className="lg:col-span-3 space-y-5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-full max-w-md" />
            <div className="grid grid-cols-2 gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="rounded-xl border border-[#e5e5ea]/70 dark:border-white/5 p-3.5">
                  <Skeleton className="h-3 w-16 mb-2" />
                  <Skeleton className="h-5 w-20" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Main grid — chart (2/3) + session overview (1/3) */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="card p-5 xl:col-span-2">
          <Skeleton className="h-4 w-40 mb-4" />
          <Skeleton className="h-[280px] w-full" />
        </div>
        <div className="card p-5">
          <Skeleton className="h-4 w-32 mb-4" />
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 5. Load distribution (full width) */}
      <div className="card p-5">
        <Skeleton className="h-4 w-32 mb-4" />
        <div className="grid grid-cols-3 gap-4 max-w-3xl">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-xl border border-[#e5e5ea]/70 dark:border-white/5 p-4">
              <Skeleton className="h-3 w-12 mx-auto mb-2" />
              <Skeleton className="h-8 w-20 mx-auto mb-2" />
              <Skeleton className="h-1.5 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Skeleton
