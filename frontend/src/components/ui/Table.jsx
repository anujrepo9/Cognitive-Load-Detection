/**
 * Reusable table — Swiss/Minimal edition.
 * Tight rows, hairline borders, no background fills.
 */
import { Loader2 } from "lucide-react"
import EmptyState from "./EmptyState"

export function Table({ columns = [], rows = [], keyField = "id", loading = false, emptyIcon, emptyTitle, emptyDesc }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" role="table">
        <thead>
          <tr className="border-b-2 border-[#0A0A0A] dark:border-white">
            {columns.map(({ key, label, tip, className = "" }) => (
              <th key={key} scope="col"
                className={`text-left px-4 py-2.5 text-[10px] font-semibold
                  uppercase tracking-widest text-gray-500 dark:text-gray-400
                  ${className}`}
                title={tip}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center">
                <Loader2 className="w-4 h-4 animate-spin text-[#0066FF] mx-auto" aria-label="Loading" />
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length}>
                {emptyTitle
                  ? <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDesc} />
                  : <p className="text-center text-[13px] text-gray-400 py-12">No data.</p>}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={row[keyField] ?? i}
                className="border-b border-[#F0F0F0] dark:border-[#1A1A1A]
                  hover:bg-gray-50 dark:hover:bg-[#111111] transition-colors">
                {columns.map(({ key, render, className = "" }) => (
                  <td key={key} className={`px-4 py-3 text-[13px] ${className}`}>
                    {render ? render(row[key], row) : row[key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

export default Table
