import { ShieldCheck } from "lucide-react"
import { useTracking } from "../../context/TrackingContext"

export default function TrackingConsentDialog() {
  const { consentOpen, acceptConsent, dismissConsent } = useTracking()
  if (!consentOpen) return null
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="tracking-consent-title">
    <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">
      <ShieldCheck className="mb-3 h-8 w-8 text-primary" />
      <h2 id="tracking-consent-title" className="text-lg font-bold text-gray-900 dark:text-white">Allow behavioral tracking?</h2>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">CogniLoad measures interaction patterns to estimate cognitive load. It sends aggregate timing, count, duration, mouse movement, scroll, and idle metrics.</p>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Typed text, passwords, message content, and actual key values are never sent. Key events are used only in the browser to calculate aggregate timing and count metrics.</p>
      <div className="mt-5 flex justify-end gap-3"><button onClick={dismissConsent} className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-600 dark:text-gray-300">Cancel</button><button onClick={acceptConsent} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white">I agree and start</button></div>
    </div>
  </div>
}
