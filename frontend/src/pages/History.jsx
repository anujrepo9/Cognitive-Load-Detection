import { useState, useEffect } from "react"
import { dashboardAPI } from "../services/api"
import LoadBadge from "../components/ui/LoadBadge"

export default function History() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    dashboardAPI.history(20)
      .then(({ data }) => setSessions(data.sessions || []))
      .catch(() => setSessions([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-xl font-semibold text-gray-100">Session history</h2>

      {loading ? (
        <p className="text-sm text-gray-600">Loading…</p>
      ) : sessions.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
          <p className="text-gray-500 text-sm">No sessions recorded yet.</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                {["Session", "Start", "Duration", "Avg load", "Predictions"].map((h) => (
                  <th key={h} className="text-left px-5 py-3 text-xs text-gray-500
                    font-medium uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sessions.map((s, i) => (
                <tr key={s.session_id || i}
                  className="border-b border-gray-800/50 hover:bg-gray-800/40 transition">
                  <td className="px-5 py-3 text-gray-300 font-mono text-xs">
                    {String(s.session_id || i + 1).slice(0, 8)}
                  </td>
                  <td className="px-5 py-3 text-gray-400">{s.start_time || "—"}</td>
                  <td className="px-5 py-3 text-gray-400">{s.duration || "—"}</td>
                  <td className="px-5 py-3">
                    <LoadBadge level={s.avg_load || "unknown"} />
                  </td>
                  <td className="px-5 py-3 text-gray-400">{s.prediction_count ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
