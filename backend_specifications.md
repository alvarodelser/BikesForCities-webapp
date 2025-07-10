# Backend Implementation Specifications

## 1. Database Schema & Architecture

### 1.1 Core Tables ✅
- [x] **`networks`**: Store city network metadata
  - `id` (SERIAL PRIMARY KEY)
  - `name` (VARCHAR UNIQUE)
  - `city` (VARCHAR)
  - `country` (VARCHAR)
  - `center_lat` (DOUBLE PRECISION)
  - `center_lon` (DOUBLE PRECISION)
  - `radius` (DOUBLE PRECISION)
  - `created_at` (TIMESTAMP)

- [x] **`nodes`**: OSM network nodes with spatial data
  - `id` (BIGINT PRIMARY KEY)
  - `network_id` (INTEGER REFERENCES networks)
  - `geometry` (GEOMETRY(POINT, 4326))
  - `tags` (JSONB)

- [x] **`edges`**: Network edges with routing metadata
  - `id` (SERIAL PRIMARY KEY)
  - `network_id` (INTEGER REFERENCES networks)
  - `from_node` (BIGINT REFERENCES nodes)
  - `to_node` (BIGINT REFERENCES nodes)
  - `geometry` (GEOMETRY(LINESTRING, 4326))
  - `highway` (VARCHAR)
  - `length` (DOUBLE PRECISION)
  - `maxspeed` (INTEGER)
  - `lanes` (INTEGER)
  - `tags` (JSONB)

- [x] **`routes`**: Computed trip routes
  - `id` (SERIAL PRIMARY KEY)
  - `network_id` (INTEGER REFERENCES networks)
  - `origin_node` (BIGINT REFERENCES nodes)
  - `destination_node` (BIGINT REFERENCES nodes)
  - `id_trip` (VARCHAR UNIQUE)
  - `id_bike` (VARCHAR)
  - `duration_minutes` (INTEGER)
  - `strategy` (VARCHAR)
  - `created_at` (TIMESTAMP)

### 1.2 OSM Feature Tables ✅
- [x] **`features`**: Store extracted OSM features
  - `id` (SERIAL PRIMARY KEY)
  - `network_id` (INTEGER REFERENCES networks)
  - `feature_type` (VARCHAR) -- 'buildings', 'waterways', 'forest', etc.
  - `geometry` (GEOMETRY(GEOMETRY, 4326))
  - `tags` (JSONB)
  - `extracted_at` (TIMESTAMP)

### 1.3 Spatial Indexing ✅
- [x] **GIST Indexes**: Spatial indexes on all geometry columns
- [x] **B-tree Indexes**: Standard indexes on foreign keys and lookup columns
- [x] **Composite Indexes**: Multi-column indexes for common query patterns

### 1.4 Data Integrity ✅
- [x] **Foreign Key Constraints**: Enforce referential integrity
- [x] **Unique Constraints**: Prevent duplicate data
- [x] **Check Constraints**: Validate data ranges and formats
- [x] **Conflict Resolution**: `ON CONFLICT DO NOTHING` for bulk operations

---

## 2. Core Backend Modules

### 2.1 Database Operations (`app/database/network_io.py`)

#### Connection Management
- [x] `connect_db()` - PostgreSQL connection with environment variables
- [x] Connection pooling and proper resource cleanup
- [x] Error handling for connection failures

#### Network Management
- [x] `get_or_create_network(name, city, country)` - Network CRUD operations
- [x] `get_all_networks()` - List all available networks
- [x] `get_network_by_name(name)` - Retrieve specific network
- [x] `get_network_center(network_id)` - Get network center coordinates

#### Data Insertion
- [x] `put_nodes(network_id, nodes_data)` - Bulk node insertion with conflict handling
- [x] `put_edges(network_id, edges_data)` - Bulk edge insertion with spatial data
- [x] `put_routes(network_id, routes_data)` - Bulk route insertion with deduplication
- [x] `put_features(network_id, features_data)` - Bulk feature insertion

