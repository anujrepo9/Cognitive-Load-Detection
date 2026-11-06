"""
services/auto_alert.py — Automatic high-load alert engine.

How it works
------------
A single asyncio task runs every POLL_INTERVAL_SEC seconds.
For every admin who has configured a threshold (count-based or time-based),
it checks each of their active employees:

  Count-based  (high_load_threshold_count > 0)
      If the last N consecutive qualifying predictions are all "high",
      fire an auto-alert.

  Time-based   (high_load_threshold_minutes > 0)  ← takes precedence
      If the employee has had unbroken "high" predictions for ≥ T minutes,
      fire an auto-alert.

A qualifying prediction = load_level == "high"  AND
                          confidence  >= admin.min_confidence

Anti-spam
---------
We keep an in-memory set  _alerted: set[tuple[admin_id, employee_id]]
that is cleared once the employee drops out of "high" load.
This ensures exactly one auto-alert per high-load episode.

The set is in-process memory only, so it resets on server restart — acceptable
for a monitoring tool (a restart itself counts as a break in the episode).

Compatibility
-------------
Works identically under uvicorn (dev) and when frozen as a Windows .exe via
PyInstaller (cogniload_app.py), because it uses only asyncio + SQLAlchemy
which are both available in both environments.
"""

import asyncio
from datetime import datetime, timezone, timedelta

from core.logging import get_logger
from database.db import SessionLocal
from database.models import User, AdminSettings, Prediction, AdminAlert, Session as UserSession

logger = get_logger(__name__)

# How often the background loop wakes up (seconds).
# Keep ≤ the shortest flush_interval_sec you expect employees to use.
POLL_INTERVAL_SEC = 30

# ── In-memory anti-spam tracker ───────────────────────────────────────────────
# Key: (admin_id, employee_id)
# Value: True while the employee is in an active high-load episode
#        (alert already fired, waiting for them to cool down)
_alerted: set[tuple[int, int]] = set()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ── Core check logic (sync — runs inside a thread via asyncio.to_thread) ──────

def _run_check() -> None:
    """
    Called on every poll cycle.
    Opens its own DB session and closes it before returning.
    """
    db = SessionLocal()
    try:
        # All admins who have at least one threshold configured
        settings_rows: list[AdminSettings] = (
            db.query(AdminSettings)
            .filter(
                (AdminSettings.high_load_threshold_count > 0) |
                (AdminSettings.high_load_threshold_minutes > 0)
            )
            .all()
        )

        for s in settings_rows:
            admin_id      = s.admin_id
            use_minutes   = (s.high_load_threshold_minutes or 0) > 0
            threshold_min = s.high_load_threshold_minutes or 0
            threshold_cnt = s.high_load_threshold_count or 0
            min_conf      = s.min_confidence if s.min_confidence is not None else 0.75

            # Employees under this admin
            employees: list[User] = (
                db.query(User)
                .filter(User.manager_id == admin_id, User.is_active.is_(True))
                .all()
            )

            for emp in employees:
                key = (admin_id, emp.id)

                if use_minutes:
                    triggered = _check_time_based(db, emp.id, min_conf, threshold_min)
                else:
                    triggered = _check_count_based(db, emp.id, min_conf, threshold_cnt)

                if triggered:
                    if key not in _alerted:
                        # Fire the alert
                        _fire_alert(db, admin_id, emp, threshold_min, threshold_cnt, use_minutes)
                        _alerted.add(key)
                        logger.info(
                            "Auto-alert fired  admin=%s  employee=%s  mode=%s",
                            admin_id, emp.id,
                            "time" if use_minutes else "count",
                        )
                else:
                    # Employee cooled down — clear the flag so next episode fires again
                    if key in _alerted:
                        _alerted.discard(key)
                        logger.info(
                            "High-load episode ended  admin=%s  employee=%s",
                            admin_id, emp.id,
                        )

    except Exception:
        logger.exception("auto_alert._run_check encountered an error")
    finally:
        db.close()


