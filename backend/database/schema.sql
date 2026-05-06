CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS cities (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    alt_name TEXT,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    center_lat DOUBLE PRECISION,
    center_lon DOUBLE PRECISION,
    radius DOUBLE PRECISION,
    population BIGINT,
    website TEXT,
    mayor TEXT,
    mayor_party TEXT,
    wikidata_id TEXT UNIQUE,
    bounds_min_lat DOUBLE PRECISION,
    bounds_max_lat DOUBLE PRECISION,
    bounds_min_lon DOUBLE PRECISION,
    bounds_max_lon DOUBLE PRECISION
);

CREATE TABLE IF NOT EXISTS city_modes (
    city_id              INTEGER PRIMARY KEY REFERENCES cities(id) ON DELETE CASCADE,
    infrastructure       BOOLEAN DEFAULT FALSE,
    traffic              BOOLEAN DEFAULT FALSE,
    traffic_combinations JSONB   DEFAULT '[]',
    accidents            BOOLEAN DEFAULT FALSE,
    stations             BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS ingestion_status (
    id SERIAL PRIMARY KEY,
    process_name TEXT NOT NULL,
    city_id INTEGER REFERENCES cities(id) ON DELETE CASCADE,
    time_period TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT NOT NULL,
    details JSONB
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ingestion_status
    ON ingestion_status (process_name, COALESCE(city_id, 0), COALESCE(time_period, ''));


CREATE TABLE IF NOT EXISTS historical_mayors (
    id SERIAL PRIMARY KEY,
    city_id INTEGER REFERENCES cities(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    party TEXT,
    start_date DATE,
    end_date DATE,
    UNIQUE(city_id, name, start_date)
);

CREATE TABLE IF NOT EXISTS city_metrics (
    city_id INTEGER REFERENCES cities(id) ON DELETE CASCADE,
    metric_month TIMESTAMPTZ NOT NULL,
    coverage DOUBLE PRECISION,
    total_kilometers DOUBLE PRECISION,
    estimated_monthly_trips DOUBLE PRECISION,
    actual_monthly_trips DOUBLE PRECISION,  -- overwritten by real trip data if available
    total_stations INTEGER,
    avg_station_downtime DOUBLE PRECISION,
    gcc_fraction DOUBLE PRECISION,
    gcc_km DOUBLE PRECISION,
    n_components INTEGER,
    bicycles_count INTEGER,
    updated_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (city_id, metric_month)
);

-- Per-station monthly time-series: trips, inbound/outbound flows, downtime
CREATE TABLE IF NOT EXISTS station_monthly (
    city_id                INTEGER REFERENCES cities(id) ON DELETE CASCADE,
    citybikes_network_id   TEXT NOT NULL,
    station_id             TEXT NOT NULL,
    metric_month           DATE NOT NULL,
    -- Skellam-estimated flows
    estimated_trips        DOUBLE PRECISION DEFAULT 0,
    estimated_inbound      DOUBLE PRECISION DEFAULT 0,
    estimated_outbound     DOUBLE PRECISION DEFAULT 0,
    downtime_minutes       DOUBLE PRECISION DEFAULT 0,
    -- Actual trips from real data (overwritten by 040_load_trips.py)
    actual_trips           DOUBLE PRECISION,
    PRIMARY KEY (city_id, citybikes_network_id, station_id, metric_month)
);
CREATE INDEX IF NOT EXISTS idx_station_monthly_city_month ON station_monthly(city_id, metric_month);

CREATE TABLE IF NOT EXISTS estimated_trips_per_interval (
    city_id INTEGER REFERENCES cities(id) ON DELETE CASCADE,
    observed_at TIMESTAMPTZ NOT NULL,
    estimated_trips DOUBLE PRECISION,
    PRIMARY KEY (city_id, observed_at)
);

CREATE TABLE IF NOT EXISTS city_elections (
    id SERIAL PRIMARY KEY,
    city_id INTEGER REFERENCES cities(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    party TEXT NOT NULL,
    votes INTEGER,
    councilors INTEGER,
    UNIQUE(city_id, year, party)
);

CREATE TABLE IF NOT EXISTS city_councilors (
    id SERIAL PRIMARY KEY,
    city_id INTEGER REFERENCES cities(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    party TEXT NOT NULL,
    name TEXT NOT NULL,
    elected BOOLEAN NOT NULL,
    UNIQUE(city_id, year, party, name)
);

CREATE TABLE IF NOT EXISTS city_budgets (
    id SERIAL PRIMARY KEY,
    city_id INTEGER REFERENCES cities(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    budget_type VARCHAR(16) NOT NULL DEFAULT 'planned', -- 'planned' or 'executed'
    total_income BIGINT,
    total_expenses BIGINT,
    public_debt BIGINT,
    UNIQUE(city_id, year, budget_type)
);

-- Detailed functional budget categories
CREATE TABLE IF NOT EXISTS city_budget_categories (
    id SERIAL PRIMARY KEY,
    city_id INTEGER REFERENCES cities(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    budget_type VARCHAR(16) NOT NULL, -- 'planned' or 'executed'
    category_code TEXT NOT NULL,      -- e.g., '134', '1341'
    category_name TEXT NOT NULL,
    amount BIGINT NOT NULL,
    UNIQUE(city_id, year, budget_type, category_code)
);

CREATE TABLE IF NOT EXISTS nodes (
    id BIGINT PRIMARY KEY,               -- OSM node ID
    city_id INTEGER REFERENCES cities(id) ON DELETE CASCADE,
    osmid BIGINT UNIQUE,
    lat DOUBLE PRECISION,
    lon DOUBLE PRECISION,
    geom GEOMETRY(Point, 4326),
    street_count INTEGER
);


CREATE TABLE IF NOT EXISTS edges (
    id SERIAL PRIMARY KEY,
    city_id INTEGER REFERENCES cities(id) ON DELETE CASCADE,
    osmid BIGINT,                                    -- OSM edge ID (first in osmid list)
    u BIGINT REFERENCES nodes(id) ON DELETE CASCADE, -- start node
    v BIGINT REFERENCES nodes(id) ON DELETE CASCADE, -- end node
    k INTEGER,                                       -- key for MultiDiGraph (parallel ways)
    geom GEOMETRY(LineString, 4326),

    -- Normalized metadata
    highway TEXT,
    name TEXT,
    length DOUBLE PRECISION,
    width DOUBLE PRECISION,
    maxspeed INTEGER[],
    lanes INTEGER[],
    oneway BOOLEAN,
    tunnel BOOLEAN,
    bridge BOOLEAN,
    building_count INTEGER DEFAULT 0,               -- buildings within 150m (computed at feature ingestion)
    component_id INTEGER,                           -- connected component rank (0=GCC) computed at ingestion

    UNIQUE(u, v, k)                                 -- enforce unique edge per MultiDiGraph
);

-- ── Trips ──────────────────────────────────────────────────────────────────
-- One row per demand record: a real observed trip or a modelled O-D pair.
-- generation_type distinguishes the source of the demand:
--   'real'                 – recorded from a bike-share service (e.g. BiciMAD)
--   'station_based'        – synthetic, generated from station inbound/outbound flows
--   'buildings_population' – synthetic, generated from building footprints + pop density
CREATE TABLE IF NOT EXISTS trips (
    id              SERIAL PRIMARY KEY,
    city_id         INTEGER REFERENCES cities(id) ON DELETE CASCADE,
    id_trip         TEXT NOT NULL UNIQUE,
    origin_node     BIGINT REFERENCES nodes(id) ON DELETE CASCADE,
    dest_node       BIGINT REFERENCES nodes(id) ON DELETE CASCADE,
    trip_minutes    DOUBLE PRECISION,
    datetime_unlock TIMESTAMP,
    datetime_lock   TIMESTAMP,
    id_bike         BIGINT,
    generation_type TEXT NOT NULL
                    CHECK (generation_type IN ('real','station_based','buildings_population')),
    created_at      TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_trips_city_id         ON trips(city_id);
CREATE INDEX IF NOT EXISTS idx_trips_generation_type ON trips(generation_type);
CREATE INDEX IF NOT EXISTS idx_trips_origin_node      ON trips(origin_node);
CREATE INDEX IF NOT EXISTS idx_trips_dest_node        ON trips(dest_node);

-- ── Paths ──────────────────────────────────────────────────────────────────
-- One row per unique computed path (edge sequence between two graph nodes).
-- algorithm identifies how the path was computed:
--   'shortest'    – Dijkstra shortest path; deduplicated per (city, origin, dest)
--   'map_matched' – GPS track map-matched to the graph; one path per trip
CREATE TABLE IF NOT EXISTS paths (
    id          SERIAL PRIMARY KEY,
    city_id     INTEGER REFERENCES cities(id) ON DELETE CASCADE,
    origin_node BIGINT REFERENCES nodes(id) ON DELETE CASCADE,
    dest_node   BIGINT REFERENCES nodes(id) ON DELETE CASCADE,
    algorithm   TEXT NOT NULL
);
-- Shortest paths are deduplicated: one canonical path per (city, origin, dest).
-- Map-matched paths are NOT subject to this constraint (each GPS track is unique).
CREATE UNIQUE INDEX IF NOT EXISTS paths_shortest_uq
    ON paths(city_id, origin_node, dest_node)
    WHERE algorithm = 'shortest';
CREATE INDEX IF NOT EXISTS idx_paths_city_id ON paths(city_id);

-- ── Path edges ─────────────────────────────────────────────────────────────
-- Ordered edge sequence for each path (no per-trip duplication).
CREATE TABLE IF NOT EXISTS path_edges (
    path_id    INTEGER REFERENCES paths(id) ON DELETE CASCADE,
    edge_id    INTEGER REFERENCES edges(id) ON DELETE CASCADE,
    edge_order INTEGER NOT NULL,
    PRIMARY KEY (path_id, edge_order)
);
CREATE INDEX IF NOT EXISTS idx_path_edges_edge_id ON path_edges(edge_id);

-- ── Path nodes ─────────────────────────────────────────────────────────────
-- Ordered node sequence for each path; enables efficient node-level traffic queries
-- (e.g. "how many trips pass through intersection X?") with a single index scan.
CREATE TABLE IF NOT EXISTS path_nodes (
    path_id    INTEGER REFERENCES paths(id) ON DELETE CASCADE,
    node_id    BIGINT  REFERENCES nodes(id) ON DELETE CASCADE,
    node_order INTEGER NOT NULL,
    PRIMARY KEY (path_id, node_order)
);
CREATE INDEX IF NOT EXISTS idx_path_nodes_node_id ON path_nodes(node_id);

-- ── Routes ─────────────────────────────────────────────────────────────────
-- Join table: links each trip to the path that was computed for it.
-- path_id is NULL for trips that have not yet been routed.
-- The routing algorithm is determined by paths.algorithm (not stored here).
-- UNIQUE(trip_id, path_id) prevents routing the same trip to the same path twice.
CREATE TABLE IF NOT EXISTS routes (
    id         SERIAL PRIMARY KEY,
    city_id    INTEGER REFERENCES cities(id) ON DELETE CASCADE,
    trip_id    INTEGER REFERENCES trips(id) ON DELETE CASCADE,
    path_id    INTEGER REFERENCES paths(id) ON DELETE SET NULL,
    processed  BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (trip_id, path_id)
);
CREATE INDEX IF NOT EXISTS idx_routes_city_id ON routes(city_id);
CREATE INDEX IF NOT EXISTS idx_routes_trip_id ON routes(trip_id);
CREATE INDEX IF NOT EXISTS idx_routes_path_id ON routes(path_id);

-- OSM Features table
CREATE TABLE IF NOT EXISTS features (
    id SERIAL PRIMARY KEY,
    city_id INTEGER REFERENCES cities(id) ON DELETE CASCADE,
    feature_type VARCHAR(50) NOT NULL,
    geometry GEOMETRY(GEOMETRY, 4326) NOT NULL,
    tags JSONB,
    component_id INTEGER,                           -- connectivity component rank (computed at ingestion)
    extracted_at TIMESTAMP DEFAULT NOW()
);

-- Bike-share stations (CityBikes)
CREATE TABLE IF NOT EXISTS stations (
    id SERIAL PRIMARY KEY,
    city_id INTEGER REFERENCES cities(id) ON DELETE CASCADE,
    citybikes_network_id TEXT NOT NULL,
    station_id TEXT NOT NULL, -- station id from CityBikes payloads / historical dumps
    name TEXT,
    lat DOUBLE PRECISION,
    lon DOUBLE PRECISION,
    geom GEOMETRY(Point, 4326),
    extra JSONB,
    first_seen TIMESTAMPTZ,
    last_seen TIMESTAMPTZ,
    merged_into_id INTEGER REFERENCES stations(id) ON DELETE SET NULL,
    reach_coverage DOUBLE PRECISION,
    building_coverage DOUBLE PRECISION,             -- fraction of bike_path_buildings within 150m (computed at ingestion)
    UNIQUE (citybikes_network_id, station_id)
);
CREATE INDEX IF NOT EXISTS idx_stations_merged_into ON stations(merged_into_id);

-- Historical station readings (CityBikes monthly parquet)
CREATE TABLE IF NOT EXISTS station_readings (
    citybikes_network_id TEXT NOT NULL,
    station_id TEXT NOT NULL,
    observed_at TIMESTAMPTZ NOT NULL,
    available_bikes INTEGER,
    empty_slots INTEGER,
    city_id INTEGER REFERENCES cities(id) ON DELETE CASCADE,
    extra JSONB,
    PRIMARY KEY (citybikes_network_id, station_id, observed_at)
);

-- Traffic table for bike trips per road segment (one row per edge per month per combination)
-- generation_type: 'real' | 'station_based' | 'buildings_population'
-- algorithm:       'map_matched' | 'shortest' | 'safest' | 'grouped'
CREATE TABLE IF NOT EXISTS edge_traffic (
    edge_id         INTEGER REFERENCES edges(id) ON DELETE CASCADE,
    city_id         INTEGER REFERENCES cities(id) ON DELETE CASCADE,
    trip_count      INTEGER DEFAULT 0,
    month           DATE NOT NULL,
    generation_type TEXT NOT NULL DEFAULT 'real',
    algorithm       TEXT NOT NULL DEFAULT 'map_matched',
    PRIMARY KEY (edge_id, month, generation_type, algorithm)
);
CREATE INDEX IF NOT EXISTS idx_edge_traffic_city_id ON edge_traffic(city_id);
CREATE INDEX IF NOT EXISTS idx_edge_traffic_month ON edge_traffic(month);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_nodes_network_id ON nodes(city_id);
CREATE INDEX IF NOT EXISTS idx_nodes_geom ON nodes USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_edges_network_id ON edges(city_id);
CREATE INDEX IF NOT EXISTS idx_edges_geom ON edges USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_features_network_type ON features(city_id, feature_type);  -- Combined filtering
CREATE INDEX IF NOT EXISTS idx_features_geom ON features USING GIST(geometry);


CREATE INDEX IF NOT EXISTS idx_stations_city_id ON stations(city_id);
CREATE INDEX IF NOT EXISTS idx_stations_geom ON stations USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_station_readings_city_time ON station_readings(city_id, observed_at);
CREATE INDEX IF NOT EXISTS idx_station_readings_network_time ON station_readings(citybikes_network_id, observed_at);

-- ── Accidents ──────────────────────────────────────────────────────────────
-- Traffic accident events registered by Madrid Municipal Police.
-- Source: datos.madrid.es/dataset/300228-0-accidentes-trafico-detalle
-- One row per accident (deduped from per-person CSV records).
-- 2019+ schema (richer): UTM coordinates, vehicle/person type breakdown.
-- Pre-2019 data has fewer fields and lacks coordinates.
CREATE TABLE IF NOT EXISTS accidents (
    id               SERIAL PRIMARY KEY,
    city_id          INTEGER REFERENCES cities(id) ON DELETE CASCADE,
    accident_id      TEXT NOT NULL,              -- num_expediente (original ID)
    timestamp        TIMESTAMPTZ,
    street           TEXT,
    street_number    TEXT,
    district         TEXT,
    accident_type    TEXT,
    weather          TEXT,
    -- Location
    geom             GEOMETRY(Point, 4326),
    closest_edge_id  INTEGER REFERENCES edges(id) ON DELETE SET NULL,
    -- Aggregated person counts (from all rows sharing same num_expediente)
    total_involved   INTEGER DEFAULT 0,
    injured          INTEGER DEFAULT 0,          -- lesividad not in (sin asistencia, ileso, se desconoce)
    killed           INTEGER DEFAULT 0,          -- lesividad = muerto
    vehicles_involved TEXT[],                    -- array of categorized vehicles (bike_vmu, moto, car, heavy, pedestrian)
    source           TEXT DEFAULT 'madrid_open_data',
    UNIQUE (city_id, accident_id)
);

CREATE TABLE IF NOT EXISTS accident_participants (
    id               SERIAL PRIMARY KEY,
    accident_db_id   INTEGER REFERENCES accidents(id) ON DELETE CASCADE,
    person_type      TEXT,    -- tipo_persona
    age_range        TEXT,    -- rango_edad
    sex              TEXT,    -- sexo
    vehicle_type     TEXT,    -- tipo_vehiculo
    injury_status    TEXT,    -- lesividad
    injury_code      INTEGER, -- cod_lesividad
    alcohol_positive BOOLEAN, -- positiva_alcohol
    drugs_positive   BOOLEAN, -- positiva_droga
    accident_type    TEXT     -- tipo_accidente (denormalized)
);


CREATE INDEX IF NOT EXISTS idx_accidents_city_id ON accidents(city_id);
CREATE INDEX IF NOT EXISTS idx_accidents_geom    ON accidents USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_accidents_timestamp ON accidents(timestamp);
CREATE INDEX IF NOT EXISTS idx_accidents_closest_edge ON accidents(closest_edge_id);
CREATE INDEX IF NOT EXISTS idx_participants_accident_id ON accident_participants(accident_db_id);

