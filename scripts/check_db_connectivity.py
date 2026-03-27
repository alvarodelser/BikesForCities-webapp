import os
import psycopg2
from dotenv import load_dotenv

def test_db_connection():
    # Attempt to load from .env
    load_dotenv()
    
    db_config = {
        "dbname": os.getenv("POSTGRES_DB"),
        "user": os.getenv("POSTGRES_USER"),
        "password": os.getenv("POSTGRES_PASSWORD"),
        "host": os.getenv("POSTGRES_HOST", "localhost"),
        "port": os.getenv("POSTGRES_PORT", "5432")
    }
    
    print(f"--- Testing DB Connectivity ---")
    print(f"Target: {db_config['host']}:{db_config['port']}/{db_config['dbname']} as user {db_config['user']}")
    
    try:
        conn = psycopg2.connect(**db_config)
        print("✅ SUCCESS: Connected successfully!")
        
        with conn.cursor() as cur:
            cur.execute("SELECT version();")
            version = cur.fetchone()
            print(f"Server version: {version[0]}")
            
            cur.execute("SELECT count(*) FROM cities;")
            cities_count = cur.fetchone()[0]
            print(f"Number of cities in DB: {cities_count}")
            
        conn.close()
    except Exception as e:
        print(f"❌ FAILURE: {e}")
        print("\nPossible solutions:")
        print("1. Is the Docker container running? (docker ps)")
        print("2. Is the host correct in .env? (Use localhost for host, db for docker-network)")
        print("3. Are the credentials correct in .env?")

if __name__ == "__main__":
    test_db_connection()