#### Data Retrieval
- [x] `get_nodes(network_id, limit=None, offset=None)` - Paginated node retrieval
- [x] `get_edges(network_id, limit=None, offset=None)` - Paginated edge retrieval
- [x] `get_routes(network_id, limit=None, offset=None)` - Paginated route retrieval
- [x] `get_features(network_id, feature_type=None, limit=None, offset=None)` - Retrieve features

#### Statistics & Analytics
- [x] `count_nodes(network_id)` - Node count for network
- [x] `count_edges(network_id)` - Edge count for network
- [x] `count_routes(network_id)` - Route count for network
- [x] `count_features(network_id, feature_type=None)` - Feature count by type
- [x] `get_network_bounds(network_id)` - Geographic bounding box

### 2.2 Network Processing (`app/processing/network_ops.py`)

#### Graph Operations
- [x] `load_graph(place_name, network_type='bike')` - OSMnx graph download with caching
- [x] `build_graph(network_id)` - Reconstruct NetworkX graph from database
- [x] `validate_graph(graph)` - Sanity checking (minimum nodes/edges)

#### Data Extraction
- [x] `extract_nodes(graph)` - Convert OSM nodes to database format
- [x] `extract_edges(graph)` - Convert OSM edges with metadata parsing
- [x] Metadata parsing for highway types, speeds, lanes, and geometric properties

#### Caching System
- [x] File-based caching for downloaded OSM graphs
- [x] Cache invalidation and management
- [x] Configurable cache directory

### 2.3 OSM Feature Processing (`app/processing/feature_ops.py`)

#### Feature Type Definitions
- [x] **Base Features**: Buildings, waterways, forest, bike_paths, coastline, land
- [x] **Calculated Features**: bike_path_buildings (buildings within 150m of bike paths), sea (derived from coastline)
- [x] OSM tag mappings for each feature type

#### Feature Extraction
- [x] `extract_features_for_network(network_id, distance=10000)` - Extract all features from OSM using `ox.features_from_point()`
- [x] `get_boundary(lat, lon, angle, width, height)` - Generate boundary polygon for visualization
- [x] `get_bike_path_buildings(bike_paths, buildings, buffer_distance=150)` - Calculate buildings near bike paths
- [x] `get_sea(boundary, coastline, land)` - Derive sea areas from coastline and land

#### Coordinate Transformations ✅
- [x] `TO_WSG84` and `TO_WEBMERCATOR` transformer objects
- [x] Proper CRS handling for spatial operations
- [x] Buffer analysis with coordinate system transformations

### 2.4 Trip Processing (`app/processing/trip_loader.py`) ✅

#### Batch Processing
- [x] `process_all_csvs(data_dir, network_id)` - Process multiple CSV files
- [x] `process_single_csv(csv_path, network_id)` - Process individual CSV file
- [x] `load_next_csv(data_dir, network_id)` - Resume processing from checkpoints

#### Trip Processing Pipeline
- [x] CSV parsing with pandas
- [x] Coordinate extraction from JSON fields
- [x] Nearest node finding with spatial queries
- [x] Route computation using NetworkX shortest path
- [x] Distance validation with configurable thresholds

#### Progress & Error Handling
- [x] Real-time progress bars with tqdm
- [x] Checkpoint system for resumable processing
- [x] Graceful handling of unreachable destinations
- [x] Detailed error logging and statistics

### 2.5 Routing Engine (`app/processing/route_strategy.py`)

#### Routing Algorithms
- [x] `shortest_path(graph, origin, destination)` - Dijkstra shortest path
- [ ] `fastest_path(graph, origin, destination)` - Time-based routing
- [ ] `safest_path(graph, origin, destination)` - Safety-optimized routing

#### Strategy Framework
- [x] Extensible routing strategy interface
- [x] Strategy selection and configuration
- [ ] Custom routing algorithms

### 2.6 Visualization Engine (`app/processing/visualization.py`)

