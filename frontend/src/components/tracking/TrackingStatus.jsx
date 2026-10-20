import { AlertTriangle, CheckCircle2, CirclePause, Radio, RefreshCw, WifiOff } from "lucide-react"
import { useTracking } from "../../context/TrackingContext"

/**
 * Tracking status — refined glass status panel.
 * - Removed the heavy slate background; uses the new card surface.
 * - Tighter spacing, refined label hierarchy.
 * - Maintains the same semantic structure (tracker / data quality / connection).
 */
export default function TrackingStatus() {
  const {
    trackingState, quality, backendStatus, websocketStatus, networkOnline,
    error, retry, collectorRunning, collectorError,
  } = useTracking()

  const qualityLabel = trackingState === "idle"
    ? "Waiting to start"
    : collectorRunning
      ? "Windows agent (all apps)"
      : quality.ready
        ? "This browser tab only"
        : `${quality.keyEvents}/1 key events`

  const trackerLabel = trackingState === "tracking" ? "Tracking"
    : trackingState === "paused"  ? "Paused"
    : trackingState === "ending"  ? "Ending…"
    : trackingState === "starting" ? "Starting…"
    : "Not tracking"

  const connectionLabel = !networkOnline
    ? "Offline"
    : backendStatus === "online"
      ? `Backend online · ${websocketStatus}`
      : "Checking backend…"

  return (
    <div className="card p-4">
      <div className="grid gap-3 sm:grid-cols-3 text-sm">
        {/* Tracker state */}
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-[#86868b] dark:text-[#a1a1a6]">
            Tracker
          </p>
          <p className="mt-1.5 flex items-center gap-1.5 font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.005em]">
            {trackingState === "paused"
              ? <CirclePause className="w-4 h-4 text-amber-500 dark:text-amber-300" />
              : <Radio className={`w-4 h-4 ${trackingState === "tracking" ? "text-indigo-500 animate-pulse" : "text-[#86868b] dark:text-[#a1a1a6]"}`} />}
            {trackerLabel}
          </p>
        </div>

        {/* Data quality */}
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-[#86868b] dark:text-[#a1a1a6]">
            Data quality
          </p>
          <p className="mt-1.5 font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.005em]">{qualityLabel}</p>
          <p className="text-[11px] text-[#86868b] dark:text-[#a1a1a6] mt-0.5">
            {collectorRunning
              ? "Keyboard and mouse across the whole PC"
              : `${quality.mouseEvents} mouse events in this tab`}
          </p>
          {trackingState === "tracking" && !collectorRunning && collectorError && (
            <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-400">
              System collector failed, so only this tab is measured. {collectorError}
            </p>
          )}
        </div>

        {/* Connection */}
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-[#86868b] dark:text-[#a1a1a6]">
            Connection
          </p>
          <p className="mt-1.5 flex items-center gap-1.5 font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-[-0.005em]">
            {!networkOnline
              ? <WifiOff className="w-4 h-4 text-red-500 dark:text-red-300" />
              : <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-300" />}
            {connectionLabel}
          </p>
        </div>
      </div>

      {error && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-lg
          bg-red-50/80 dark:bg-red-500/10 border border-red-200/80 dark:border-red-500/20
          px-3 py-2 text-sm text-red-700 dark:text-red-300">
          <span className="flex gap-2">
            <AlertTriangle className="mt-0.5 w-4 h-4 shrink-0" aria-hidden="true" />
            {error}
          </span>
          <button
            onClick={retry}
            className="inline-flex shrink-0 items-center gap-1 font-semibold hover:underline">
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      )}
    </div>
  )
}
