"""
routes/admin.py — Admin / Team-Leader management endpoints.

All routes require the caller to be authenticated AND have role == "admin".
"""

import csv
import io
import json as _json
import math
from collections import Counter, defaultdict
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
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
    AlertHistoryResponse,
    BulkAlertRequest,
    BulkAlertResponse,
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


# ── Helpers ───────────────────────────────────────────────────────────────────

def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


def _get_team_member(employee_id: int, admin: User, db: DBSession) -> User:
    employee = db.query(User).filter(
        User.id == employee_id,
        User.manager_id == admin.id,
    ).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    return employee


def _audit(db: DBSession, admin_id: int, action: str,
           target_id: int | None = None, detail: dict | None = None):
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


# ── Employee CRUD ─────────────────────────────────────────────────────────────

@router.post("/employees", response_model=EmployeeOut, status_code=201)
def create_employee(
    body:  AdminRegisterEmployeeRequest,
    admin: User      = Depends(require_admin),
    db:    DBSession = Depends(get_db),
):
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=409, detail="Email already registered")

    employee = User(
        name       = body.name,
        email      = body.email,
        password   = hash_password(body.password),
        role       = "employee",
        manager_id = admin.id,
        department = body.department or None,
    )
    db.add(employee)
    db.commit()
    db.refresh(employee)

    _audit(db, admin.id, "create_employee", target_id=employee.id,
           detail={"name": employee.name, "email": employee.email,
                   "department": employee.department})

    return EmployeeOut.model_validate(employee)


@router.get("/employees", response_model=list[EmployeeOut])
def list_employees(
    admin: User      = Depends(require_admin),
    db:    DBSession = Depends(get_db),
):
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
    employee = _get_team_member(employee_id, admin, db)
    return _build_employee_detail(employee, db)


@router.patch("/employees/{employee_id}", response_model=EmployeeOut)
def update_employee(
    employee_id: int,
    body:  AdminUpdateEmployeeRequest,
    admin: User      = Depends(require_admin),
    db:    DBSession = Depends(get_db),
):
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

    if body.department is not None:
        employee.department = body.department.strip() or None

    db.commit()
    db.refresh(employee)

    _audit(db, admin.id, "update_employee", target_id=employee.id,
           detail={"name": employee.name})

    return EmployeeOut.model_validate(employee)


@router.delete("/employees/{employee_id}", status_code=204)
def delete_employee(
    employee_id: int,
    hard:  bool      = Query(False),
    admin: User      = Depends(require_admin),
    db:    DBSession = Depends(get_db),
):
    employee = _get_team_member(employee_id, admin, db)

    if hard:
        db.delete(employee)
    else:
        employee.is_active = False

    db.commit()

    _audit(db, admin.id, "deactivate_employee", target_id=employee_id,
           detail={"hard": hard})

    return None


# ── Employee monitoring ───────────────────────────────────────────────────────

@router.get("/employees/{employee_id}/cogniload")
def employee_cogniload(
    employee_id: int,
    limit: int   = Query(50, ge=1, le=500),
    admin: User      = Depends(require_admin),
    db:    DBSession = Depends(get_db),
):
    _get_team_member(employee_id, admin, db)

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


