/**
 * api.js — Tauri invoke adapter
 *
 * All calls that previously went to FastAPI over HTTP now go directly
 * to Rust Tauri commands via invoke().  The public surface (authAPI,
 * sessionAPI, behaviorAPI, predictAPI) is intentionally the same shape
 * so callers in pages/hooks need minimal changes.
 *
 * Token management: access token is stored in localStorage under "token";
 * refresh token under "refreshToken".  Refresh is triggered automatically
 * when an invoke returns the string "Invalid token" / "Token expired".
 */

import { invoke } from "@tauri-apps/api/core"

// ── Token helpers ──────────────────────────────────────────────────────────────

export function getToken()        { return localStorage.getItem("token")        ?? "" }
export function getRefreshToken() { return localStorage.getItem("refreshToken") ?? "" }

function storeTokens(access, refresh) {
  localStorage.setItem("token",        access)
  localStorage.setItem("refreshToken", refresh)
}

function clearTokens() {
  localStorage.removeItem("token")
  localStorage.removeItem("refreshToken")
  localStorage.removeItem("user")
}

// ── Auto-refresh wrapper ───────────────────────────────────────────────────────

let _refreshing   = false
let _waitQueue    = []

function _processQueue(err, token = null) {
  _waitQueue.forEach(({ resolve, reject }) => err ? reject(err) : resolve(token))
  _waitQueue = []
}

const TOKEN_ERRORS = ["Invalid token", "Token expired", "Not an access token"]
function isAuthError(msg = "") {
  return TOKEN_ERRORS.some((e) => msg.includes(e))
}

/**
 * Like invoke() but auto-refreshes the access token on auth errors.
 * Returns the command result directly (no .data wrapper).
 */
export async function call(command, args = {}) {
  try {
    return await invoke(command, args)
  } catch (err) {
    const msg = typeof err === "string" ? err : (err?.message ?? "")

    if (!isAuthError(msg)) throw err

    // Don't try to refresh auth commands themselves
    if (command.startsWith("refresh_token") || command === "logout") throw err

    const refreshToken = getRefreshToken()
    if (!refreshToken) { clearTokens(); throw err }

    if (_refreshing) {
      return new Promise((resolve, reject) => {
        _waitQueue.push({ resolve, reject })
      }).then((newToken) => invoke(command, { ...args, token: newToken }))
    }

    _refreshing = true
    try {
      const result = await invoke("refresh_token", { refresh_token: refreshToken })
      const newAccess  = result.access_token
      const newRefresh = result.refresh_token ?? refreshToken
      storeTokens(newAccess, newRefresh)
      _processQueue(null, newAccess)
      return invoke(command, { ...args, token: newAccess })
    } catch (refreshErr) {
      _processQueue(refreshErr)
      clearTokens()
      throw refreshErr
    } finally {
      _refreshing = false
    }
  }
}

// ── Error helper (same API as before) ─────────────────────────────────────────

export function getErrorMessage(err, fallback = "Something went wrong. Please try again.") {
  if (!err) return fallback
  return typeof err === "string" ? err : (err?.message ?? fallback)
}

// ── Auth ───────────────────────────────────────────────────────────────────────

export const authAPI = {
  register: ({ name, email, password }) =>
    invoke("register", { name, email, password }),

  login: ({ email, password }) =>
    invoke("login", { email, password }),

  logout: () =>
    invoke("logout", { refresh_token: getRefreshToken() }).finally(clearTokens),

  profile: () =>
    call("get_current_user", { token: getToken() }),

  refresh: () =>
    invoke("refresh_token", { refresh_token: getRefreshToken() }),

  // updateProfile is not yet a Tauri command; add when needed
  updateProfile: () => Promise.reject("not implemented"),
}

// ── Sessions ───────────────────────────────────────────────────────────────────

export const sessionAPI = {
  start: () =>
    call("start_session", { token: getToken() }),

  end: (sessionId) =>
    call("end_session", { token: getToken(), session_id: sessionId }),

  list: () =>
    call("get_sessions", { token: getToken() }),

  get: (sessionId) =>
    call("get_session", { token: getToken(), session_id: sessionId }),
}

// ── Behavior ───────────────────────────────────────────────────────────────────

export const behaviorAPI = {
  /**
   * Drain the native collector and write a behavior row.
   * sessionId is required; the payload is computed in Rust.
   */
  flush: (sessionId) =>
    call("flush_behavior", { token: getToken(), session_id: sessionId }),

  history: (sessionId, limit = 50) =>
    call("get_behavior_history", { token: getToken(), session_id: sessionId, limit }),
}

// ── Predictions ────────────────────────────────────────────────────────────────

export const predictAPI = {
  /**
   * Run ONNX inference on a BehaviorPayload object.
   * payload shape must match BehaviorPayload in behavior.rs.
   */
  predict: (sessionId, payload, behaviorId = null) =>
    call("predict_load", {
      token:       getToken(),
      session_id:  sessionId,
      behavior_id: behaviorId,
      payload,
    }),

  list: (sessionId, limit = 50) =>
    call("get_predictions", { token: getToken(), session_id: sessionId, limit }),
}

// ── Collector control ──────────────────────────────────────────────────────────

export const collectorAPI = {
  setEnabled: (enabled) =>
    invoke("set_tracking_enabled", { enabled }),

  status: () =>
    invoke("get_tracking_status"),
}

// ── Settings ───────────────────────────────────────────────────────────────────

export const settingsAPI = {
  get: () =>
    call("get_settings", { token: getToken() }),

  update: (payload) =>
    call("update_settings", { token: getToken(), ...payload }),

  getAutostart: () =>
    invoke("get_autostart"),

  enableAutostart: () =>
    invoke("set_autostart", { enabled: true }),

  disableAutostart: () =>
    invoke("set_autostart", { enabled: false }),
}

// ── Profile & password ─────────────────────────────────────────────────────────

// Extend authAPI with profile-mutation methods
authAPI.updateProfile = ({ name, email }) =>
  call("update_profile", { token: getToken(), name, email })

authAPI.changePassword = ({ current_password, new_password }) =>
  call("change_password", { token: getToken(), current_password, new_password })

// ── Dashboard / model / recommendations / history / CSV ───────────────────────

export const dashboardAPI = {
  overview: () =>
    call("get_overview", { token: getToken() }),

  history: ({ page, per_page, from_date, to_date } = {}) =>
    call("get_history", { token: getToken(), page, per_page, from_date, to_date }),

  recommendation: () =>
    call("get_recommendation", { token: getToken() }),
}

export const modelAPI = {
  info: () =>
    invoke("get_model_info"),
}

export const reportsAPI = {
  // Returns raw CSV string; caller builds the Blob
  export: () =>
    call("export_csv", { token: getToken() }),
}

// ── Analytics ──────────────────────────────────────────────────────────────────

export const analyticsAPI = {
  trends: (hours = 24, limit = 500) =>
    call("get_analytics_trends", { token: getToken(), hours, limit }),

  features: () =>
    call("get_analytics_features", { token: getToken() }),
}

// Extend reportsAPI with daily / weekly (was only export before)
reportsAPI.daily  = (days = 14)  => call("get_daily_reports",  { token: getToken(), days })
reportsAPI.weekly = (weeks = 8)  => call("get_weekly_reports", { token: getToken(), weeks })