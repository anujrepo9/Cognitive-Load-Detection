"""
run_migration.py — adds the missing `behavior_id` column to the
`predictions` table in PostgreSQL.

Run from the backend directory:
    python run_migration.py

Requires the same .env / DATABASE_URL that the main app uses.
"""
import sys
import os

# Allow running from the backend directory
sys.path.insert(0, os.path.dirname(__file__))

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # dotenv optional; DATABASE_URL may already be set in env

from config import DATABASE_URL
import psycopg2
from urllib.parse import urlparse

def get_conn():
    r = urlparse(DATABASE_URL)
    return psycopg2.connect(
        host=r.hostname,
        port=r.port or 5432,
        dbname=r.path.lstrip("/"),
        user=r.username,
        password=r.password,
    )

def run():
    print(f"Connecting to: {DATABASE_URL!r}")
    conn = get_conn()
    conn.autocommit = True
    cur = conn.cursor()

    # ── 1. Check if column already exists ────────────────────────────────────
    cur.execute("""
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'predictions'
          AND column_name = 'behavior_id';
    """)
    if cur.fetchone():
        print("✓ Column predictions.behavior_id already exists — nothing to do.")
        conn.close()
        return

    # ── 2. Add the column ─────────────────────────────────────────────────────
    print("Adding column predictions.behavior_id ...")
    cur.execute("""
        ALTER TABLE predictions
            ADD COLUMN behavior_id INTEGER;
    """)
    print("✓ Column added.")

    # ── 3. Add FK constraint (matches the SQLAlchemy model) ──────────────────
    # Check if constraint already exists first
    cur.execute("""
        SELECT constraint_name
        FROM information_schema.table_constraints
        WHERE table_name       = 'predictions'
          AND constraint_name  = 'fk_predictions_behavior_id';
    """)
    if not cur.fetchone():
        print("Adding FK constraint ...")
        cur.execute("""
            ALTER TABLE predictions
                ADD CONSTRAINT fk_predictions_behavior_id
                FOREIGN KEY (behavior_id)
                REFERENCES behavior_data(id)
                ON DELETE SET NULL;
        """)
        print("✓ FK constraint added.")
    else:
        print("✓ FK constraint already exists.")

    conn.close()
    print("\nMigration complete. Restart uvicorn.")

if __name__ == "__main__":
    run()