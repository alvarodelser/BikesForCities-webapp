"""connection.py – database connection factory."""
import os
import psycopg2


def connect_db():
    """Return a new psycopg2 connection using environment variables."""
    return psycopg2.connect(
        dbname=os.getenv("POSTGRES_DB"),
        user=os.getenv("POSTGRES_USER"),
        password=os.getenv("POSTGRES_PASSWORD"),
        host=os.getenv("POSTGRES_HOST"),
        port=os.getenv("POSTGRES_PORT", "5432"),
    )

def check_alive(conn) -> bool:
    """Return True if the database connection is alive."""
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT 1")
        return True
    except Exception:
        return False
