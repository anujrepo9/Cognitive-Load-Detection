"""
routes/admin.py — Admin / Team-Leader management endpoints.

All routes require the caller to be authenticated AND have role == "admin".

Endpoints
---------
  POST   /admin/employees                        Create employee account
  GET    /admin/employees                        List all team members
  GET    /admin/employees/{employee_id}          Employee detail + cogniload snapshot
  PATCH  /admin/employees/{employee_id}          Update employee account
  DELETE /admin/employees/{employee_id}          Delete (or deactivate) employee

  GET    /admin/employees/{employee_id}/cogniload   Latest CL predictions
  GET    /admin/employees/{employee_id}/app-usage   App-usage summary
  GET    /admin/employees/{employee_id}/sessions    Session history

  POST   /admin/alerts                           Send alert to employee
  GET    /admin/alerts                           All alerts sent by this admin
  GET    /admin/alerts/employee/{employee_id}    Alerts for a specific employee
  DELETE /admin/alerts/{alert_id}               Delete an alert

  GET    /admin/dashboard                        Overview of whole team
"""

import math
from collections import Counter
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session as DBSession

from database.db import get_db
from database.models import (
    User, Session as UserSession,
    Prediction, AppUsageLog, AdminAlert,
    AdminSettings, AuditLog,
)
from auth.jwt import get_current_user, hash_password
from api.schemas import (
    AdminRegisterEmployeeRequest,
    AdminUpdateEmployeeRequest,
    EmployeeOut,
    EmployeeDetailOut,
    AdminAlertRequest,
    AdminAlertOut,
    EmployeeAppUsageSummaryResponse,
    EmployeeCogniLoadSnapshot,
    AppUsageSummaryEntry,
    SessionOut,
    HistoryResponsePaginated,
    AdminSettingsOut,
    AdminSettingsUpdate,
    TransferTeamRequest,
    TransferTeamResponse,
    AuditLogOut,
)

router = APIRouter(prefix="/admin", tags=["admin"])


# ── Helper: admin guard ───────────────────────────────────────────────────────

def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Dependency — raises 403 if the caller is not an admin."""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Admin access required",
        )
    return current_user


def _get_team_member(
    employee_id: int,
    admin: User,
    db: DBSession,
) -> User:
    """Return the employee if they belong to this admin, else 404."""
    employee = db.query(User).filter(
        User.id == employee_id,
        User.manager_id == admin.id,
    ).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    return employee


# ── Employee CRUD ─────────────────────────────────────────────────────────────

@router.post("/employees", response_model=EmployeeOut, status_code=201)
def create_employee(
    body:  AdminRegisterEmployeeRequest,
    admin: User      = Depends(require_admin),
    db:    DBSession = Depends(get_db),
):
    """Admin creates a new employee account under their team."""
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=409, detail="Email already registered")

    employee = User(
        name=body.name,
        email=body.email,
        password=hash_password(body.password),
        role="employee",
        manager_id=admin.id,
    )
    db.add(employee)
    db.commit()
    db.refresh(employee)
    return EmployeeOut.model_validate(employee)


@router.get("/employees", response_model=list[EmployeeOut])
def list_employees(
    admin: User      = Depends(require_admin),
    db:    DBSession = Depends(get_db),
):
    """List all employees managed by this admin."""
    employees = (
        db.query(User)
        .filter(User.manager_id == admin.id)
        .order_by(User.name)
        .all()
    )
    return [EmployeeOut.model_validate(e) for e in employees]


@router.get("/employees/{employee_id}", response_model=EmployeeDetailOut)
def get_employee(
    employee_id: int,
    admin: User      = Depends(require_admin),
    db:    DBSession = Depends(get_db),
):
    """Get employee details + their current cognitive-load snapshot."""
    employee = _get_team_member(employee_id, admin, db)
    return _build_employee_detail(employee, db)


@router.patch("/employees/{employee_id}", response_model=EmployeeOut)
def update_employee(
    employee_id: int,
    body:  AdminUpdateEmployeeRequest,
    admin: User      = Depends(require_admin),
    db:    DBSession = Depends(get_db),
):
    """Update an employee's name, email, password, or active status."""
    employee = _get_team_member(employee_id, admin, db)

    if body.name is not None:
        employee.name = body.name.strip()

    if body.email is not None:
        new_email = body.email.strip().lower()
        conflict = db.query(User).filter(
            User.email == new_email,
            User.id != employee.id,
        ).first()
        if conflict:
            raise HTTPException(status_code=409, detail="Email already registered")
        employee.email = new_email

    if body.password is not None:
        employee.password = hash_password(body.password)

    if body.is_active is not None:
        employee.is_active = body.is_active

    db.commit()
    db.refresh(employee)
    return EmployeeOut.model_validate(employee)


