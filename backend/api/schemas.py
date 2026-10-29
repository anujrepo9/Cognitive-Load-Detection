from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, EmailStr, field_validator


def _as_utc(value):
    """Attach a UTC tzinfo to naive datetimes before they're serialized.

    SQLite (unlike Postgres) doesn't actually persist timezone info even
    though the SQLAlchemy column is declared DateTime(timezone=True) — every
    value that comes back from the DB is a naive datetime, even though it's
    always UTC (see database/models.py's utcnow()). Left naive, Pydantic
    serializes it without a "Z"/offset suffix, so the browser's
    `new Date(...)` parses it as LOCAL time instead of UTC — e.g. for a user
    in IST (UTC+5:30), "just started" sessions show up as 330 minutes old.
    """
    if isinstance(value, datetime) and value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


# ── Auth ──────────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    name:     str
    email:    EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v):
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v


class LoginRequest(BaseModel):
    email:    EmailStr
    password: str


class UserOut(BaseModel):
    id:         int
    name:       str
    email:      str
    role:       str = "employee"
    manager_id: Optional[int] = None

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token:  str
    refresh_token: str
    token_type:    str = "bearer"
    user:          UserOut


class RefreshRequest(BaseModel):
    refresh_token: str


class RefreshResponse(BaseModel):
    access_token:  str
    refresh_token: str
    token_type:    str = "bearer"


class LogoutRequest(BaseModel):
    refresh_token: str


class ProfileUpdateRequest(BaseModel):
    name:  Optional[str] = None
    email: Optional[EmailStr] = None

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v):
        if v is not None and not v.strip():
            raise ValueError("Name cannot be empty")
        return v


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password:     str

    @field_validator("new_password")
    @classmethod
    def new_password_min_length(cls, v):
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v


# ── Behavior ──────────────────────────────────────────────────────────────────

class BehaviorPayload(BaseModel):
    """Feature vector sent from browser or Python collector every 5 s."""
    typing_wpm:          Optional[int] = None   # None = not enough data; 0 treated as None
    chars_per_min:       int   = 0
    avg_hold_ms:         float = 0.0
    avg_flight_ms:       float = 0.0
    error_rate:          float = 0.0
    pause_count:         int   = 0
    avg_pause_ms:        float = 0.0
    typing_variance:     float = 0.0
    avg_cursor_speed:    float = 0.0
    movement_distance:   float = 0.0
    click_rate:          float = 0.0
    double_click_rate:   float = 0.0
    scroll_rate:         float = 0.0
    idle_time_pct:       float = 0.0
    avg_hover_ms:        float = 0.0
    avg_acceleration:    float = 0.0
    movement_smoothness: float = 0.0
    # Display-only counts for the live dashboard (not stored, not ML features)
    keys_pressed:        Optional[int] = None
    mouse_events:        Optional[int] = None


class BehaviorResponse(BaseModel):
    status:     str
    session_id: int
    record_id:  int


# ── Prediction ────────────────────────────────────────────────────────────────

class PredictionResponse(BaseModel):
    load_level:  str          # low | medium | high
    confidence:  float
    scores:      dict         # {low: .., medium: .., high: ..}
    session_id:  int


# ── Dashboard ─────────────────────────────────────────────────────────────────

class DashboardResponse(BaseModel):
    sessions_today:      int
    avg_load:            str
    total_predictions:   int
    label_distribution:  dict
    wpm_trend:           list
    feature_importance:  list
    avg_wpm:             Optional[float] = None
    typing_events:       Optional[int]   = None
    mouse_events:        Optional[int]   = None


class SessionOut(BaseModel):
    session_id:       int
    start_time:       Optional[datetime]
    end_time:         Optional[datetime]
    duration:         Optional[str]
    avg_load:         Optional[str]
    prediction_count: int

    model_config = {"from_attributes": True}

    _normalize_start = field_validator("start_time", mode="before")(_as_utc)
    _normalize_end   = field_validator("end_time",   mode="before")(_as_utc)


class HistoryResponse(BaseModel):
    sessions: list[SessionOut]


# ── Recommendation ────────────────────────────────────────────────────────────

class Recommendation(BaseModel):
    type:   str
    title:  str
    reason: str


class RecommendationResponse(BaseModel):
    load_level:      str
    recommendations: list[Recommendation]


# ── Session lifecycle ─────────────────────────────────────────────────────────

