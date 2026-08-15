/**
 * Reusable form-field primitive.
 *
 * Usage:
 *   <FormField id="email" label="Email" error={errors.email}>
 *     <input id="email" type="email" className="input" ... />
 *   </FormField>
 */
import { AlertCircle } from "lucide-react"

export function FormField({ id, label, hint, error, required, children, className = "" }) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label htmlFor={id}
          className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
          {required && <span className="text-danger ml-0.5" aria-hidden="true">*</span>}
          {hint && (
            <span className="ml-1 text-xs text-gray-400 font-normal">{hint}</span>
          )}
        </label>
      )}
      {children}
      {error && (
        <p id={`${id}-error`} role="alert"
          className="flex items-center gap-1 text-xs text-danger">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  )
}

export default FormField
