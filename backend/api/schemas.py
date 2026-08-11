from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, field_validator


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
    id:    int
    name:  str
    email: str

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
    typing_wpm:          int   = 0
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
    movement_smoothness: float = 0.0


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


class SessionOut(BaseModel):
    session_id:       int
    start_time:       Optional[datetime]
    end_time:         Optional[datetime]
    duration:         Optional[str]
    avg_load:         Optional[str]
    prediction_count: int

    model_config = {"from_attributes": True}


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


class EndSessionResponse(BaseModel):
    session_id: int
    end_time:   datetime
    duration:   str


# ── Reports ───────────────────────────────────────────────────────────────────

class DailyReportEntry(BaseModel):
    date:             str         # YYYY-MM-DD
    sessions:         int
    predictions:      int
    avg_wpm:          float
    dominant_load:    Optional[str]
    load_distribution: dict


class DailyReportResponse(BaseModel):
    days: list[DailyReportEntry]


class WeeklyReportEntry(BaseModel):
    week_start:       str         # YYYY-MM-DD (Monday)
    sessions:         int
    predictions:      int
    avg_wpm:          float
    dominant_load:    Optional[str]
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
    stats:    list[FeatureStatEntry]
    per_load: dict   # {low: {feature: mean}, medium: ..., high: ...}
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