class CurrentSessionResponse(BaseModel):
    session_id:        int
    start_time:        Optional[datetime]
    duration_seconds:  int
    prediction_count:  int
    latest_load:       Optional[str]
    latest_confidence: Optional[float]
    collector_running: bool = False
    collector_mode:    str = "browser"
    collector_error:   Optional[str] = None
    keys_pressed:      Optional[int] = None
    mouse_events:      Optional[int] = None
    typing_wpm:        Optional[float] = None

    _normalize_start = field_validator("start_time", mode="before")(_as_utc)


class EndSessionResponse(BaseModel):
    session_id: int
    end_time:   datetime
    duration:   str

    _normalize_end = field_validator("end_time", mode="before")(_as_utc)


# ── Reports ───────────────────────────────────────────────────────────────────

class DailyReportEntry(BaseModel):
    date:              str         # YYYY-MM-DD
    sessions:          int
    predictions:       int
    avg_wpm:           float
    dominant_load:     Optional[str]
    load_distribution: dict


class DailyReportResponse(BaseModel):
    days: list[DailyReportEntry]


class WeeklyReportEntry(BaseModel):
    week_start:        str         # YYYY-MM-DD (Monday)
    sessions:          int
    predictions:       int
    avg_wpm:           float
    dominant_load:     Optional[str]
    load_distribution: dict


class WeeklyReportResponse(BaseModel):
    weeks: list[WeeklyReportEntry]


# ── Analytics ─────────────────────────────────────────────────────────────────

class TrendPoint(BaseModel):
    timestamp:  str
    load_level: str
    confidence: float
    wpm:        Optional[int] = None


class AnalyticsTrendsResponse(BaseModel):
    points:    list[TrendPoint]
    total:     int
    from_time: Optional[str]
    to_time:   Optional[str]


class FeatureStatEntry(BaseModel):
    feature: str
    mean:    float
    std:     float
    min:     float
    max:     float


class AnalyticsFeaturesResponse(BaseModel):
    stats:         list[FeatureStatEntry]
    per_load:      dict   # {low: {feature: mean}, medium: ..., high: ...}
    total_records: int


# ── Settings ──────────────────────────────────────────────────────────────────

class SettingsResponse(BaseModel):
    tracking_enabled:      bool
    flush_interval_sec:    int
    notifications_enabled: bool
    theme:                 str

    model_config = {"from_attributes": True}


class SettingsUpdateRequest(BaseModel):
    tracking_enabled:      Optional[bool] = None
    flush_interval_sec:    Optional[int]  = None
    notifications_enabled: Optional[bool] = None
    theme:                 Optional[str]  = None

    @field_validator("flush_interval_sec")
    @classmethod
    def interval_range(cls, v):
        if v is not None and not (1 <= v <= 300):
            raise ValueError("flush_interval_sec must be between 1 and 300")
        return v

    @field_validator("theme")
    @classmethod
    def valid_theme(cls, v):
        if v is not None and v not in ("light", "dark", "system"):
            raise ValueError("theme must be light, dark, or system")
        return v


# ── History (extended) ────────────────────────────────────────────────────────

class HistoryResponsePaginated(BaseModel):
    sessions:    list[SessionOut]
    total:       int
    page:        int
    per_page:    int
    total_pages: int


# ── Model info ────────────────────────────────────────────────────────────────

class ModelInfoResponse(BaseModel):
    version:    str
    type:       str
    calibrated: Optional[bool]  = None
    trained_at: Optional[str]   = None
    accuracy:   Optional[float] = None
    cv_mean:    Optional[float] = None
    cv_std:     Optional[float] = None
    n_samples:  Optional[int]   = None
    features:   list[str]


# ── App Usage ─────────────────────────────────────────────────────────────────

class AppUsageEntry(BaseModel):
    process:      str
    window_title: str   = ""
    duration_sec: float


class AppUsageBatchPayload(BaseModel):
    """Sent by the collector once per flush window."""
    usages: list[AppUsageEntry]


class AppUsageOut(BaseModel):
    id:           int
    process:      str
    window_title: str
    duration_sec: float
    recorded_at:  str

    model_config = {"from_attributes": True}


class AppUsageSummaryEntry(BaseModel):
    process:           str
    total_seconds:     float
    percentage:        float   # 0–100, share of total tracked time
    last_window_title: str


class AppUsageSummaryResponse(BaseModel):
    period_hours:  int
    total_tracked: float       # total seconds across all apps
    apps:          list[AppUsageSummaryEntry]

# ── Admin / Team Management ───────────────────────────────────────────────────

class AdminRegisterEmployeeRequest(BaseModel):
    """Admin creates an account for an employee."""
    name:     str
    email:    EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v):
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v


