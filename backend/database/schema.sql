CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS cities (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    center_lat DOUBLE PRECISION,
    center_lon DOUBLE PRECISION,
    radius DOUBLE PRECISION,
    angle DOUBLE PRECISION,
    population BIGINT,
    website TEXT,
    mayor TEXT,
    mayor_party TEXT,
    wikidata_id TEXT UNIQUE
);

CREATE TABLE IF NOT EXISTS city_modes (
    city_id INTEGER PRIMARY KEY REFERENCES cities(id) ON DELETE CASCADE,
    infrastructure BOOLEAN DEFAULT FALSE,
    traffic BOOLEAN DEFAULT FALSE,
    accidents BOOLEAN DEFAULT FALSE,
    topography BOOLEAN DEFAULT FALSE,
    intersections BOOLEAN DEFAULT FALSE,
    stations BOOLEAN DEFAULT FALSE,
    forum BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS ingestion_status (
    city_id INTEGER REFERENCES cities(id) ON DELETE CASCADE,
    data_type TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT NOT NULL,
    details JSONB,
    PRIMARY KEY (city_id, data_type)
);


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
    total_income BIGINT,
    total_expenses BIGINT,
    public_debt BIGINT,
    UNIQUE(city_id, year)
);

CREATE TABLE IF NOT EXISTS budget_lines (
    id SERIAL PRIMARY KEY,
    budget_id INTEGER REFERENCES city_budgets(id) ON DELETE CASCADE,
    category_name TEXT NOT NULL,
    line_type VARCHAR(16) NOT NULL,
    amount BIGINT NOT NULL
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

    UNIQUE(u, v, k)                                 -- enforce unique edge per MultiDiGraph
);

CREATE TABLE IF NOT EXISTS routes (
    id SERIAL PRIMARY KEY,
    city_id INTEGER REFERENCES cities(id) ON DELETE CASCADE,
    id_trip TEXT UNIQUE NOT NULL,
    origin_node BIGINT REFERENCES nodes(id),
    dest_node BIGINT REFERENCES nodes(id),
    strategy TEXT NOT NULL,              -- e.g., 'shortest', 'fastest', 'scenic'
    trip_minutes DOUBLE PRECISION,
    datetime_unlock TIMESTAMP,
    id_bike BIGINT,
    created_at TIMESTAMP DEFAULT NOW()   -- optional audit
);


CREATE TABLE IF NOT EXISTS route_nodes ( -- Separate table for efficient queries
    id SERIAL PRIMARY KEY,
    route_id INTEGER REFERENCES routes(id) ON DELETE CASCADE,
    node_order INTEGER,
    node_id BIGINT REFERENCES nodes(id)
);

CREATE TABLE IF NOT EXISTS route_edges ( -- Separate table for efficient queries
    id SERIAL PRIMARY KEY,
    route_id INTEGER REFERENCES routes(id) ON DELETE CASCADE,
    edge_id INTEGER REFERENCES edges(id)
);

-- OSM Features table
CREATE TABLE IF NOT EXISTS features (
    id SERIAL PRIMARY KEY,
    city_id INTEGER REFERENCES cities(id) ON DELETE CASCADE,
    feature_type VARCHAR(50) NOT NULL,
    geometry GEOMETRY(GEOMETRY, 4326) NOT NULL,
    tags JSONB,
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
    UNIQUE (citybikes_network_id, station_id)
);

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

-- Traffic table for bike trips per road segment (one row per edge per month)
CREATE TABLE IF NOT EXISTS edge_traffic (
    edge_id INTEGER REFERENCES edges(id) ON DELETE CASCADE,
    city_id INTEGER REFERENCES cities(id) ON DELETE CASCADE,
    trip_count INTEGER DEFAULT 0,
    month DATE NOT NULL,             -- first day of the month, e.g. 2024-01-01
    PRIMARY KEY (edge_id, month)
);
CREATE INDEX IF NOT EXISTS idx_edge_traffic_city_id ON edge_traffic(city_id);
CREATE INDEX IF NOT EXISTS idx_edge_traffic_month ON edge_traffic(month);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_nodes_network_id ON nodes(city_id);
CREATE INDEX IF NOT EXISTS idx_nodes_geom ON nodes USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_edges_network_id ON edges(city_id);
CREATE INDEX IF NOT EXISTS idx_edges_geom ON edges USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_routes_network_id ON routes(city_id);
CREATE INDEX IF NOT EXISTS idx_features_network_type ON features(city_id, feature_type);  -- Combined filtering


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
    accident_date    DATE,
    accident_time    TIME,
    street           TEXT,
    street_number    TEXT,
    district         TEXT,
    accident_type    TEXT,
    weather          TEXT,
    -- Location (converted from UTM ETRS89 zone 30N / EPSG:25830)
    lat              DOUBLE PRECISION,
    lon              DOUBLE PRECISION,
    geom             GEOMETRY(Point, 4326),
    -- Aggregated person counts (from all rows sharing same num_expediente)
    total_involved   INTEGER DEFAULT 0,
    injured          INTEGER DEFAULT 0,          -- lesividad not in (sin asistencia, ileso, se desconoce)
    killed           INTEGER DEFAULT 0,          -- lesividad = muerto
    cyclists_involved INTEGER DEFAULT 0,         -- tipo_vehiculo contains 'bici'
    pedestrians_involved INTEGER DEFAULT 0,      -- tipo_persona = peaton/peatón
    year             INTEGER,
    source           TEXT DEFAULT 'madrid_open_data',
    UNIQUE (city_id, accident_id)
);

CREATE INDEX IF NOT EXISTS idx_accidents_city_id ON accidents(city_id);
CREATE INDEX IF NOT EXISTS idx_accidents_geom    ON accidents USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_accidents_date    ON accidents(accident_date);
CREATE INDEX IF NOT EXISTS idx_accidents_year    ON accidents(year);

