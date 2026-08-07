import bcrypt
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from config import (
    SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES,
    JWT_REFRESH_SECRET, REFRESH_TOKEN_EXPIRE_DAYS, REFRESH_TOKEN_BYTES,
)
from database.db import get_db
from database.models import User, RefreshToken

bearer = HTTPBearer()


# ── Password helpers ──────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


# ── JWT helpers ───────────────────────────────────────────────────────────────

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    payload = data.copy()
    expire  = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    payload.update({"exp": expire})
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )


# ── Refresh tokens ────────────────────────────────────────────────────────────

def _hash_refresh_token(raw: str) -> str:
    """SHA-256 hash of the raw token — stored in DB, never the raw value."""
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def create_refresh_token(user: User, db: Session) -> str:
    """Generate a random refresh token, persist its hash, return the raw token."""
    raw = secrets.token_urlsafe(REFRESH_TOKEN_BYTES)
    expires_at = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)

    # Revoke any existing active tokens for this user (single-session policy)
    db.query(RefreshToken).filter(
        RefreshToken.user_id == user.id,
        RefreshToken.revoked.is_(False),
    ).update({"revoked": True, "revoked_at": datetime.now(timezone.utc)})

    db.add(RefreshToken(
        user_id=user.id,
        token_hash=_hash_refresh_token(raw),
        expires_at=expires_at,
    ))
    db.commit()
    return raw


def validate_refresh_token(raw: str, db: Session) -> User:
    """Validate a raw refresh token; return the owning :class:`User`.

    Raises 401 if the token is unknown, revoked, or expired.
    """
    token_hash = _hash_refresh_token(raw)
    record = db.query(RefreshToken).filter(
        RefreshToken.token_hash == token_hash
    ).first()

    if not record or record.revoked:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    if datetime.now(timezone.utc) > record.expires_at:
        # Mark expired token as revoked to keep the table clean
        record.revoked = True
        record.revoked_at = datetime.now(timezone.utc)
        db.commit()
        raise HTTPException(status_code=401, detail="Refresh token expired")

    user = db.query(User).get(record.user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    return user


def revoke_refresh_token(raw: str, db: Session) -> None:
    """Revoke a refresh token on logout (idempotent)."""
    token_hash = _hash_refresh_token(raw)
    record = db.query(RefreshToken).filter(
        RefreshToken.token_hash == token_hash
    ).first()
    if record and not record.revoked:
        record.revoked = True
        record.revoked_at = datetime.now(timezone.utc)
        db.commit()


# ── FastAPI dependency ────────────────────────────────────────────────────────

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    payload = decode_token(credentials.credentials)
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    return user
