# Bikes for Cities: Server Deployment & Ingestion Strategy

This document outlines the step-by-step strategy for deploying the Bikes for Cities backend APIs, tile server, and database seamlessly using an identical repository model between local development and your production server.

## 1. Environment Variables Configuration (`.env`)

You must configure the `.env` file explicitly on the server's filesystem. Since we support multiple environments (Staging/Production) on the same server, we use variables to prevent port and container name conflicts.

**Create your `.env` (Production example):**
```env
# Essential Environment Flag
ENVIRONMENT=production
DEBUG=false

# Core Authentication
POSTGRES_USER=your_secure_user
POSTGRES_PASSWORD=your_secure_password
POSTGRES_DB=bikes_database

# Internal Docker Networking (Optional, defaults are usually fine)
POSTGRES_HOST=b4c_database
POSTGRES_INTERNAL_PORT=5432

# External Host Ports (Must be unique per instance)
DB_PORT_HOST=127.0.0.1:4000
API_PORT_HOST=127.0.0.1:4001
TILE_PORT_HOST=127.0.0.1:4002

# Container Names (Must be unique per instance)
DB_CONTAINER_NAME=b4c_database
API_CONTAINER_NAME=b4c_backend_api
TILE_CONTAINER_NAME=b4c_tile_server
```

> **Multi-Instance Support**: If you are deploying a **Staging** version in a different folder, ensure you change the `_PORT_HOST` values (e.g., to `4100`, `4101`, `4102`) and append `_stg` to the `_CONTAINER_NAME` values to avoid Docker conflicts.

## 2. Docker Deployment

Your `docker-compose.yml` natively binds the services (`b4c_database`, `b4c_backend_api`, `b4c_tile_server`) perfectly to `127.0.0.1`. By locking binding to localhost rather than `0.0.0.0`, external malicious IP scans cannot reach your Python API or Postgres Database. 

**Deployment Flow:**
1. Pull standard code onto the server: `git pull origin main`
2. Start the services continuously:
   ```bash
   docker-compose up -d --build
   ```

## 3. Database Migrations

The project includes an automatic migration system located in `backend/database/migrations`. 

- **Automatic Execution**: The `run_migrations.py` script executes automatically inside the `b4c_backend_api` container every time it starts. It will wait for the database to be available before running any pending `.sql` files.
- **Tracking**: Executed migrations are recorded in the `schema_migrations` table to ensure each script runs exactly once.
- **Manual Execution**: If needed, you can run migrations manually from the server shell (ensure your `.env` is loaded):
  ```bash
  ./b4c_venv/bin/python backend/database/run_migrations.py
  ```

## 4. Nginx Reverse Proxy Configuration

To allow external legitimate traffic, proxy port `80/443` down to your securely bound docker containers.

**Update Server Block Configuration (e.g. `/etc/nginx/sites-available/...`):**
```nginx
server {
    listen 80;
    server_name wiig.dia.fi.upm.es; # Your API domain

    # Route requests to the FastAPI backend (b4c_backend_api)
    location /b4c_api/ {
        proxy_pass http://127.0.0.1:4001/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Route tile layer requests to Martin Server (b4c_tile_server)
    location /b4c_tiles/ {
        proxy_pass http://127.0.0.1:4002/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
*(Make sure to use Certbot for TLS/SSL certificates over your domain!)*

## 5. The Ingestion Pipeline Deployment

The python ingestion scripts populate PostGIS with mapping constraints and live trip data. It must safely connect locally to execute reliably.

**Execution Outline:**
1. Create a native virtual environment:
   ```bash
   python3 -m venv b4c_venv
   source b4c_venv/bin/activate
   pip install -r requirements.txt
   ```
2. Your ingestion scripts target the Localhost Database. Since port `127.0.0.1:4000` is bound safely via Docker natively, your python ingestion scripts interact identically as local development.
    - Automated: Run the master script to execute everything in sequence: `./ingestion/run_ingestion.sh`
    - Manual: Run specific steps, e.g., `python ingestion/01_cities/011_load_wikidata.py`.

**Automation (Cron):**
For daily updates (such as refreshing active stations):
```bash
crontab -e
```
Add the task targeting your virtual environment directly alongside your `.env` variables:
```bash
# Example: Run the station daily sync at 3 AM Server Time
0 3 * * * cd /path/to/bikes-for-cities && source .env && /path/to/bikes-for-cities/b4c_venv/bin/python ingestion/03_stations/031_sync_data.py >> logs/ingestion.log 2>&1
```
