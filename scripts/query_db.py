#!/usr/bin/env python3
"""
query_db.py 
A utility script to execute arbitrary SQL queries directly against the locally 
configured PostgreSQL database. It handles .env authentication securely.

Usage:
    python3 scripts/query_db.py "SELECT COUNT(*) FROM routes;"
    python3 scripts/query_db.py "DELETE FROM routes WHERE strategy = 'station-based synthetic';"
"""

import sys
import os
from pathlib import Path

# Add project root to path for absolute imports if needed
PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(PROJECT_ROOT))

from dotenv import load_dotenv
import psycopg2

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 scripts/query_db.py \"<SQL_QUERY>\"")
        sys.exit(1)
        
    query = sys.argv[1].strip()
    if not query:
        print("Error: Empty query provided.")
        sys.exit(1)

    load_dotenv()
    
    try:
        conn = psycopg2.connect(
            dbname=os.environ.get('POSTGRES_DB', 'bikes_db'),
            user=os.environ.get('POSTGRES_USER', 'postgres'),
            password=os.environ.get('POSTGRES_PASSWORD', ''),
            host=os.environ.get('POSTGRES_HOST', '127.0.0.1'),
            port=os.environ.get('POSTGRES_PORT', '5432')
        )
    except Exception as e:
        print(f"Failed to connect to database: {e}")
        sys.exit(1)

    # Use autocommit for massive deletes or manual transaction blocks sent by the user
    conn.autocommit = True

    with conn.cursor() as cur:
        print(f"\n⚡ Executing Query: \n{query}\n")
        try:
            cur.execute(query)
            
            if cur.description is not None:
                # Query was a SELECT (or returned data)
                rows = cur.fetchall()
                cols = [desc[0] for desc in cur.description]
                print(f"✅ Query returned {len(rows)} matching rows.\n")
                
                if rows:
                    # Very simple tabular print for debugging
                    print(" | ".join(f"{c:<15}" for c in cols))
                    print("-" * (18 * len(cols)))
                    for row in rows[:50]: # limit print to 50 rows
                        print(" | ".join(f"{str(v):<15}" for v in row))
                        
                    if len(rows) > 50:
                        print(f"... and {len(rows)-50} more rows.")
            else:
                # Query was an INSERT/UPDATE/DELETE
                print(f"✅ Success! Rows affected: {cur.rowcount}")
                
        except Exception as e:
            print(f"❌ SQL Execution Error:\n{e}")
            sys.exit(1)
            
    conn.close()

if __name__ == "__main__":
    main()