class AdminUpdateEmployeeRequest(BaseModel):
    """Admin updates an employee account."""
    name:     Optional[str]      = None
    email:    Optional[EmailStr] = None
    password: Optional[str]      = None
    is_active: Optional[bool]    = None

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v):
        if v is not None and len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v


class EmployeeOut(BaseModel):
    id:         int
    name:       str
    email:      str
    is_active:  bool
    created_at: Optional[datetime] = None
    role:       str = "employee"

    model_config = {"from_attributes": True}


class EmployeeDetailOut(EmployeeOut):
    """Employee summary including recent cognitive load snapshot."""
    latest_load:       Optional[str]   = None
    latest_confidence: Optional[float] = None
    sessions_today:    int             = 0
    avg_load_today:    Optional[str]   = None


class AdminAlertRequest(BaseModel):
    employee_id: int
    alert_type:  str = "custom"    # high_load | low_load | custom
    title:       str
    message:     str

    @field_validator("alert_type")
    @classmethod
    def valid_alert_type(cls, v):
        allowed = {"high_load", "low_load", "custom"}
        if v not in allowed:
            raise ValueError(f"alert_type must be one of {allowed}")
        return v


class AdminAlertOut(BaseModel):
    id:          int
    admin_id:    int
    employee_id: int
    alert_type:  str
    title:       str
    message:     str
    is_read:     bool
    created_at:  Optional[datetime] = None
    read_at:     Optional[datetime] = None

    model_config = {"from_attributes": True}


class EmployeeAppUsageSummaryResponse(BaseModel):
    employee_id:   int
    employee_name: str
    period_hours:  int
    total_tracked: float
    apps:          list  # list[AppUsageSummaryEntry] — reuses existing type


class EmployeeCogniLoadSnapshot(BaseModel):
    """Latest cognitive-load summary for one employee — used on admin dashboard."""
    employee_id:       int
    employee_name:     str
    email:             str
    latest_load:       Optional[str]   = None
    latest_confidence: Optional[float] = None
    sessions_today:    int             = 0
    avg_load_today:    Optional[str]   = None
    top_app:           Optional[str]   = None   # most-used app in last 8 h
    unread_alerts:     int             = 0


# ── Admin Settings ────────────────────────────────────────────────────────────

class AlertTemplate(BaseModel):
    label:      str
    alert_type: str = "custom"
    title:      str
    message:    str

    @field_validator("alert_type")
    @classmethod
    def valid_type(cls, v):
        if v not in {"high_load", "low_load", "custom"}:
            raise ValueError("alert_type must be high_load | low_load | custom")
        return v


class AdminSettingsOut(BaseModel):
    high_load_threshold_count: int   = 0
    min_confidence:            float = 0.75
    dashboard_refresh_sec:     int   = 60
    alert_templates:           list[AlertTemplate] = []
    updated_at:                Optional[datetime]  = None

    model_config = {"from_attributes": True}


class AdminSettingsUpdate(BaseModel):
    high_load_threshold_count: Optional[int]               = None
    min_confidence:            Optional[float]             = None
    dashboard_refresh_sec:     Optional[int]               = None
    alert_templates:           Optional[list[AlertTemplate]] = None

    @field_validator("min_confidence")
    @classmethod
    def confidence_range(cls, v):
        if v is not None and not (0.0 <= v <= 1.0):
            raise ValueError("min_confidence must be between 0 and 1")
        return v

    @field_validator("high_load_threshold_count")
    @classmethod
    def threshold_non_negative(cls, v):
        if v is not None and v < 0:
            raise ValueError("high_load_threshold_count must be >= 0")
        return v

    @field_validator("alert_templates")
    @classmethod
    def max_five_templates(cls, v):
        if v is not None and len(v) > 5:
            raise ValueError("Maximum 5 alert templates allowed")
        return v


# ── Promote / Transfer ────────────────────────────────────────────────────────

class PromoteRequest(BaseModel):
    """Body for POST /admin/employees/{id}/promote"""
    # No body fields needed — the endpoint is self-describing.
    # Kept as a schema so OpenAPI documents it properly.
    pass


class TransferTeamRequest(BaseModel):
    """
    Transfer all (or selected) employees from the calling admin to another admin.
    Pass employee_ids to transfer only specific members; omit to transfer everyone.
    """
    target_admin_id: int
    employee_ids:    Optional[list[int]] = None   # None → all team members


class TransferTeamResponse(BaseModel):
    transferred_count: int
    target_admin_id:   int
    target_admin_name: str


# ── Audit Log ─────────────────────────────────────────────────────────────────

class AuditLogOut(BaseModel):
    id:         int
    admin_id:   int
    action:     str
    target_id:  Optional[int]  = None
    detail:     Optional[str]  = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}