@router.get("/employees/{employee_id}/load-trends")
def employee_load_trends(
    employee_id: int,
    period: str = Query("daily", regex="^(daily|weekly)$"),
    days:   int = Query(30, ge=7, le=90),
    admin: User      = Depends(require_admin),
    db:    DBSession = Depends(get_db),
):
    """
    Aggregated cognitive-load trends for one employee.

    Returns:
      daily_series  — one point per day/week: { date, avg_score, pct_high,
                      pct_medium, pct_low, count }
      dow_heatmap   — per weekday (Mon=1…Sun=7): { dow, label, avg_score,
                      pct_high, count }
      summary       — window totals + worst_day_label, worst_dow_label

    avg_score encoding: low=1, medium=2, high=3
    """
    _get_team_member(employee_id, admin, db)

    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    preds = (
        db.query(Prediction)
        .join(UserSession, Prediction.session_id == UserSession.id)
        .filter(
            UserSession.user_id    == employee_id,
            Prediction.created_at >= cutoff,
        )
        .order_by(Prediction.created_at.asc())
        .all()
    )

    if not preds:
        return {
            "daily_series": [],
            "dow_heatmap":  [],
            "summary": {
                "total_predictions": 0,
                "pct_high": 0, "pct_medium": 0, "pct_low": 0,
                "worst_day_label": None, "worst_dow_label": None,
            },
        }

    def score(p):
        return 3 if p.load_level == "high" else 2 if p.load_level == "medium" else 1

    # Bucket by date or ISO week
    buckets: dict[str, list] = defaultdict(list)
    for p in preds:
        ts = p.created_at
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        if period == "weekly":
            iso = ts.isocalendar()
            key = f"{iso[0]}-W{iso[1]:02d}"
        else:
            key = ts.strftime("%Y-%m-%d")
        buckets[key].append(p)

    def bucket_stats(ps):
        total  = len(ps)
        n_high = sum(1 for p in ps if p.load_level == "high")
        n_med  = sum(1 for p in ps if p.load_level == "medium")
        n_low  = sum(1 for p in ps if p.load_level == "low")
        return {
            "avg_score":  round(sum(score(p) for p in ps) / total, 3),
            "pct_high":   round(n_high / total * 100, 1),
            "pct_medium": round(n_med  / total * 100, 1),
            "pct_low":    round(n_low  / total * 100, 1),
            "count":      total,
        }

    daily_series = []
    for key in sorted(buckets.keys()):
        s = bucket_stats(buckets[key])
        s["date"] = key
        daily_series.append(s)

    # Day-of-week heatmap
    DOW_LABELS = {1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat", 7: "Sun"}
    dow_buckets: dict[int, list] = defaultdict(list)
    for p in preds:
        ts = p.created_at
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        dow_buckets[ts.isoweekday()].append(p)

    dow_heatmap = []
    for dow in range(1, 8):
        ps = dow_buckets.get(dow, [])
        if not ps:
            dow_heatmap.append({"dow": dow, "label": DOW_LABELS[dow],
                                 "avg_score": None, "pct_high": None, "count": 0})
            continue
        s = bucket_stats(ps)
        dow_heatmap.append({
            "dow":       dow,
            "label":     DOW_LABELS[dow],
            "avg_score": s["avg_score"],
            "pct_high":  s["pct_high"],
            "count":     s["count"],
        })

    # Summary
    total_p = len(preds)
    n_high  = sum(1 for p in preds if p.load_level == "high")
    n_med   = sum(1 for p in preds if p.load_level == "medium")
    n_low   = sum(1 for p in preds if p.load_level == "low")

    worst_day = max(daily_series, key=lambda d: d["avg_score"], default=None)
    worst_dow = max(
        [d for d in dow_heatmap if d["avg_score"] is not None],
        key=lambda d: d["avg_score"],
        default=None,
    )

    return {
        "daily_series": daily_series,
        "dow_heatmap":  dow_heatmap,
        "summary": {
            "total_predictions": total_p,
            "pct_high":          round(n_high / total_p * 100, 1),
            "pct_medium":        round(n_med  / total_p * 100, 1),
            "pct_low":           round(n_low  / total_p * 100, 1),
            "worst_day_label":   worst_day["date"]  if worst_day else None,
            "worst_dow_label":   worst_dow["label"] if worst_dow else None,
        },
    }


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
    _get_team_member(employee_id, admin, db)

    query = db.query(UserSession).filter(UserSession.user_id == employee_id)
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
    _get_team_member(body.employee_id, admin, db)

    alert = AdminAlert(
        admin_id    = admin.id,
        employee_id = body.employee_id,
        alert_type  = body.alert_type,
        title       = body.title,
        message     = body.message,
        is_auto     = False,
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)

    _audit(db, admin.id, "send_alert", target_id=alert.id,
           detail={"employee_id": body.employee_id, "title": body.title})

    return AdminAlertOut.model_validate(alert)


@router.post("/alerts/bulk", response_model=BulkAlertResponse, status_code=201)
def send_bulk_alert(
    body:  BulkAlertRequest,
    admin: User      = Depends(require_admin),
    db:    DBSession = Depends(get_db),
):
    """
    Send the same alert to multiple employees at once.
    Pass employee_ids=[] to target every active team member.
    """
    if body.employee_ids:
        targets = (
            db.query(User)
            .filter(
                User.id.in_(body.employee_ids),
                User.manager_id == admin.id,
            )
            .all()
        )
        missing = set(body.employee_ids) - {t.id for t in targets}
        if missing:
            raise HTTPException(
                status_code=404,
                detail=f"Employees not found or not in your team: {sorted(missing)}",
            )
    else:
        targets = (
            db.query(User)
            .filter(
                User.manager_id == admin.id,
                User.is_active.is_(True),
            )
            .all()
        )

    if not targets:
        raise HTTPException(status_code=400, detail="No target employees found")

    alerts = []
    for emp in targets:
        alert = AdminAlert(
            admin_id    = admin.id,
            employee_id = emp.id,
            alert_type  = body.alert_type,
            title       = body.title,
            message     = body.message,
            is_auto     = False,
        )
        db.add(alert)
        alerts.append(alert)

    db.commit()
    for a in alerts:
        db.refresh(a)

    _audit(db, admin.id, "send_bulk_alert", detail={
        "count": len(alerts),
        "alert_type": body.alert_type,
        "title": body.title,
    })

    return BulkAlertResponse(
        sent_count   = len(alerts),
        employee_ids = [a.employee_id for a in alerts],
    )


@router.get("/alerts", response_model=AlertHistoryResponse)
def list_sent_alerts(
    employee_id: Optional[int]  = Query(None),
    alert_type:  Optional[str]  = Query(None),
    is_read:     Optional[bool] = Query(None),
    is_auto:     Optional[bool] = Query(None),
    date_from:   Optional[str]  = Query(None),
    date_to:     Optional[str]  = Query(None),
    page:        int            = Query(1,  ge=1),
    per_page:    int            = Query(25, ge=1, le=200),
    admin: User      = Depends(require_admin),
    db:    DBSession = Depends(get_db),
):
    """Paginated, filterable alert history."""
    q = db.query(AdminAlert).filter(AdminAlert.admin_id == admin.id)

    if employee_id is not None:
        q = q.filter(AdminAlert.employee_id == employee_id)
    if alert_type is not None:
        q = q.filter(AdminAlert.alert_type == alert_type)
    if is_read is not None:
        q = q.filter(AdminAlert.is_read == is_read)
    if is_auto is not None:
        q = q.filter(AdminAlert.is_auto == is_auto)
    if date_from:
        try:
            dt_from = datetime.fromisoformat(date_from).replace(tzinfo=timezone.utc)
            q = q.filter(AdminAlert.created_at >= dt_from)
        except ValueError:
            raise HTTPException(status_code=422, detail="date_from must be YYYY-MM-DD")
    if date_to:
        try:
            dt_to = datetime.fromisoformat(date_to).replace(
                hour=23, minute=59, second=59, tzinfo=timezone.utc
            )
            q = q.filter(AdminAlert.created_at <= dt_to)
        except ValueError:
            raise HTTPException(status_code=422, detail="date_to must be YYYY-MM-DD")

    total       = q.count()
    total_pages = max(1, math.ceil(total / per_page))
    alerts      = (
        q.order_by(AdminAlert.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    return AlertHistoryResponse(
        alerts      = [AdminAlertOut.model_validate(a) for a in alerts],
        total       = total,
        page        = page,
        per_page    = per_page,
        total_pages = total_pages,
    )


@router.get("/alerts/employee/{employee_id}", response_model=list[AdminAlertOut])
def alerts_for_employee(
    employee_id: int,
    admin: User      = Depends(require_admin),
    db:    DBSession = Depends(get_db),
):
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
    alert = db.query(AdminAlert).filter(
        AdminAlert.id       == alert_id,
        AdminAlert.admin_id == admin.id,
    ).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    db.delete(alert)
    db.commit()

    _audit(db, admin.id, "delete_alert", target_id=alert_id)

    return None


# ── Team CSV export ───────────────────────────────────────────────────────────

@router.get("/team-export")
def team_export(
    date_from:  Optional[str] = Query(None, description="YYYY-MM-DD"),
    date_to:    Optional[str] = Query(None, description="YYYY-MM-DD"),
    department: Optional[str] = Query(None),
    admin: User      = Depends(require_admin),
    db:    DBSession = Depends(get_db),
):
    """
    Download a CSV report: avg cogniload, session count, top app per employee
    for the requested date range.
    """
    try:
        dt_from = (
            datetime.fromisoformat(date_from).replace(tzinfo=timezone.utc)
            if date_from else
            datetime.now(timezone.utc) - timedelta(days=30)
        )
        dt_to = (
            datetime.fromisoformat(date_to).replace(
                hour=23, minute=59, second=59, tzinfo=timezone.utc
            )
            if date_to else
            datetime.now(timezone.utc)
        )
    except ValueError:
        raise HTTPException(status_code=422, detail="Dates must be YYYY-MM-DD")

    q = db.query(User).filter(User.manager_id == admin.id)
    if department:
        q = q.filter(User.department == department)
    employees = q.order_by(User.name).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Name", "Email", "Department", "Status",
        "Sessions", "Total Predictions",
        "% High", "% Medium", "% Low",
        "Dominant Load", "Top App", "Period",
    ])

    period_label = f"{dt_from.date()} to {dt_to.date()}"

    for emp in employees:
        sessions = (
            db.query(UserSession)
            .filter(
                UserSession.user_id    == emp.id,
                UserSession.start_time >= dt_from,
                UserSession.start_time <= dt_to,
            )
            .all()
        )
        session_ids = [s.id for s in sessions]

        preds = (
            db.query(Prediction)
            .filter(
                Prediction.session_id.in_(session_ids),
                Prediction.created_at >= dt_from,
                Prediction.created_at <= dt_to,
            )
            .all()
        ) if session_ids else []

        total = len(preds)
        if total:
            dist  = Counter(p.load_level for p in preds)
            pct_h = round(dist["high"]   / total * 100, 1)
            pct_m = round(dist["medium"] / total * 100, 1)
            pct_l = round(dist["low"]    / total * 100, 1)
            dom   = dist.most_common(1)[0][0]
        else:
            pct_h = pct_m = pct_l = 0.0
            dom   = ""

        app_logs = (
            db.query(AppUsageLog)
            .filter(
                AppUsageLog.user_id     == emp.id,
                AppUsageLog.recorded_at >= dt_from,
                AppUsageLog.recorded_at <= dt_to,
            )
            .all()
        )
        app_totals: dict[str, float] = defaultdict(float)
        for log in app_logs:
            app_totals[log.process] += log.duration_sec
        top_app = max(app_totals, key=app_totals.__getitem__) if app_totals else ""

        writer.writerow([
            emp.name,
            emp.email,
            emp.department or "",
            "Active" if emp.is_active else "Inactive",
            len(sessions),
            total,
            pct_h,
            pct_m,
            pct_l,
            dom,
            top_app,
            period_label,
        ])

    output.seek(0)
    filename = f"team-export-{datetime.now().strftime('%Y%m%d')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ── Dashboard ─────────────────────────────────────────────────────────────────

@router.get("/dashboard", response_model=list[EmployeeCogniLoadSnapshot])
def admin_dashboard(
    admin: User      = Depends(require_admin),
    db:    DBSession = Depends(get_db),
):
    employees = (
        db.query(User)
        .filter(User.manager_id == admin.id)
        .order_by(User.name)
        .all()
    )
    return [_build_snapshot(emp, db) for emp in employees]


# ── Employee-facing: read own alerts ─────────────────────────────────────────

@router.get("/my-alerts", response_model=list[AdminAlertOut])
def my_alerts(
    current_user: User      = Depends(get_current_user),
    db:           DBSession = Depends(get_db),
):
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
    settings = _get_or_create_admin_settings(admin, db)
    return AdminSettingsOut.model_validate(settings)


@router.patch("/settings", response_model=AdminSettingsOut)
def update_admin_settings(
    body:  AdminSettingsUpdate,
    admin: User      = Depends(require_admin),
    db:    DBSession = Depends(get_db),
):
    settings = _get_or_create_admin_settings(admin, db)

    if body.high_load_threshold_count is not None:
        settings.high_load_threshold_count = body.high_load_threshold_count
    if body.high_load_threshold_minutes is not None:
        settings.high_load_threshold_minutes = body.high_load_threshold_minutes
    if body.min_confidence is not None:
        settings.min_confidence = body.min_confidence
    if body.dashboard_refresh_sec is not None:
        settings.dashboard_refresh_sec = body.dashboard_refresh_sec
    if body.alert_templates is not None:
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
    employee = _get_team_member(employee_id, admin, db)
    if employee.role == "admin":
        raise HTTPException(status_code=409, detail="User is already an admin")

    employee.role       = "admin"
    employee.manager_id = None
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
    target = db.query(User).filter(User.id == employee_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot demote yourself")
    if target.role != "admin":
        raise HTTPException(status_code=409, detail="User is not an admin")

    orphans = db.query(User).filter(User.manager_id == target.id).all()
    for orphan in orphans:
        orphan.manager_id = admin.id

    target.role       = "employee"
    target.manager_id = admin.id
    db.commit()
    db.refresh(target)

    _audit(db, admin.id, "revoke_admin", target_id=target.id,
           detail={"name": target.name, "email": target.email,
                   "orphans_reparented": len(orphans)})

    return EmployeeOut.model_validate(target)


# ── Transfer Team ─────────────────────────────────────────────────────────────

@router.post("/transfer-team", response_model=TransferTeamResponse)
def transfer_team(
    body:  TransferTeamRequest,
    admin: User      = Depends(require_admin),
    db:    DBSession = Depends(get_db),
):
    if body.target_admin_id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot transfer to yourself")

    target_admin = db.query(User).filter(
        User.id == body.target_admin_id, User.role == "admin",
    ).first()
    if not target_admin:
        raise HTTPException(status_code=404, detail="Target admin not found")

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
           detail={"to_admin_name": target_admin.name,
                   "employee_ids": transferred_ids,
                   "count": len(transferred_ids)})

    return TransferTeamResponse(
        transferred_count = len(transferred_ids),
        target_admin_id   = target_admin.id,
        target_admin_name = target_admin.name,
    )


# ── List admins (for transfer picker) ────────────────────────────────────────

@router.get("/admins", response_model=list[EmployeeOut])
def list_admins(
    admin: User      = Depends(require_admin),
    db:    DBSession = Depends(get_db),
):
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
    logs = (
        db.query(AuditLog)
        .filter(AuditLog.admin_id == admin.id)
        .order_by(AuditLog.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [AuditLogOut.model_validate(l) for l in logs]


# ── Internal helpers ──────────────────────────────────────────────────────────

def _build_employee_detail(employee: User, db: DBSession) -> EmployeeDetailOut:
    snap = _build_snapshot(employee, db)
    return EmployeeDetailOut(
        id                = employee.id,
        name              = employee.name,
        email             = employee.email,
        is_active         = employee.is_active,
        department        = employee.department,
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

    latest_pred = (
        db.query(Prediction)
        .join(UserSession)
        .filter(UserSession.user_id == employee.id)
        .order_by(Prediction.created_at.desc())
        .first()
    )

    sessions_today = (
        db.query(UserSession)
        .filter(
            UserSession.user_id    == employee.id,
            UserSession.start_time >= today_start,
        )
        .count()
    )

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

    cutoff   = datetime.now(timezone.utc) - timedelta(hours=8)
    app_logs = (
        db.query(AppUsageLog)
        .filter(
            AppUsageLog.user_id     == employee.id,
            AppUsageLog.recorded_at >= cutoff,
        )
        .all()
    )
    app_totals: dict[str, float] = defaultdict(float)
    for log in app_logs:
        app_totals[log.process] += log.duration_sec
    top_app = max(app_totals, key=app_totals.__getitem__) if app_totals else None

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
