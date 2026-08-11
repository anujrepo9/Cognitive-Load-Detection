from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, Float, DateTime,
    ForeignKey, Boolean, Text
)
from sqlalchemy.orm import relationship
from database.db import Base


def utcnow():
    return datetime.now(timezone.utc)


# ── Users ─────────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id         = Column(Integer, primary_key=True, index=True)
    name       = Column(String(120), nullable=False)
    email      = Column(String(255), unique=True, index=True, nullable=False)
    password   = Column(String(255), nullable=False)   # bcrypt hash
    is_active  = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    sessions   = relationship("Session", back_populates="user",
                               cascade="all, delete-orphan")
    refresh_tokens = relationship("RefreshToken", back_populates="user",
                                  cascade="all, delete-orphan")
    settings   = relationship("UserSettings", back_populates="user",
                               uselist=False, cascade="all, delete-orphan")


# ── Refresh Tokens ────────────────────────────────────────────────────────────

class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id"), nullable=False)
    token_hash = Column(String(128), unique=True, index=True, nullable=False)  # SHA-256
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

    # Keyboard features
    typing_wpm          = Column(Integer,  default=0)
    chars_per_min       = Column(Integer,  default=0)
    avg_hold_ms         = Column(Float,    default=0.0)
    avg_flight_ms       = Column(Float,    default=0.0)
    error_rate          = Column(Float,    default=0.0)
    pause_count         = Column(Integer,  default=0)
    avg_pause_ms        = Column(Float,    default=0.0)
    typing_variance     = Column(Float,    default=0.0)

    # Mouse features
    avg_cursor_speed    = Column(Float,    default=0.0)
    movement_distance   = Column(Float,    default=0.0)
    click_rate          = Column(Float,    default=0.0)
    double_click_rate   = Column(Float,    default=0.0)
    scroll_rate         = Column(Float,    default=0.0)
    idle_time_pct       = Column(Float,    default=0.0)
    avg_hover_ms        = Column(Float,    default=0.0)
    movement_smoothness = Column(Float,    default=0.0)

    session = relationship("Session", back_populates="behaviors")


# ── Predictions ───────────────────────────────────────────────────────────────

class Prediction(Base):
    __tablename__ = "predictions"

    id           = Column(Integer, primary_key=True, index=True)
    session_id   = Column(Integer, ForeignKey("sessions.id"), nullable=False)
    behavior_id  = Column(Integer, ForeignKey("behavior_data.id"), nullable=True)  # linked behavior
    load_level   = Column(String(10), nullable=False)   # low | medium | high
    confidence   = Column(Float,      nullable=False)
    raw_scores   = Column(Text,       nullable=True)    # JSON string {low:.., medium:.., high:..}
    created_at   = Column(DateTime(timezone=True), default=utcnow, index=True)

    session  = relationship("Session", back_populates="predictions")
    behavior = relationship("BehaviorData", foreign_keys=[behavior_id])


# ── User Settings ─────────────────────────────────────────────────────────────

class UserSettings(Base):
    __tablename__ = "user_settings"

    id                   = Column(Integer, primary_key=True, index=True)
    user_id              = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    tracking_enabled     = Column(Boolean, default=True)
    flush_interval_sec   = Column(Integer, default=5)
    notifications_enabled= Column(Boolean, default=True)
    theme                = Column(String(20), default="system")   # light | dark | system
    updated_at           = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    user = relationship("User", back_populates="settings")
