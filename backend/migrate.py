"""
migrate.py — brings an existing CogniLoad database up to the current schema.

Safely adds any missing tables and columns without touching existing data.
Run from the backend/ directory:

    python migrate.py

Works with both SQLite (dev) and PostgreSQL (prod).
"""

import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from config import DATABASE_URL
from sqlalchemy import create_engine, inspect, text

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {},
)

IS_SQLITE = "sqlite" in DATABASE_URL


def col_exists(inspector, table, column):
    return any(c["name"] == column for c in inspector.get_columns(table))


def table_exists(inspector, table):
    return table in inspector.get_table_names()


def run():
    inspector = inspect(engine)

    with engine.begin() as conn:

        # ── 1. user_settings table ────────────────────────────────────────────
        if not table_exists(inspector, "user_settings"):
            print("Creating table: user_settings ...")
            conn.execute(text("""
                CREATE TABLE user_settings (
                    id                    INTEGER PRIMARY KEY,
                    user_id               INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
                    tracking_enabled      BOOLEAN DEFAULT TRUE,
                    flush_interval_sec    INTEGER DEFAULT 5,
                    notifications_enabled BOOLEAN DEFAULT TRUE,
                    theme                 VARCHAR(20) DEFAULT 'system',
                    updated_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            """ if not IS_SQLITE else """
                CREATE TABLE user_settings (
                    id                    INTEGER PRIMARY KEY,
                    user_id               INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
                    tracking_enabled      INTEGER DEFAULT 1,
                    flush_interval_sec    INTEGER DEFAULT 5,
                    notifications_enabled INTEGER DEFAULT 1,
                    theme                 TEXT DEFAULT 'system',
                    updated_at            DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """))
            print("  ✓ user_settings created")
        else:
            print("✓ user_settings already exists")

        # ── 2. predictions.behavior_id ────────────────────────────────────────
        if not col_exists(inspector, "predictions", "behavior_id"):
            print("Adding column: predictions.behavior_id ...")
            conn.execute(text(
                "ALTER TABLE predictions ADD COLUMN behavior_id INTEGER REFERENCES behavior_data(id) ON DELETE SET NULL"
                if not IS_SQLITE else
                "ALTER TABLE predictions ADD COLUMN behavior_id INTEGER"
            ))
            print("  ✓ predictions.behavior_id added")
        else:
            print("✓ predictions.behavior_id already exists")

        # ── 3. behavior_data.created_at ───────────────────────────────────────
        if not col_exists(inspector, "behavior_data", "created_at"):
            print("Adding column: behavior_data.created_at ...")
            if IS_SQLITE:
                conn.execute(text(
                    "ALTER TABLE behavior_data ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP"
                ))
                # Back-fill from timestamp column if it exists
                if col_exists(inspector, "behavior_data", "timestamp"):
                    conn.execute(text(
                        "UPDATE behavior_data SET created_at = timestamp WHERE created_at IS NULL"
                    ))
            else:
                conn.execute(text(
                    "ALTER TABLE behavior_data ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()"
                ))
                if col_exists(inspector, "behavior_data", "timestamp"):
                    conn.execute(text(
                        'UPDATE behavior_data SET created_at = "timestamp" WHERE created_at IS NULL'
                    ))
            print("  ✓ behavior_data.created_at added")
        else:
            print("✓ behavior_data.created_at already exists")

        # ── 4. sessions.end_time nullable check (already nullable by design) ──
        # Nothing to migrate — end_time has always been nullable.

        # ── 5. refresh_tokens table ───────────────────────────────────────────
        if not table_exists(inspector, "refresh_tokens"):
            print("Creating table: refresh_tokens ...")
            conn.execute(text("""
                CREATE TABLE refresh_tokens (
                    id         INTEGER PRIMARY KEY,
                    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    token_hash VARCHAR(128) NOT NULL UNIQUE,
                    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                    revoked    BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    revoked_at TIMESTAMP WITH TIME ZONE
                )
            """ if not IS_SQLITE else """
                CREATE TABLE refresh_tokens (
                    id         INTEGER PRIMARY KEY,
                    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    token_hash TEXT NOT NULL UNIQUE,
                    expires_at DATETIME NOT NULL,
                    revoked    INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    revoked_at DATETIME
                )
            """))
            print("  ✓ refresh_tokens created")
        else:
            print("✓ refresh_tokens already exists")

    print("\nMigration complete. Restart the backend server.")


if __name__ == "__main__":
    run()