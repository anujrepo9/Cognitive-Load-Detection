import { useCallback, useEffect, useRef } from "react";
import { behaviorAPI } from "../services/api";

// Minimum key events required before a keyboard-driven flush is sent.
// Lowered from 2 → 1 so a single keypress in a window is still recorded.
// Mouse-only flushes are still gated by MIN_MOUSE_EVENTS_FOR_FLUSH below.
const MIN_KEY_EVENTS = 1;

// If the user has no keyboard activity but has significant mouse activity,
// flush anyway so mouse-only sessions still produce predictions.
const MIN_MOUSE_EVENTS_FOR_FLUSH = 10;

export function useSessionTracker({
  active,
  flushIntervalMs,
  onPrediction,
  onQualityChange,
  onError,
}) {
  const buffer = useRef({
    keyEvents: [],
    mouseEvents: [],
    scrollEvents: [],
    sessionStart: Date.now(),
    intervalStart: Date.now(),
  });
  const lastKey = useRef({ key: null, downTime: null });
  const lastMouse = useRef({ x: 0, y: 0, time: Date.now() });
  const idleTimer = useRef(null);
  const idleStart = useRef(null);
  const totalIdle = useRef(0);
  const totalKeyCount = useRef(0);
  const callbacks = useRef({ onPrediction, onQualityChange, onError });

  useEffect(() => {
    callbacks.current = { onPrediction, onQualityChange, onError };
  }, [onPrediction, onQualityChange, onError]);

  const reportQuality = useCallback(() => {
    const { keyEvents, mouseEvents } = buffer.current
    callbacks.current.onQualityChange?.({
      keyEvents: keyEvents.length,
      mouseEvents: mouseEvents.length,
      ready: keyEvents.length >= MIN_KEY_EVENTS,
      totalKeys: totalKeyCount.current + keyEvents.length,
    })
  }, [])
  const resetIdle = useCallback(() => {
    if (idleStart.current) {
      totalIdle.current += Date.now() - idleStart.current;
      idleStart.current = null;
    }
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      idleStart.current = Date.now();
    }, 2000);
  }, []);
  const onKeyDown = useCallback(
    (event) => {
      lastKey.current = { key: event.key, downTime: performance.now() };
      resetIdle();
    },
    [resetIdle],
  );
  const onKeyUp = useCallback((event) => {
    const { key, downTime } = lastKey.current;
    if (key !== event.key || downTime === null) return;
    const previous = buffer.current.keyEvents.at(-1);
    buffer.current.keyEvents.push({
      holdTime: Math.round(performance.now() - downTime),
      flightTime: previous ? Math.round(downTime - previous.upTime) : null,
      isError: event.key === "Backspace",
      isSpace: event.key === " ",
      timestamp: Date.now(),
      upTime: performance.now(),
    });
    lastKey.current = { key: null, downTime: null };
  }, []);
  const onMouseMove = useCallback(
    (event) => {
      const now = performance.now();
      const seconds = (now - lastMouse.current.time) / 1000 || 0.001;
      const distance = Math.hypot(
        event.clientX - lastMouse.current.x,
        event.clientY - lastMouse.current.y,
      );
      buffer.current.mouseEvents.push({
        speed: Math.round(distance / seconds),
        distance: Math.round(distance),
      });
      lastMouse.current = { x: event.clientX, y: event.clientY, time: now };
      resetIdle();
    },
    [resetIdle],
  );
  const onMouseDown = useCallback(() => {
    buffer.current.mouseEvents.push({ type: "click" });
    resetIdle();
  }, [resetIdle]);
  const onWheel = useCallback(
    (event) => {
      buffer.current.scrollEvents.push({ deltaY: event.deltaY });
      resetIdle();
    },
    [resetIdle],
  );

  const extractFeatures = useCallback(() => {
    const {
      keyEvents,
      mouseEvents,
      scrollEvents,
      sessionStart,
      intervalStart,
    } = buffer.current;

    // Require either enough key events OR enough mouse events to flush.
    const hasKeyData = keyEvents.length >= MIN_KEY_EVENTS;
    const hasMouseData =
      mouseEvents.filter((e) => e.speed != null).length >=
      MIN_MOUSE_EVENTS_FOR_FLUSH;
    if (!hasKeyData && !hasMouseData) return null;

    // Use intervalStart (reset each flush) for WPM so the rate reflects THIS
    // interval's typing speed, not the entire session elapsed time.
    const intervalMinutes = (Date.now() - intervalStart) / 60_000;
    const sessionMinutes = (Date.now() - sessionStart) / 60_000;

    const holds = keyEvents.map((event) => event.holdTime);
    const flights = keyEvents.map((event) => event.flightTime).filter(Boolean);
    const errors = keyEvents.filter((event) => event.isError).length;
    const words = keyEvents.filter((event) => event.isSpace).length;
    const averageHold = average(holds);
    const variation =
      holds.length > 1 ? standardDeviation(holds) / (averageHold || 1) : 0;
    const speeds = mouseEvents
      .filter((event) => event.speed != null)
      .map((event) => event.speed);
    const clicks = mouseEvents.filter((event) => event.type === "click").length;
    const distance = mouseEvents.reduce(
      (total, event) => total + (event.distance || 0),
      0,
    );
    // Use upTime (performance.now ms, same clock as flightTime) not timestamp
    // (Date.now epoch ms) so pause gaps are measured on a consistent clock.
    const pauses = keyEvents
      .slice(1)
      .map((event, index) => {
        const prev = keyEvents[index];
        // downTime of current key minus upTime of previous key = gap between keys
        return (event.upTime - prev.upTime);
      })
      .filter((gap) => gap > 2000);

    // WPM is words-in-this-interval / minutes-in-this-interval.
    // Require at least 3 words AND at least 3 seconds in the interval so that
    // a single space pressed right after tracking starts doesn't produce an
    // astronomically large (or meaningless) WPM value.
    // NOTE: was 10 s, but the default flush interval is 5 s — a 10 s minimum
    // guaranteed wpm was always null because the buffer is reset each flush.
    const MIN_WORDS_FOR_WPM = 3;
    const MIN_INTERVAL_MINUTES = 3 / 60; // 3 seconds
    const wpm =
      words >= MIN_WORDS_FOR_WPM && intervalMinutes >= MIN_INTERVAL_MINUTES
        ? Math.round(words / intervalMinutes)
        : null;

    return {
      // BehaviorPayload.typing_wpm is Optional[int] = None on the backend.
      // Send null when there aren't enough words/time so the DB stores NULL
      // (meaning "no data this window") rather than 0 (which looks like real data).
      typing_wpm: wpm,      // null when below MIN_WORDS_FOR_WPM threshold
      _wpm_display: wpm,    // null = not enough data yet; used by flush() below
      avg_hold_ms: Math.round(averageHold),
      avg_flight_ms: Math.round(average(flights)),
      error_rate:
        keyEvents.length > 0
          ? Number((errors / keyEvents.length).toFixed(4))
          : 0,
      pause_count: pauses.length,
      avg_pause_ms: Math.round(average(pauses)),
      typing_variance: Number(variation.toFixed(4)),
      // Use interval window (not cumulative session) so chars_per_min reflects
      // THIS flush window's typing rate, consistent with how typing_wpm is computed.
      chars_per_min: intervalMinutes > 0
        ? Math.round(keyEvents.length / intervalMinutes)
        : 0,
      avg_cursor_speed: Math.round(average(speeds)),
      click_rate:
        sessionMinutes > 0 ? Number((clicks / sessionMinutes).toFixed(2)) : 0,
      double_click_rate: 0,
      scroll_rate:
        sessionMinutes > 0
          ? Number((scrollEvents.length / sessionMinutes).toFixed(2))
          : 0,
      idle_time_pct: Number(
        Math.min(
          totalIdle.current / (Date.now() - sessionStart || 1),
          0.95,
        ).toFixed(4),
      ),
      avg_hover_ms: 0,
      movement_distance: Math.round(distance),
      movement_smoothness: Number(
        Math.max(0.1, Math.min(1, 1 - variation)).toFixed(4),
      ),
    };
  }, []);

  const resetBuffer = useCallback(() => {
    totalKeyCount.current += buffer.current.keyEvents.length;
    buffer.current.keyEvents = [];
    buffer.current.mouseEvents = [];
    buffer.current.scrollEvents = [];
    // Reset the interval clock so next WPM is computed over the next window
    buffer.current.intervalStart = Date.now();
    totalIdle.current = 0;
    reportQuality();
  }, [reportQuality]);

  const flush = useCallback(async () => {
    const features = extractFeatures();
    if (!features) return false;
    // _wpm_display is null when there isn't enough data for a meaningful WPM.
    // Use it for the UI callback so the stat card shows "—" rather than "0".
    const displayWpm = features._wpm_display;
    // Strip _wpm_display before sending — it's a UI-only field, not part of
    // BehaviorPayload. The backend receives typing_wpm as null when no data.
    const { _wpm_display, ...apiPayload } = features;
    // Reset buffer before the API call so stale events don't accumulate
    resetBuffer();
    try {
      const { data } = await behaviorAPI.predict(apiPayload);
      // Merge the display WPM (which may be null) from local features since the
      // HTTP PredictionResponse schema does not include typing_wpm in its response body.
      callbacks.current.onPrediction?.({ ...data, typing_wpm: displayWpm });
      return true;
    } catch {
      callbacks.current.onError?.(
        "Could not send this activity window. Check your connection and retry.",
      );
      return false;
    }
  }, [extractFeatures, resetBuffer]);

  useEffect(() => {
    if (!active) return undefined;
    buffer.current.sessionStart = Date.now();
    buffer.current.intervalStart = Date.now();
    totalKeyCount.current = 0  
    reportQuality();
    const qualityTimer = setInterval(reportQuality, 1000);
    const flushTimer = setInterval(flush, flushIntervalMs);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => {
      clearInterval(qualityTimer);
      clearInterval(flushTimer);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("wheel", onWheel);
      clearTimeout(idleTimer.current);
    };
  }, [
    active,
    flushIntervalMs,
    flush,
    onKeyDown,
    onKeyUp,
    onMouseMove,
    onMouseDown,
    onWheel,
    reportQuality,
  ]);

  return { flush };
}

const average = (values) =>
  values.length
    ? values.reduce((total, value) => total + value, 0) / values.length
    : 0;
const standardDeviation = (values) =>
  Math.sqrt(average(values.map((value) => (value - average(values)) ** 2)));