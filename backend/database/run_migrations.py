import os
import sys
import logging
import time
from pathlib import Path
from dotenv import load_dotenv

# Add the parent directory to sys.path so we can import from backend
sys.path.append(str(Path(__file__).resolve().parents[2]))

from backend.database.db_io.connection import connect_db

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def run_migrations():
    # Load environment variables
    load_dotenv()

    migrations_dir = Path(__file__).resolve().parent / "migrations"
    if not migrations_dir.exists():
        logger.error(f"Migrations directory not found: {migrations_dir}")
        return

    # Wait for database availability
    max_retries = 10
    retry_delay = 3
    conn = None
    
    for i in range(max_retries):
        try:
            conn = connect_db()
            break
        except Exception as e:
            if i < max_retries - 1:
                logger.info(f"Database not ready, retrying in {retry_delay}s... ({i+1}/{max_retries})")
                time.sleep(retry_delay)
            else:
                logger.error(f"Could not connect to database after {max_retries} attempts.")
                sys.exit(1)

    try:
        conn.autocommit = False # Use transactions
        cur = conn.cursor()

        # 1. Ensure schema_migrations table exists
        cur.execute("""
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version VARCHAR(255) PRIMARY KEY,
                executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        conn.commit()

        # 2. Get executed migrations
        cur.execute("SELECT version FROM schema_migrations")
        executed_migrations = {row[0] for row in cur.fetchall()}

        # 3. Get migration files
        migration_files = sorted([f for f in migrations_dir.glob("*.sql")])
        
        count = 0
        for migration_file in migration_files:
            version = migration_file.name
            if version not in executed_migrations:
                logger.info(f"Executing migration: {version}")
                try:
                    with open(migration_file, 'r', encoding='utf-8') as f:
                        sql = f.read()
                        if sql.strip():
                            cur.execute(sql)
                    
                    # Record migration
                    cur.execute(
                        "INSERT INTO schema_migrations (version) VALUES (%s)",
                        (version,)
                    )
                    conn.commit()
                    logger.info(f"Successfully executed {version}")
                    count += 1
                except Exception as e:
                    conn.rollback()
                    logger.error(f"Error executing migration {version}: {e}")
                    raise e
        
        if count == 0:
            logger.info("No new migrations to run.")
        else:
            logger.info(f"Finished running {count} migrations.")

    except Exception as e:
        logger.error(f"Migration failed: {e}")
        sys.exit(1)
    finally:
        if 'conn' in locals() and conn:
            conn.close()

if __name__ == "__main__":
    run_migrations()
