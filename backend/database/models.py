from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, Float, DateTime,
    ForeignKey, Boolean, Text, JSON,
)
from sqlalchemy.orm import relationship
from database.db import Base

def utcnow():
    return datetime.now(timezone.utc)


# ── Users ─────────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"
 
    id          = Column(Integer, primary_key=True, index=True)
    name        = Column(String(120), nullable=False)
    email       = Column(String(255), unique=True, index=True, nullable=False)
    password    = Column(String(255), nullable=False)   # bcrypt hash
    is_active   = Column(Boolean, default=True)
    created_at  = Column(DateTime(timezone=True), default=utcnow)
 
    # "employee" (default) | "admin"
    role        = Column(String(20), default="employee", nullable=False)
    # For employees: points to their admin/manager's user.id
    manager_id  = Column(Integer, ForeignKey("users.id"), nullable=True)
 
    sessions        = relationship("Session", back_populates="user",
                                   cascade="all, delete-orphan")
    refresh_tokens  = relationship("RefreshToken", back_populates="user",
                                   cascade="all, delete-orphan")
    settings        = relationship("UserSettings", back_populates="user",
                                   uselist=False, cascade="all, delete-orphan")
    admin_settings  = relationship("AdminSettings", back_populates="admin",
                                   uselist=False, cascade="all, delete-orphan")

    # Admin/manager responsible for this employee
    manager = relationship(
        "User",
        foreign_keys=[manager_id],
        remote_side=[id],
        back_populates="team_members",
    )
    # Employees under this admin
    team_members = relationship(
        "User",
        foreign_keys=[manager_id],
        back_populates="manager",
    )
 
    # Alerts this admin has sent / this employee has received
    sent_alerts     = relationship("AdminAlert", foreign_keys="AdminAlert.admin_id",
                                   back_populates="admin",
                                   cascade="all, delete-orphan")
    received_alerts = relationship("AdminAlert", foreign_keys="AdminAlert.employee_id",
                                   back_populates="employee",
                                   cascade="all, delete-orphan")
 
    # Audit log entries created by this admin
    audit_logs      = relationship("AuditLog", foreign_keys="AuditLog.admin_id",
                                   back_populates="admin",
                                   cascade="all, delete-orphan")
    
    
# ── Refresh Tokens ────────────────────────────────────────────────────────────
 
