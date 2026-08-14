import { AlertTriangle, CheckCircle2, CirclePause, Radio, RefreshCw, WifiOff } from "lucide-react"
import { useTracking } from "../../context/TrackingContext"

export default function TrackingStatus() {
  const { trackingState, quality, backendStatus, websocketStatus, networkOnline, error, retry } = useTracking()
  const qualityLabel = trackingState === "idle" ? "Waiting to start" : quality.ready ? "Ready" : `${quality.keyEvents}/5 key events`
  const trackerLabel = trackingState === "tracking" ? "Tracking" : trackingState === "paused" ? "Paused" : trackingState === "ending" ? "Ending" : "Not tracking"
  return <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
    <div className="grid gap-3 sm:grid-cols-3 text-sm">
      <div><p className="text-xs text-gray-400">Tracker</p><p className="mt-1 flex items-center gap-1.5 font-semibold text-gray-800 dark:text-white">{trackingState === "paused" ? <CirclePause className="w-4 h-4 text-warning" /> : <Radio className="w-4 h-4 text-primary" />}{trackerLabel}</p></div>
      <div><p className="text-xs text-gray-400">Data quality</p><p className="mt-1 font-semibold text-gray-800 dark:text-white">{qualityLabel}</p><p className="text-xs text-gray-400">{quality.mouseEvents} mouse events</p></div>
      <div><p className="text-xs text-gray-400">Connection</p><p className="mt-1 flex items-center gap-1.5 font-semibold text-gray-800 dark:text-white">{!networkOnline ? <WifiOff className="w-4 h-4 text-danger" /> : <CheckCircle2 className="w-4 h-4 text-success" />}{!networkOnline ? "Offline" : backendStatus === "online" ? `Backend online · ${websocketStatus}` : "Checking backend"}</p></div>
    </div>
    {error && <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger"><span className="flex gap-2"><AlertTriangle className="mt-0.5 w-4 h-4 shrink-0" />{error}</span><button onClick={retry} className="inline-flex shrink-0 items-center gap-1 font-semibold"><RefreshCw className="w-3.5 h-3.5" /> Retry</button></div>}
  </div>
}