#### Network Visualization
- [x] `plot_network_overview(networks)` - Multi-network comparison charts
- [x] `plot_network_graph(network_id, sample_size=None)` - Geographic network plots
- [x] `plot_cycleway_network(network_id)` - Dedicated bike infrastructure
- [x] `plot_highway_distribution(network_id)` - Highway type analysis

#### OSM Feature Visualization ✅
- [x] `plot_features_map(network_id, boundary_settings, features_data, save_path=None)` - Multi-layer feature maps
- [x] `generate_features_map(network_id, boundary_settings, save_path=None)` - Generate complete feature maps
- [x] `plot_features_overview(network_id)` - Feature statistics overview
- [x] `load_features_from_db(network_id, boundary_polygon=None)` - Load and filter features
- [x] `add_compass_rose(ax, angle)` - North arrow for rotated maps
- [x] `add_annotation(ax, text, width, height)` - Coverage and statistics annotations

#### Statistical Analysis
- [x] `print_network_stats(network_id)` - Comprehensive network statistics
- [x] Node/edge counts and geographic bounds
- [x] Highway type distribution and connectivity analysis
- [x] Trip statistics and processing metrics

#### Export Capabilities
- [x] Save plots as PNG files with configurable resolution
- [x] Interactive plot display with matplotlib (notebook-friendly)
- [x] Configurable figure sizes and sampling for performance
- [x] Return `fig, ax` objects for notebook integration

---

## 3. Command Line Interface

### 3.1 Network Setup (`scripts/populate_db.py`) ✅
- [x] **Interactive City Selection**: Choose from spain_data.json configuration
- [x] **OSM Data Download**: Automated network download with progress tracking
- [x] **Database Population**: Bulk insertion with performance timing
- [x] **Feature Extraction**: Extract and store OSM features during network setup
- [x] **Error Handling**: Graceful handling of download and insertion failures

### 3.2 Trip Processing (`scripts/trip_ingestion.py`) ✅
- [x] **Batch Processing Mode**: Process all CSV files in Data/ directory
- [x] **Single File Mode**: Process specific CSV file
- [x] **Resume Capability**: Continue from previous checkpoint
- [x] **Configuration Options**:
  - `--strategy`: Routing strategy selection
  - `--max-distance`: Maximum distance threshold for valid trips
  - `--single-file`: Process only specified file

### 3.3 Database Analysis (`scripts/database_summary.py`) ✅
- [x] **Network Overview**: List all networks with statistics
- [x] **Feature Statistics**: Report feature counts by type
- [x] **Data Completeness**: Validate data integrity and completeness
- [x] **Performance Metrics**: Processing statistics and timing information
- [x] **Multi-network Support**: Handle multiple cities in single database

### 3.4 Data Visualization (`scripts/plot_database.py`) ✅
- [x] **Plot Type Selection**: Multiple visualization types
- [x] **Feature Visualization**: OSM feature maps and overviews
- [x] **Output Options**: Save to files or display interactively
- [x] **Configuration Options**:
  - `--plot-type`: Choose visualization type (overview, graph, cycleway, highways, features)
  - `--save-plots`: Save plots to files instead of displaying
  - `--output-dir`: Specify output directory for saved plots
  - `--network`: Specify network for visualization
  - `--sample-size`: Limit nodes/edges for performance

---

## 4. REST API Implementation

### 4.1 Basic FastAPI Setup
- [x] **Simple FastAPI app**: Basic application with CORS
- [x] **Direct database connection**: No ORM, direct psycopg2 queries
- [x] **Basic error handling**: Simple try/catch error responses

