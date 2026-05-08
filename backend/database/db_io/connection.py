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
            
            # Use the host-side port if we are on the host
            # Try to get it from DB_PORT_HOST first (e.g. "127.0.0.1:4000")
            db_port_host = os.getenv("DB_PORT_HOST")
            if db_port_host and ":" in db_port_host:
                port = db_port_host.split(":")[-1]
            elif port == "5432":
                # Fallback to defaults based on folder name or just 4000/4100
                cwd = os.getcwd()
                if "stg" in cwd or "staging" in cwd:
                    port = "4100"
                else:
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
