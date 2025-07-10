CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE networks (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    center_lat DOUBLE PRECISION,
    center_lon DOUBLE PRECISION,
    radius DOUBLE PRECISION
);

CREATE TABLE nodes (
    id BIGINT PRIMARY KEY,               -- OSM node ID
    network_id INTEGER REFERENCES networks(id) ON DELETE CASCADE,
    osmid BIGINT UNIQUE,
    lat DOUBLE PRECISION,
    lon DOUBLE PRECISION,
    geom GEOMETRY(Point, 4326),
    street_count INTEGER
);


CREATE TABLE edges (
    id SERIAL PRIMARY KEY,
    network_id INTEGER REFERENCES networks(id) ON DELETE CASCADE,
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
    network_id INTEGER REFERENCES networks(id) ON DELETE CASCADE,
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
    network_id INTEGER REFERENCES networks(id) ON DELETE CASCADE,
    feature_type VARCHAR(50) NOT NULL,
    geometry GEOMETRY(GEOMETRY, 4326) NOT NULL,
    tags JSONB,
    extracted_at TIMESTAMP DEFAULT NOW()
)

-- Indexes
CREATE INDEX IF NOT EXISTS idx_nodes_network_id ON nodes(network_id);
CREATE INDEX IF NOT EXISTS idx_nodes_geom ON nodes USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_edges_network_id ON edges(network_id);
CREATE INDEX IF NOT EXISTS idx_edges_geom ON edges USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_routes_network_id ON routes(network_id);
CREATE INDEX idx_features_network_id ON features(network_id);          -- Fast network filtering
CREATE INDEX idx_features_type ON features(feature_type);              -- Fast feature typse filtering
CREATE INDEX idx_features_geom ON features USING GIST(geometry);       -- Spatial queries (intersection, within)
CREATE INDEX idx_features_network_type ON features(network_id, feature_type);  -- Combined filtering