@router.delete("/employees/{employee_id}", status_code=204)
def delete_employee(
    employee_id: int,
    hard:  bool      = Query(False, description="If true, permanently deletes the account"),
    admin: User      = Depends(require_admin),
    db:    DBSession = Depends(get_db),
):
    """
    Delete (or deactivate) an employee.
    Default: soft-delete (is_active=False).
    Pass ?hard=true for a permanent hard-delete.
    """
    employee = _get_team_member(employee_id, admin, db)

    if hard:
        db.delete(employee)
    else:
        employee.is_active = False

    db.commit()
    return None


# ── Employee monitoring ───────────────────────────────────────────────────────

@router.get("/employees/{employee_id}/cogniload")
def employee_cogniload(
    employee_id: int,
    limit: int   = Query(50, ge=1, le=500),
    admin: User      = Depends(require_admin),
    db:    DBSession = Depends(get_db),
):
    """Latest N cognitive-load predictions for an employee."""
    _get_team_member(employee_id, admin, db)   # ownership check

    preds = (
        db.query(Prediction)
        .join(UserSession)
        .filter(UserSession.user_id == employee_id)
        .order_by(Prediction.created_at.desc())
        .limit(limit)
        .all()
    )

    return [
        {
            "id":         p.id,
            "load_level": p.load_level,
            "confidence": p.confidence,
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "session_id": p.session_id,
        }
        for p in preds
    ]


@router.get(
    "/employees/{employee_id}/app-usage",
    response_model=EmployeeAppUsageSummaryResponse,
)
def employee_app_usage(
    employee_id: int,
    hours: int   = Query(24, ge=1, le=720),
    admin: User      = Depends(require_admin),
    db:    DBSession = Depends(get_db),
):
    """Aggregated app-usage summary for an employee."""
    employee = _get_team_member(employee_id, admin, db)

    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    logs = (
        db.query(AppUsageLog)
        .filter(
            AppUsageLog.user_id     == employee_id,
            AppUsageLog.recorded_at >= cutoff,
        )
        .all()
    )

    from collections import defaultdict
    totals:     dict[str, float] = defaultdict(float)
    last_title: dict[str, str]   = {}
    for log in logs:
        totals[log.process] += log.duration_sec
        last_title[log.process] = log.window_title or ""

    total_tracked = sum(totals.values())
    apps = [
        AppUsageSummaryEntry(
            process           = proc,
            total_seconds     = round(secs, 1),
            percentage        = round(secs / total_tracked * 100, 1) if total_tracked else 0.0,
            last_window_title = last_title.get(proc, ""),
        )
        for proc, secs in sorted(totals.items(), key=lambda x: x[1], reverse=True)
    ]

    return EmployeeAppUsageSummaryResponse(
        employee_id   = employee_id,
        employee_name = employee.name,
        period_hours  = hours,
        total_tracked = round(total_tracked, 1),
        apps          = apps,
    )