def _recent_predictions(
    db,
    employee_id: int,
    min_conf: float,
    since: datetime | None = None,
    limit: int | None = None,
) -> list[Prediction]:
    """
    Return predictions for *employee_id* ordered newest-first.
    Optionally filter to those created after *since* and cap at *limit*.
    """
    # Find sessions belonging to this employee
    session_ids = [
        r[0] for r in
        db.query(UserSession.id)
        .filter(UserSession.user_id == employee_id)
        .all()
    ]
    if not session_ids:
        return []

    q = (
        db.query(Prediction)
        .filter(
            Prediction.session_id.in_(session_ids),
            Prediction.confidence >= min_conf,
        )
        .order_by(Prediction.created_at.desc())
    )
    if since:
        q = q.filter(Prediction.created_at >= since)
    if limit:
        q = q.limit(limit)
    return q.all()


def _check_count_based(db, employee_id: int, min_conf: float, threshold: int) -> bool:
    """True if the last *threshold* qualifying predictions are ALL 'high'."""
    preds = _recent_predictions(db, employee_id, min_conf, limit=threshold)
    if len(preds) < threshold:
        return False
    return all(p.load_level == "high" for p in preds)


def _check_time_based(db, employee_id: int, min_conf: float, minutes: int) -> bool:
    """
    True if there is an unbroken run of 'high' predictions covering the last
    *minutes* minutes (i.e. no non-high prediction in that window AND at least
    one high prediction exists).
    """
    since = _utcnow() - timedelta(minutes=minutes)
    preds = _recent_predictions(db, employee_id, min_conf, since=since)
    if not preds:
        return False
    return all(p.load_level == "high" for p in preds)


def _fire_alert(
    db,
    admin_id: int,
    employee: User,
    threshold_min: int,
    threshold_cnt: int,
    use_minutes: bool,
) -> None:
    """Insert an AdminAlert row for this auto-triggered high-load event."""
    if use_minutes:
        duration_str = f"{threshold_min} minute{'s' if threshold_min != 1 else ''}"
        message = (
            f"{employee.name} has been under high cognitive load for the past "
            f"{duration_str}. Consider checking in or adjusting their workload."
        )
    else:
        duration_str = f"{threshold_cnt} consecutive reading{'s' if threshold_cnt != 1 else ''}"
        message = (
            f"{employee.name} has shown high cognitive load for {duration_str}. "
            f"Consider checking in or adjusting their workload."
        )

    alert = AdminAlert(
        admin_id    = admin_id,
        employee_id = employee.id,
        alert_type  = "high_load",
        title       = f"⚠️ High Load Detected — {employee.name}",
        message     = message,
        is_auto     = True,
    )
    db.add(alert)
    db.commit()

    # Push a real-time WS notification to the admin (best-effort)
    _push_ws_to_admin(admin_id, alert)


def _push_ws_to_admin(admin_id: int, alert: AdminAlert) -> None:
    """
    Fire-and-forget WebSocket push to the admin so their dashboard lights up
    without needing a page refresh.
    """
    try:
        from routes.ws import manager  # avoid circular import at module load

        payload = {
            "type":        "auto_alert",
            "alert_id":    alert.id,
            "employee_id": alert.employee_id,
            "title":       alert.title,
            "message":     alert.message,
            "created_at":  alert.created_at.isoformat() if alert.created_at else None,
        }

        # manager.send_to_user is a coroutine — schedule it on the running loop
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.ensure_future(manager.send_to_user(admin_id, payload))
    except Exception:
        pass  # WS push is best-effort; never block the DB commit


# ── Async background task ─────────────────────────────────────────────────────

async def auto_alert_loop() -> None:
    """
    Infinite asyncio task.  Imported and started in main.py lifespan.
    Uses asyncio.to_thread so the synchronous SQLAlchemy calls don't block
    the event loop.
    """
    logger.info("Auto-alert loop started  poll_interval=%ss", POLL_INTERVAL_SEC)
    while True:
        await asyncio.sleep(POLL_INTERVAL_SEC)
        await asyncio.to_thread(_run_check)


# ── Public API ────────────────────────────────────────────────────────────────

_task: asyncio.Task | None = None


def start_auto_alert_loop() -> None:
    """Schedule the loop on the running event loop.  Call once from lifespan."""
    global _task
    if _task is None or _task.done():
        _task = asyncio.ensure_future(auto_alert_loop())
        logger.info("Auto-alert background task scheduled.")


def stop_auto_alert_loop() -> None:
    """Cancel the loop gracefully.  Call from lifespan shutdown."""
    global _task
    if _task and not _task.done():
        _task.cancel()
        logger.info("Auto-alert background task cancelled.")
    _task = None