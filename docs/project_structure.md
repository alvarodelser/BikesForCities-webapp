
## Root Directory Structure

```
BikesForCities-webbackend/
├── 📁 backend/                          # Main application package
|   ├── 📁 api/                          # API layer
|   |   ├── 📄 __init__.py                   # API package initialization
|   |   ├── 📄 main.py                       # FastAPI application entry point
|   |   ├── 📄 models.py                     # Pydantic data models
|   |   ├── 📄 routes.py                     # API route definitions
|   |   └── 📄 dependencies.py               # Dependency injection
|   ├── 📁 cache/                        # Application cache
|   ├── 📁 database/                     # Database operations
|   |   ├── 📄 __init__.py                   # Database package initialization
|   |   ├── 📄 city_io.py                 # City I/O operations
|   |   └── 📄 schema.sql                    # Database schema
|   ├── 📁 processing/                   # Data processing modules
|   |   ├── 📄 __init__.py                   # Processing package initialization
|   |   ├── 📄 feature_ops.py                # Feature operations
|   |   ├── 📄 city_ops.py                # City operations
|   |   ├── 📄 route_strategy.py             # Route strategy algorithms
|   |   ├── 📄 trip_loader.py                # Trip data loading
|   |   └── 📄 visualization.py              # Data visualization
|   └── 📄 __init__.py                   # Package initialization
├── 📁 cache/                        # Application cache directory
├── 📁 data/                         # Data storage directory
├── 📁 deprecated_code/              # Legacy/obsolete code
├── 📁 logs/                         # Application logs
├── 📁 notebooks/                    # Jupyter notebooks for analysis
├── 📁 plots/                        # Generated plots and visualizations
├── 📁 scripts/                      # Utility scripts
scripts/
|   ├── 📄 __init__.py                   # Scripts package initialization
|   ├── 📄 database_summary.py           # Database summary generation
|   ├── 📄 plot_database.py              # Database plotting utilities
|   ├── 📄 01_load_cities/02_load_osm.py                # Database population script
|   └── 📄 03_load_trips.py             # Trip data ingestion script
├── 📁 .venv/                        # Python virtual environment
├── 📄 .gitignore                    # Git ignore rules
├── 📄 README.md                     # Project documentation
├── 📄 requirements.txt              # Python dependencies
├── 📄 Dockerfile                    # Docker configuration for API
├── 📄 docker-compose.yml            # Docker Compose configuration (API/Backend + Database)
```