@router.get(
    "/employees/{employee_id}/sessions",
    response_model=HistoryResponsePaginated,
)
def employee_sessions(
    employee_id: int,
    page:     int = Query(1,  ge=1),
    per_page: int = Query(10, ge=1, le=100),
    admin: User      = Depends(require_admin),
    db:    DBSession = Depends(get_db),
):
    """Paginated session history for an employee."""
    _get_team_member(employee_id, admin, db)

    query = (
        db.query(UserSession)
        .filter(UserSession.user_id == employee_id)
    )
    total       = query.count()
    total_pages = max(1, math.ceil(total / per_page))
    sessions    = (
        query
        .order_by(UserSession.start_time.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    return HistoryResponsePaginated(
        sessions    = [_session_out(s) for s in sessions],
        total       = total,
        page        = page,
        per_page    = per_page,
        total_pages = total_pages,
    )


# ── Alerts ────────────────────────────────────────────────────────────────────

@router.post("/alerts", response_model=AdminAlertOut, status_code=201)
def send_alert(
    body:  AdminAlertRequest,
    admin: User      = Depends(require_admin),
    db:    DBSession = Depends(get_db),
):
    """Send an alert / instruction to one of the admin's employees."""
    _get_team_member(body.employee_id, admin, db)   # ownership check

    alert = AdminAlert(
        admin_id    = admin.id,
        employee_id = body.employee_id,
        alert_type  = body.alert_type,
        title       = body.title,
        message     = body.message,
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return AdminAlertOut.model_validate(alert)


@router.get("/alerts", response_model=list[AdminAlertOut])
def list_sent_alerts(
    admin: User      = Depends(require_admin),
    db:    DBSession = Depends(get_db),
):
    """All alerts sent by this admin (most recent first)."""
    alerts = (
        db.query(AdminAlert)
        .filter(AdminAlert.admin_id == admin.id)
        .order_by(AdminAlert.created_at.desc())
        .all()
    )
    return [AdminAlertOut.model_validate(a) for a in alerts]


@router.get("/alerts/employee/{employee_id}", response_model=list[AdminAlertOut])
def alerts_for_employee(
    employee_id: int,
    admin: User      = Depends(require_admin),
    db:    DBSession = Depends(get_db),
):
    """Alerts sent to a specific employee by this admin."""
    _get_team_member(employee_id, admin, db)

    alerts = (
        db.query(AdminAlert)
        .filter(
            AdminAlert.admin_id    == admin.id,
            AdminAlert.employee_id == employee_id,
        )
        .order_by(AdminAlert.created_at.desc())
        .all()
    )
    return [AdminAlertOut.model_validate(a) for a in alerts]


@router.delete("/alerts/{alert_id}", status_code=204)
def delete_alert(
    alert_id: int,
    admin: User      = Depends(require_admin),
    db:    DBSession = Depends(get_db),
):
    """Delete an alert (admin must own the alert)."""
    alert = db.query(AdminAlert).filter(
        AdminAlert.id       == alert_id,
        AdminAlert.admin_id == admin.id,
    ).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    db.delete(alert)
    db.commit()
    return None


# ── Admin dashboard overview ──────────────────────────────────────────────────

@router.get("/dashboard", response_model=list[EmployeeCogniLoadSnapshot])
def admin_dashboard(
    admin: User      = Depends(require_admin),
    db:    DBSession = Depends(get_db),
):
    """
    Returns a cognitive-load snapshot for every team member.
    Powers the admin's overview page.
    """
    employees = (
        db.query(User)
        .filter(User.manager_id == admin.id)
        .order_by(User.name)
        .all()
    )

    return [_build_snapshot(emp, db) for emp in employees]


# ── Employee-facing: read own alerts ─────────────────────────────────────────
# (These live here for convenience; they are authenticated as the employee.)

@router.get("/my-alerts", response_model=list[AdminAlertOut])
def my_alerts(
    current_user: User      = Depends(get_current_user),
    db:           DBSession = Depends(get_db),
):
    """Employee reads alerts sent to them."""
    alerts = (
        db.query(AdminAlert)
        .filter(AdminAlert.employee_id == current_user.id)
        .order_by(AdminAlert.created_at.desc())
        .all()
    )
    return [AdminAlertOut.model_validate(a) for a in alerts]


@router.patch("/my-alerts/{alert_id}/read", response_model=AdminAlertOut)
def mark_alert_read(
    alert_id:     int,
    current_user: User      = Depends(get_current_user),
    db:           DBSession = Depends(get_db),
):
    """Employee marks an alert as read."""
    alert = db.query(AdminAlert).filter(
        AdminAlert.id          == alert_id,
        AdminAlert.employee_id == current_user.id,
    ).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.is_read = True
    alert.read_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(alert)
    return AdminAlertOut.model_validate(alert)


# ── Internal helpers ──────────────────────────────────────────────────────────

def _build_employee_detail(employee: User, db: DBSession) -> EmployeeDetailOut:
    """Augment an employee with their live cognitive-load snapshot."""
    snap = _build_snapshot(employee, db)
    return EmployeeDetailOut(
        id                = employee.id,
        name              = employee.name,
        email             = employee.email,
        is_active         = employee.is_active,
        created_at        = employee.created_at,
        role              = employee.role,
        latest_load       = snap.latest_load,
        latest_confidence = snap.latest_confidence,
        sessions_today    = snap.sessions_today,
        avg_load_today    = snap.avg_load_today,
    )


def _build_snapshot(employee: User, db: DBSession) -> EmployeeCogniLoadSnapshot:
    today_start = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0,
    )

    # Latest prediction
    latest_pred = (
        db.query(Prediction)
        .join(UserSession)
        .filter(UserSession.user_id == employee.id)
        .order_by(Prediction.created_at.desc())
        .first()
    )

    # Sessions today
    sessions_today_q = (
        db.query(UserSession)
        .filter(
            UserSession.user_id    == employee.id,
            UserSession.start_time >= today_start,
        )
    )
    sessions_today = sessions_today_q.count()

    # Dominant load today
    today_preds = (
        db.query(Prediction)
        .join(UserSession)
        .filter(
            UserSession.user_id    == employee.id,
            Prediction.created_at >= today_start,
        )
        .all()
    )
    label_dist     = Counter(p.load_level for p in today_preds)
    avg_load_today = label_dist.most_common(1)[0][0] if label_dist else None

    # Top app in last 8 h
    cutoff = datetime.now(timezone.utc) - timedelta(hours=8)
    app_logs = (
        db.query(AppUsageLog)
        .filter(
            AppUsageLog.user_id     == employee.id,
            AppUsageLog.recorded_at >= cutoff,
        )
        .all()
    )
    from collections import defaultdict
    app_totals: dict[str, float] = defaultdict(float)
    for log in app_logs:
        app_totals[log.process] += log.duration_sec
    top_app = max(app_totals, key=app_totals.__getitem__) if app_totals else None

    # Unread alerts count
    unread_alerts = (
        db.query(AdminAlert)
        .filter(
            AdminAlert.employee_id == employee.id,
            AdminAlert.is_read.is_(False),
        )
        .count()
    )

    return EmployeeCogniLoadSnapshot(
        employee_id       = employee.id,
        employee_name     = employee.name,
        email             = employee.email,
        latest_load       = latest_pred.load_level if latest_pred else None,
        latest_confidence = latest_pred.confidence if latest_pred else None,
        sessions_today    = sessions_today,
        avg_load_today    = avg_load_today,
        top_app           = top_app,
        unread_alerts     = unread_alerts,
    )


def _session_out(s: UserSession) -> SessionOut:
    preds      = s.predictions
    label_dist = Counter(p.load_level for p in preds)
    avg_load   = label_dist.most_common(1)[0][0] if label_dist else None

    duration = None
    if s.end_time and s.start_time:
        secs     = int((s.end_time - s.start_time).total_seconds())
        duration = f"{secs // 60}m {secs % 60}s"

    return SessionOut(
        session_id       = s.id,
        start_time       = s.start_time,
        end_time         = s.end_time,
        duration         = duration,
        avg_load         = avg_load,
        prediction_count = len(preds),
    )

# ══════════════════════════════════════════════════════════════════════════════
# NEW ENDPOINTS  ──  Promote/demote · Admin Settings · Transfer team · Audit
# ══════════════════════════════════════════════════════════════════════════════

import json as _json

# ── Audit helper ──────────────────────────────────────────────────────────────

def _audit(db: DBSession, admin_id: int, action: str,
           target_id: int | None = None, detail: dict | None = None):
    """Write one audit log row. Never raises — swallows DB errors silently."""
    try:
        entry = AuditLog(
            admin_id  = admin_id,
            action    = action,
            target_id = target_id,
            detail    = _json.dumps(detail) if detail else None,
        )
        db.add(entry)
        db.commit()
    except Exception:
        db.rollback()


# ── Admin Settings ────────────────────────────────────────────────────────────

def _get_or_create_admin_settings(admin: User, db: DBSession) -> AdminSettings:
    settings = db.query(AdminSettings).filter(AdminSettings.admin_id == admin.id).first()
    if not settings:
        settings = AdminSettings(admin_id=admin.id)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


@router.get("/settings", response_model=AdminSettingsOut)
def get_admin_settings(
    admin: User      = Depends(require_admin),
    db:    DBSession = Depends(get_db),
):
    """Return this admin's team-management preferences. Auto-creates defaults on first call."""
    settings = _get_or_create_admin_settings(admin, db)
    return AdminSettingsOut.model_validate(settings)


@router.patch("/settings", response_model=AdminSettingsOut)
def update_admin_settings(
    body:  AdminSettingsUpdate,
    admin: User      = Depends(require_admin),
    db:    DBSession = Depends(get_db),
):
    """Partial update admin settings. Only supplied fields are changed."""
    settings = _get_or_create_admin_settings(admin, db)

    if body.high_load_threshold_count is not None:
        settings.high_load_threshold_count = body.high_load_threshold_count
    if body.min_confidence is not None:
        settings.min_confidence = body.min_confidence
    if body.dashboard_refresh_sec is not None:
        settings.dashboard_refresh_sec = body.dashboard_refresh_sec
    if body.alert_templates is not None:
        # Serialise to plain dicts for the JSON column
        settings.alert_templates = [t.model_dump() for t in body.alert_templates]

    db.commit()
    db.refresh(settings)
    return AdminSettingsOut.model_validate(settings)


# ── Promote / Demote ──────────────────────────────────────────────────────────

@router.post("/employees/{employee_id}/promote", response_model=EmployeeOut)
def promote_to_admin(
    employee_id: int,
    admin: User      = Depends(require_admin),
    db:    DBSession = Depends(get_db),
):
    """
    Promote an employee to admin role.
    The employee stays in this admin's team but gains admin privileges.
    Their manager_id is cleared because they are now a peer admin.
    """
    employee = _get_team_member(employee_id, admin, db)

    if employee.role == "admin":
        raise HTTPException(status_code=409, detail="User is already an admin")

    employee.role       = "admin"
    employee.manager_id = None   # peer admins have no manager
    db.commit()
    db.refresh(employee)

    _audit(db, admin.id, "promote_to_admin", target_id=employee.id,
           detail={"name": employee.name, "email": employee.email})

    return EmployeeOut.model_validate(employee)


@router.post("/employees/{employee_id}/demote", response_model=EmployeeOut)
def revoke_admin(
    employee_id: int,
    admin: User      = Depends(require_admin),
    db:    DBSession = Depends(get_db),
):
    """
    Revoke admin role from a user and re-attach them as an employee under the
    calling admin.  The target must currently be an admin with no team members
    of their own (to avoid orphaning), OR the caller accepts that those employees
    will be re-parented to the calling admin automatically.
    """
    target = db.query(User).filter(User.id == employee_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    if target.id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot demote yourself")

    if target.role != "admin":
        raise HTTPException(status_code=409, detail="User is not an admin")

    # Re-parent any employees the target admin owned
    orphans = db.query(User).filter(User.manager_id == target.id).all()
    for orphan in orphans:
        orphan.manager_id = admin.id

    target.role       = "employee"
    target.manager_id = admin.id
    db.commit()
    db.refresh(target)

    _audit(db, admin.id, "revoke_admin", target_id=target.id,
           detail={
               "name":              target.name,
               "email":             target.email,
               "orphans_reparented": len(orphans),
           })

    return EmployeeOut.model_validate(target)


# ── Transfer Team ─────────────────────────────────────────────────────────────

@router.post("/transfer-team", response_model=TransferTeamResponse)
def transfer_team(
    body:  TransferTeamRequest,
    admin: User      = Depends(require_admin),
    db:    DBSession = Depends(get_db),
):
    """
    Transfer all (or selected) of this admin's employees to another admin.

    Use-cases:
      • Admin is leaving the organisation — transfer everyone before deleting account.
      • Re-organising teams — move specific employees to another manager.

    Pass `employee_ids` to move only those members; omit to move everyone.
    The target user must exist and have role == "admin".
    """
    if body.target_admin_id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot transfer to yourself")

    target_admin = db.query(User).filter(
        User.id   == body.target_admin_id,
        User.role == "admin",
    ).first()
    if not target_admin:
        raise HTTPException(
            status_code=404,
            detail="Target admin not found or target user is not an admin",
        )

    # Build the query for employees to transfer
    query = db.query(User).filter(User.manager_id == admin.id)
    if body.employee_ids:
        query = query.filter(User.id.in_(body.employee_ids))

    employees = query.all()
    if not employees:
        raise HTTPException(status_code=404, detail="No matching employees found")

    transferred_ids = []
    for emp in employees:
        emp.manager_id = body.target_admin_id
        transferred_ids.append(emp.id)

    db.commit()

    _audit(db, admin.id, "transfer_team", target_id=body.target_admin_id,
           detail={
               "to_admin_name":    target_admin.name,
               "employee_ids":     transferred_ids,
               "count":            len(transferred_ids),
           })

    return TransferTeamResponse(
        transferred_count = len(transferred_ids),
        target_admin_id   = target_admin.id,
        target_admin_name = target_admin.name,
    )


# ── List all admins (for transfer target picker) ──────────────────────────────

@router.get("/admins", response_model=list[EmployeeOut])
def list_admins(
    admin: User      = Depends(require_admin),
    db:    DBSession = Depends(get_db),
):
    """
    Return all admin-role users except the caller.
    Used to populate the transfer-team target dropdown.
    """
    admins = (
        db.query(User)
        .filter(User.role == "admin", User.id != admin.id, User.is_active.is_(True))
        .order_by(User.name)
        .all()
    )
    return [EmployeeOut.model_validate(a) for a in admins]


# ── Audit Log ─────────────────────────────────────────────────────────────────

@router.get("/audit-log", response_model=list[AuditLogOut])
def get_audit_log(
    limit:  int = Query(100, ge=1, le=500),
    offset: int = Query(0,   ge=0),
    admin:  User      = Depends(require_admin),
    db:     DBSession = Depends(get_db),
):
    """Return this admin's audit trail, newest first."""
    logs = (
        db.query(AuditLog)
        .filter(AuditLog.admin_id == admin.id)
        .order_by(AuditLog.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [AuditLogOut.model_validate(l) for l in logs]