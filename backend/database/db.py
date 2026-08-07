from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from config import DATABASE_URL

# SQLite for dev, swap DATABASE_URL for PostgreSQL in production
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {},
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


class Base(DeclarativeBase):
    pass


def get_db():
    """FastAPI dependency — yields a DB session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create all tables (called once on startup)."""
    from database import models   # noqa: F401 — ensures models are registered
    Base.metadata.create_all(bind=engine)


def dispose_engine():
    """Gracefully close the connection pool (called once on shutdown)."""
    engine.dispose()
