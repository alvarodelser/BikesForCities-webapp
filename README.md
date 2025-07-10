# BikesForCities Webapp

A web application for analyzing and visualizing bike traffic data in cities. This project includes a backend (FastAPI), a frontend, and a PostGIS-enabled PostgreSQL database, all orchestrated with Docker Compose.

## Project Structure

```
BikesForCities-webapp/
├── app/                # Backend application (FastAPI)
├── Data/               # Data files (excluded from git)
├── cache/              # Cache files (excluded from git)
├── logs/               # Log files (excluded from git)
├── frontend/           # Frontend application
├── docker-compose.yml  # Docker Compose configuration
├── Dockerfile          # Backend Dockerfile
├── .env                # Environment variables (not committed)
├── .gitignore          # Git ignore rules
└── README.md           # This file
```

## Deployment Instructions

### 1. Prerequisites
- [Docker](https://www.docker.com/get-started)

### 2. Create a `.env` file
Create a `.env` file in the project root with the following variables:

```
POSTGRES_USER=your_postgres_user
POSTGRES_PASSWORD=your_postgres_password
POSTGRES_DB=your_database_name
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
PYTHONPATH=.


# API Configuration
API_HOST=0.0.0.0
API_PORT=8000
API_RELOAD=true

# Frontend Configuration
REACT_APP_API_URL=http://localhost:8000

# Development Settings
DEBUG=true
LOG_LEVEL=INFO 
```

### 3. Start the Application
Run the following command in the project root:

```
docker-compose up --build
```

This will start:
- A PostGIS-enabled PostgreSQL database
- The FastAPI backend (on port 8000)
- The frontend (on port 3000)

### 4. Access the Application
- Backend API: [http://localhost:8000](http://localhost:8000)
- Frontend: [http://localhost:3000](http://localhost:3000)

## Notes
- Data, cache, and logs directories are excluded from git and are mounted as volumes in the containers.
- The database schema is initialized from `schema.sql` on first run.
- For development, you can modify the backend and frontend code and restart the respective containers.
- Run populate_db to start loading networks into the database.
- Add trip csv from Madrid Datos Abiertos into Data/{city}/ folder and run trip_ingestion.py to start adding routes to an existing network 

---

For more details, see the `app_specifications.md`, `backend_specifications.md`, and `frontend_specifications.md` files. 