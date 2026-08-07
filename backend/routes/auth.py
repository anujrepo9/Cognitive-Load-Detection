from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database.db import get_db
from database.models import User
from auth.jwt import (
    hash_password, verify_password, create_access_token,
    create_refresh_token, validate_refresh_token, revoke_refresh_token,
    get_current_user,
)
from api.schemas import (
    RegisterRequest, LoginRequest, TokenResponse, UserOut,
    RefreshRequest, RefreshResponse, LogoutRequest,
    ProfileUpdateRequest, ChangePasswordRequest,
)
from core.rate_limit import make_limiter

router = APIRouter(prefix="/auth", tags=["auth"])

# ── Rate limiters (in-memory, per client IP) ─────────────────────────────────
login_limiter = make_limiter(
    max_attempts=5, window_seconds=60
)
register_limiter = make_limiter(
    max_attempts=5, window_seconds=300
)


@router.post("/register", response_model=TokenResponse, status_code=201)
def register(
    body: RegisterRequest,
    _: bool = Depends(register_limiter),
    db: Session = Depends(get_db),
):
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        name=body.name,
        email=body.email,
        password=hash_password(body.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    access_token = create_access_token({"sub": str(user.id)})
    refresh_token = create_refresh_token(user, db)
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserOut.model_validate(user),
    )


@router.post("/login", response_model=TokenResponse)
def login(
    body: LoginRequest,
    _: bool = Depends(login_limiter),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not verify_password(body.password, user.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    access_token = create_access_token({"sub": str(user.id)})
    refresh_token = create_refresh_token(user, db)
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserOut.model_validate(user),
    )


@router.post("/refresh", response_model=RefreshResponse)
def refresh(body: RefreshRequest, db: Session = Depends(get_db)):
    """Issue a new access token (and rotate refresh token) from a valid refresh token."""
    user = validate_refresh_token(body.refresh_token, db)

    # Rotate: revoke the old refresh token, issue a fresh one
    revoke_refresh_token(body.refresh_token, db)
    new_refresh = create_refresh_token(user, db)

    access = create_access_token({"sub": str(user.id)})
    return RefreshResponse(
        access_token=access,
        refresh_token=new_refresh,
    )


@router.post("/logout", status_code=204)
def logout(body: LogoutRequest, db: Session = Depends(get_db)):
    """Revoke the provided refresh token (idempotent)."""
    revoke_refresh_token(body.refresh_token, db)
    return None


@router.get("/profile", response_model=UserOut)
def profile(current_user: User = Depends(get_current_user)):
    return UserOut.model_validate(current_user)


@router.patch("/profile", response_model=UserOut)
def update_profile(
    body: ProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if body.name is not None:
        current_user.name = body.name.strip()
    if body.email is not None:
        new_email = body.email.strip().lower()
        existing = db.query(User).filter(
            User.email == new_email,
            User.id != current_user.id,
        ).first()
        if existing:
            raise HTTPException(status_code=409, detail="Email already registered")
        current_user.email = new_email

    db.commit()
    db.refresh(current_user)
    return UserOut.model_validate(current_user)


@router.post("/change-password", status_code=204)
def change_password(
    body: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(body.current_password, current_user.password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    current_user.password = hash_password(body.new_password)
    db.commit()

    # Revoke all refresh tokens so other sessions must re-login
    from database.models import RefreshToken
    from datetime import datetime, timezone
    db.query(RefreshToken).filter(
        RefreshToken.user_id == current_user.id,
        RefreshToken.revoked.is_(False),
    ).update({"revoked": True, "revoked_at": datetime.now(timezone.utc)})
    db.commit()
    return None
