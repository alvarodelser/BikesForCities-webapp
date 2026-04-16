import os
import pytest
from dotenv import load_dotenv
from backend.database.db_io import connect_db

# Try loading .env variables to ensure database connection works.
# Assuming standard layout where .env might be root or one level up
load_dotenv()
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

@pytest.fixture(scope="session")
def db_connection():
    """
    Session-level fixture that provides a direct database connection
    to the real database. This is used for Data Integrity tests.
    """
    conn = connect_db()
    # Ensure it's alive, otherwise pytest will loudly fail early
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT 1")
        conn.rollback()
    except Exception as e:
        pytest.fail(f"Failed to connect to the actual database! Check .env variables. Error: {e}")
        
    yield conn
    conn.close()

@pytest.fixture(scope="function")
def transactional_db(db_connection):
    """
    Function-level fixture that forces a rollback after the test finishes.
    This safely allows mutation tests to interact with the database.
    """
    # Clear any aborted transaction state from previous tests
    db_connection.rollback()
    
    # By default psycopg2 starts transactions automatically,
    # ensuring we are in one so a rollback will clear the work.
    db_connection.autocommit = False
    
    yield db_connection

    # Revert all changes
    db_connection.rollback()