### 4.2 Network Endpoints
```python
# Network Data
GET    /api/networks                    # List all networks
GET    /api/networks/{id}               # Get network details
GET    /api/networks/{id}/stats         # Get network statistics
GET    /api/networks/{id}/nodes         # Get network nodes (paginated, bbox)
GET    /api/networks/{id}/edges         # Get network edges (paginated, filters)
GET    /api/networks/{id}/routes        # Get routes with filtering (paginated)

# OSM Features
GET    /api/networks/{id}/features      # Get features by network (paginated, filters)
GET    /api/networks/{id}/features/geojson  # Export as GeoJSON

# Health & Metadata
GET    /api/health                      # Health check
GET    /api/health/detailed             # Health check with DB validation
GET    /api/info                        # API information
/                                       # Root endpoint (welcome)
/docs, /redoc                           # API documentation
```

### 4.3 Response Models
```python
# Network models
class NetworkResponse(BaseModel): ...
class NetworkListResponse(BaseModel): ...
class NetworkDetailResponse(BaseModel): ...
class NetworkStatsResponse(BaseModel): ...

# Spatial data models
class NodeResponse(BaseModel): ...
class EdgeResponse(BaseModel): ...
class RouteResponse(BaseModel): ...
class FeatureResponse(BaseModel): ...

# Paginated responses
class PaginatedNodesResponse(BaseModel): ...
class PaginatedEdgesResponse(BaseModel): ...
class PaginatedRoutesResponse(BaseModel): ...
class PaginatedFeaturesResponse(BaseModel): ...

# GeoJSON models
class GeoJSONFeature(BaseModel): ...
class GeoJSONFeatureCollection(BaseModel): ...
class GeoJSONResponse(BaseModel): ...

# Error, health, and info models
class ErrorResponse(BaseModel): ...
class HealthResponse(BaseModel): ...
class APIInfoResponse(BaseModel): ...
```

### 4.3 Data Models
- [x] **Pydantic models**: Basic request/response schemas
- [x] **GeoJSON serialization**: Convert PostGIS to GeoJSON
- [x] **Pagination**: Simple offset/limit pagination

---

## 5. Minimal Configuration & Deployment

### 5.1 Configuration
- [x] **Environment variables**: Database connection via .env
- [x] **JSON configuration**: spain_data.json for city parameters

### 5.2 Docker Deployment ✅

#### Docker Compose Configuration
```yaml
version: '3.8'
services:
  postgres:
    image: postgis/postgis:15-3.3
    container_name: bikes_postgres
    environment:
      POSTGRES_DB: bikes_for_cities
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./schema.sql:/docker-entrypoint-initdb.d/schema.sql
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d bikes_for_cities"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build: 
      context: .
      dockerfile: Dockerfile
    container_name: bikes_backend
    ports:
      - "8000:8000"
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      - POSTGRES_HOST=postgres
      - POSTGRES_PORT=5432
      - POSTGRES_DB=bikes_for_cities
      - POSTGRES_USER=${POSTGRES_USER}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    volumes:
      - ./Data:/app/Data
      - ./cache:/app/cache
      - ./logs:/app/logs
    command: uvicorn app.api.main:app --host 0.0.0.0 --port 8000 --reload

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: bikes_frontend
    ports:
      - "3000:3000"
    depends_on:
      - backend
    environment:
      - REACT_APP_API_URL=http://localhost:8000
    command: npm run dev -- --host 0.0.0.0

volumes:
  postgres_data:
```

#### Backend Dockerfile
```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for PostGIS and spatial libraries
RUN apt-get update && apt-get install -y \
    libpq-dev \
    gcc \
    g++ \
    libgeos-dev \
    libproj-dev \
    libgdal-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p /app/cache /app/logs /app/Data

# Expose port
EXPOSE 8000

# Default command
CMD ["uvicorn", "app.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

#### Frontend Dockerfile
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Expose port
EXPOSE 3000

# Default command
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
```

#### Environment Configuration
```bash
# .env file
POSTGRES_USER=bikes_user
POSTGRES_PASSWORD=your_secure_password
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=bikes_for_cities
```

#### Deployment Commands
```bash
# Build and start all services
docker-compose up --build

# Start in detached mode
docker-compose up -d

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Stop services
docker-compose down

# Reset database (remove volumes)
docker-compose down -v
```
