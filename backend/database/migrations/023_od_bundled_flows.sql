CREATE TABLE od_bundled_flows (
    id              SERIAL PRIMARY KEY,
    city_id         INTEGER NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
    generation_type TEXT    NOT NULL,
    month           DATE    NOT NULL,
    resolution      INTEGER NOT NULL DEFAULT 9,
    pair_limit      INTEGER NOT NULL DEFAULT 5000,
    geojson         JSONB   NOT NULL,
    computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (city_id, generation_type, resolution)
);

CREATE INDEX od_bundled_flows_lookup
    ON od_bundled_flows (city_id, generation_type, month);
