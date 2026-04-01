---
description: How to query or modify the local PostgreSQL database using SQL
---
# Database Query Instructions

Whenever you need to quickly inspect or modify database tables via raw SQL queries, **DO NOT** write inline `python3 -c "import psycopg2..."` commands in the terminal. These are prone to escaping errors and `.env` authentication failures.

Instead, always use the dedicated utility script:

```bash
# Before querying, ensure you are using the virtual environment if required
source b4c_venv/bin/activate

# Execute your SQL query directly via this script:
python3 scripts/query_db.py "SELECT COUNT(*) FROM routes WHERE city_id = 3;"
```

This script will securely handle parsing the environment configurations and output formatted tables for `SELECT` queries, or execute `UPDATE`/`INSERT`/`DELETE` queries and return the affected rows cleanly.
