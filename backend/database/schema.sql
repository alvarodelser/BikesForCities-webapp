CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE cities (
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

CREATE TABLE city_modes (
    city_id INTEGER PRIMARY KEY REFERENCES cities(id) ON DELETE CASCADE,
    infrastructure BOOLEAN DEFAULT FALSE,
    traffic BOOLEAN DEFAULT FALSE,
    accidents BOOLEAN DEFAULT FALSE,
    topography BOOLEAN DEFAULT FALSE,
    intersections BOOLEAN DEFAULT FALSE,
    stations BOOLEAN DEFAULT FALSE,
    forum BOOLEAN DEFAULT FALSE
);

CREATE TABLE historical_mayors (
    id SERIAL PRIMARY KEY,
    city_id INTEGER REFERENCES cities(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    party TEXT,
    start_date DATE,
    end_date DATE,
    UNIQUE(city_id, name, start_date)
);

CREATE TABLE city_metrics (
    city_id INTEGER REFERENCES cities(id) ON DELETE CASCADE,
    metric_month TIMESTAMPTZ NOT NULL,
    coverage DOUBLE PRECISION,
    total_kilometers DOUBLE PRECISION,
    estimated_monthly_trips DOUBLE PRECISION,
    total_stations INTEGER,
    updated_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (city_id, metric_month)
);

CREATE TABLE city_elections (
    id SERIAL PRIMARY KEY,
    city_id INTEGER REFERENCES cities(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    party TEXT NOT NULL,
    votes INTEGER,
    councilors INTEGER,
    UNIQUE(city_id, year, party)
);

CREATE TABLE city_councilors (
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

CREATE TABLE nodes (
    id BIGINT PRIMARY KEY,               -- OSM node ID
    city_id INTEGER REFERENCES cities(id) ON DELETE CASCADE,
    osmid BIGINT UNIQUE,
    lat DOUBLE PRECISION,
    lon DOUBLE PRECISION,
    geom GEOMETRY(Point, 4326),
    street_count INTEGER
);


CREATE TABLE edges (
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

CREATE TABLE routes (
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


CREATE TABLE route_nodes ( -- Separate table for efficient queries
    id SERIAL PRIMARY KEY,
    route_id INTEGER REFERENCES routes(id) ON DELETE CASCADE,
    node_order INTEGER,
    node_id BIGINT REFERENCES nodes(id)
);

CREATE TABLE route_edges ( -- Separate table for efficient queries
    id SERIAL PRIMARY KEY,
    route_id INTEGER REFERENCES routes(id) ON DELETE CASCADE,
    edge_id INTEGER REFERENCES edges(id)
);

-- OSM Features table
CREATE TABLE features (
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_nodes_network_id ON nodes(city_id);
CREATE INDEX IF NOT EXISTS idx_nodes_geom ON nodes USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_edges_network_id ON edges(city_id);
CREATE INDEX IF NOT EXISTS idx_edges_geom ON edges USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_routes_network_id ON routes(city_id);
CREATE INDEX idx_features_network_id ON features(city_id);          -- Fast city filtering
CREATE INDEX idx_features_type ON features(feature_type);              -- Fast feature typse filtering
CREATE INDEX idx_features_geom ON features USING GIST(geometry);       -- Spatial queries (intersection, within)
CREATE INDEX idx_features_network_type ON features(city_id, feature_type);  -- Combined filtering

CREATE INDEX IF NOT EXISTS idx_stations_city_id ON stations(city_id);
CREATE INDEX IF NOT EXISTS idx_stations_geom ON stations USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_station_readings_city_time ON station_readings(city_id, observed_at);
CREATE INDEX IF NOT EXISTS idx_station_readings_network_time ON station_readings(citybikes_network_id, observed_at);