class RefreshToken(Base):
    __tablename__ = "refresh_tokens"
 
    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id"), nullable=False)
    token_hash = Column(String(128), unique=True, index=True, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    revoked    = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
 
    user = relationship("User", back_populates="refresh_tokens")
 
 
# ── Sessions ──────────────────────────────────────────────────────────────────
 
class Session(Base):
    __tablename__ = "sessions"
 
    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id"), nullable=False)
    start_time = Column(DateTime(timezone=True), default=utcnow)
    end_time   = Column(DateTime(timezone=True), nullable=True)
 
    user        = relationship("User", back_populates="sessions")
    behaviors   = relationship("BehaviorData", back_populates="session",
                               cascade="all, delete-orphan")
    predictions = relationship("Prediction", back_populates="session",
                               cascade="all, delete-orphan")
 
 
# ── Behavior Data ─────────────────────────────────────────────────────────────
 
class BehaviorData(Base):
    __tablename__ = "behavior_data"
 
    id                  = Column(Integer, primary_key=True, index=True)
    session_id          = Column(Integer, ForeignKey("sessions.id"), nullable=False)
    timestamp           = Column(DateTime(timezone=True), default=utcnow, index=True)
    created_at          = Column(DateTime(timezone=True), default=utcnow, index=True)
 
    typing_wpm          = Column(Integer,  nullable=True, default=None)
    chars_per_min       = Column(Integer,  default=0)
    avg_hold_ms         = Column(Float,    default=0.0)
    avg_flight_ms       = Column(Float,    default=0.0)
    error_rate          = Column(Float,    default=0.0)
    pause_count         = Column(Integer,  default=0)
    avg_pause_ms        = Column(Float,    default=0.0)
    typing_variance     = Column(Float,    default=0.0)
 
    avg_cursor_speed    = Column(Float,    default=0.0)
    movement_distance   = Column(Float,    default=0.0)
    click_rate          = Column(Float,    default=0.0)
    double_click_rate   = Column(Float,    default=0.0)
    scroll_rate         = Column(Float,    default=0.0)
    idle_time_pct       = Column(Float,    default=0.0)
    avg_hover_ms        = Column(Float,    default=0.0)
    avg_acceleration    = Column(Float,    default=0.0)
    movement_smoothness = Column(Float,    default=0.0)
 
    session = relationship("Session", back_populates="behaviors")
 
 
# ── Predictions ───────────────────────────────────────────────────────────────
 
class Prediction(Base):
    __tablename__ = "predictions"
 
    id           = Column(Integer, primary_key=True, index=True)
    session_id   = Column(Integer, ForeignKey("sessions.id"), nullable=False)
    behavior_id  = Column(Integer, ForeignKey("behavior_data.id"), nullable=True)
    load_level   = Column(String(10), nullable=False)
    confidence   = Column(Float,      nullable=False)
    raw_scores   = Column(Text,       nullable=True)
    created_at   = Column(DateTime(timezone=True), default=utcnow, index=True)
 
    session  = relationship("Session", back_populates="predictions")
    behavior = relationship("BehaviorData", foreign_keys=[behavior_id])
 
 
# ── User Settings ─────────────────────────────────────────────────────────────
 
class UserSettings(Base):
    __tablename__ = "user_settings"
 
    id                    = Column(Integer, primary_key=True, index=True)
    user_id               = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    tracking_enabled      = Column(Boolean, default=True)
    flush_interval_sec    = Column(Integer, default=15)
    notifications_enabled = Column(Boolean, default=True)
    theme                 = Column(String(20), default="system")
    updated_at            = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
 
    user = relationship("User", back_populates="settings")
 
 
# ── Admin Settings ────────────────────────────────────────────────────────────
 
class AdminSettings(Base):
    """
    One row per admin user.  Stores all team-management preferences:
      - alert thresholds
      - dashboard auto-refresh interval
      - up to 3 custom alert templates (stored as JSON)
    """
    __tablename__ = "admin_settings"
 
    id         = Column(Integer, primary_key=True, index=True)
    admin_id   = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
 
    # ── Alert thresholds ──────────────────────────────────────────────────────
    # Auto-alert fires when an employee's load is "high" for this many
    # consecutive predictions (each prediction ≈ flush_interval_sec seconds).
    # 0 = auto-alerts disabled.
    high_load_threshold_count = Column(Integer, default=0)
 
    # Minimum confidence required before a prediction counts toward the threshold.
    # Range 0.0–1.0  (default 0.75 = 75 %).
    min_confidence            = Column(Float, default=0.75)
 
    # ── Dashboard ─────────────────────────────────────────────────────────────
    # How often the admin dashboard auto-refreshes (seconds). 0 = manual only.
    dashboard_refresh_sec     = Column(Integer, default=60)
 
    # ── Custom alert templates ────────────────────────────────────────────────
    # Stored as a JSON array of objects:
    #   [{ "label": "...", "alert_type": "custom", "title": "...", "message": "..." }, ...]
    # Maximum 5 templates.
    alert_templates           = Column(JSON, default=list)
 
    admin = relationship("User", back_populates="admin_settings")
 

# ── App Usage Log ─────────────────────────────────────────────────────────────
 
class AppUsageLog(Base):
    __tablename__ = "app_usage_logs"
 
    id            = Column(Integer, primary_key=True, index=True)
    user_id       = Column(Integer, ForeignKey("users.id"), nullable=False)
    session_id    = Column(Integer, ForeignKey("sessions.id"), nullable=True)
    process       = Column(String(120), nullable=False, index=True)
    window_title  = Column(String(512), nullable=True)
    duration_sec  = Column(Float, nullable=False, default=0.0)
    recorded_at   = Column(DateTime(timezone=True), default=utcnow, index=True)
 
    user    = relationship("User")
    session = relationship("Session")
 
 
# ── Admin Alerts ──────────────────────────────────────────────────────────────
 
class AdminAlert(Base):
    __tablename__ = "admin_alerts"
 
    id          = Column(Integer, primary_key=True, index=True)
    admin_id    = Column(Integer, ForeignKey("users.id"), nullable=False)
    employee_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    alert_type  = Column(String(30), nullable=False, default="custom")
    title       = Column(String(200), nullable=False)
    message     = Column(Text, nullable=False)
    is_read     = Column(Boolean, default=False)
    created_at  = Column(DateTime(timezone=True), default=utcnow, index=True)
    read_at     = Column(DateTime(timezone=True), nullable=True)
 
    admin    = relationship("User", foreign_keys=[admin_id],  back_populates="sent_alerts")
    employee = relationship("User", foreign_keys=[employee_id], back_populates="received_alerts")
 
 
# ── Audit Log ─────────────────────────────────────────────────────────────────
 
class AuditLog(Base):
    """
    Records every sensitive admin action so there's a tamper-evident trail.
    Actions: promote_to_admin | revoke_admin | transfer_team |
             create_employee | update_employee | deactivate_employee |
             send_alert | delete_alert
    """
    __tablename__ = "audit_logs"
 
    id          = Column(Integer, primary_key=True, index=True)
    admin_id    = Column(Integer, ForeignKey("users.id"), nullable=False)
    action      = Column(String(60),  nullable=False, index=True)
    target_id   = Column(Integer, nullable=True)    # user_id / alert_id affected
    detail      = Column(Text,    nullable=True)    # free-form JSON context
    created_at  = Column(DateTime(timezone=True), default=utcnow, index=True)

    admin = relationship("User", foreign_keys=[admin_id], back_populates="audit_logs")
 