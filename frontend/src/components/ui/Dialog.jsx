/**
 * Reusable dialog primitive.
 *
 * Usage:
 *   <Dialog open={open} onClose={close} title="Confirm">
 *     <p>Are you sure?</p>
 *     <Dialog.Footer>
 *       <button onClick={close} className="btn-secondary">Cancel</button>
 *       <button onClick={confirm} className="btn-primary">Confirm</button>
 *     </Dialog.Footer>
 *   </Dialog>
 */
import { useEffect, useRef } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { X } from "lucide-react"

function DialogFooter({ children }) {
  return (
    <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-gray-100 dark:border-slate-800">
      {children}
    </div>
  )
}

export function Dialog({ open, onClose, title, description, children, size = "md" }) {
  const overlayRef = useRef(null)
  const panelRef   = useRef(null)

  const sizeClass = {
    sm: "max-w-sm",
    md: "max-w-lg",
    lg: "max-w-2xl",
  }[size] ?? "max-w-lg"

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === "Escape") onClose?.() }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [open, onClose])

  // Trap focus inside panel
  useEffect(() => {
    if (!open || !panelRef.current) return
    const focusable = panelRef.current.querySelectorAll(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    )
    focusable[0]?.focus()
  }, [open])

  // Lock body scroll
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => { document.body.style.overflow = "" }
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={overlayRef}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4
            bg-black/50 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dialog-title"
          aria-describedby={description ? "dialog-desc" : undefined}
          onClick={(e) => { if (e.target === overlayRef.current) onClose?.() }}
        >
          <motion.div
            ref={panelRef}
            initial={{ scale: 0.95, opacity: 0, y: 8 }}
            animate={{ scale: 1,    opacity: 1, y: 0 }}
            exit={{ scale: 0.95,    opacity: 0, y: 8 }}
            transition={{ duration: 0.15 }}
            className={`relative w-full ${sizeClass} bg-white dark:bg-slate-900
              rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 p-6`}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 id="dialog-title"
                  className="text-lg font-bold text-gray-900 dark:text-white">
                  {title}
                </h2>
                {description && (
                  <p id="dialog-desc" className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {description}
                  </p>
                )}
              </div>
              {onClose && (
                <button onClick={onClose}
                  className="ml-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-600
                    dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800
                    transition-colors shrink-0"
                  aria-label="Close dialog">
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              )}
            </div>

            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

Dialog.Footer = DialogFooter
export default Dialog
