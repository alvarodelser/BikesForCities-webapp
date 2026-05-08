"""connection.py – database connection factory."""
import os
import psycopg2


def connect_db():
    """Return a new psycopg2 connection using environment variables."""
    host = os.getenv("POSTGRES_HOST", "b4c_database")
    port = os.getenv("POSTGRES_PORT", "5432")
    
    # Smart host detection: If we are on the host machine, "b4c_database" 
    # won't resolve. We should use localhost and the mapped port instead.
    if host == "b4c_database":
        import socket
        try:
            socket.gethostbyname(host)
        except socket.gaierror:
            # We are likely on the host machine
            host = "localhost"
            # If we are on the host, we should use the port mapped in docker-compose
            # which is 4000 for production (or 4100 for staging)
            if port == "5432":
                port = "4000" 

    return psycopg2.connect(
        dbname=os.getenv("POSTGRES_DB"),
        user=os.getenv("POSTGRES_USER"),
        password=os.getenv("POSTGRES_PASSWORD"),
        host=host,
        port=port,
    )

def check_alive(conn) -> bool:
    """Return True if the database connection is alive."""
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT 1")
        return True
    except Exception:
        return False
