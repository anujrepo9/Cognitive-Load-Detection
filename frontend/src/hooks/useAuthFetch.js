/**
 * useAuthFetch — runs an async fetch function only when the user is
 * authenticated.  Prevents "Not authenticated" errors on hard reload
 * caused by pages firing API calls before the auth token is confirmed.
 *
 * Usage:
 *   const { loading, error, reload } = useAuthFetch(() => myAPI.get().then(…), [dep])
 *
 * The callback is re-run whenever `isAuth` becomes true or any dep changes.
 */
import { useEffect, useCallback, useRef } from "react"
import { useAuth } from "../context/AuthContext"

/**
 * @param {() => Promise<void>} fn  Async function that performs the fetch + sets state.
 *                                  Must NOT return a cleanup; it is fire-and-forget.
 * @param {any[]} deps              Extra dependencies (like page number, date range).
 */
export function useAuthFetch(fn, deps = []) {
  const { isAuth } = useAuth()
  // Keep a stable ref so the effect doesn't re-run just because `fn` identity changed
  const fnRef = useRef(fn)
  useEffect(() => { fnRef.current = fn })

  const run = useCallback(() => {
    if (!isAuth) return
    fnRef.current()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuth, ...deps])

  useEffect(() => {
    run()
  }, [run])

  return { reload: run }
}