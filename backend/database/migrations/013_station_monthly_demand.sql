CREATE TABLE IF NOT EXISTS station_monthly_demand (
    city_id              INTEGER NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
    citybikes_network_id TEXT    NOT NULL,
    station_id           TEXT    NOT NULL,
    metric_month         DATE    NOT NULL,
    hour_of_day          SMALLINT NOT NULL CHECK (hour_of_day BETWEEN 0 AND 23),
    lambda_departure     DOUBLE PRECISION,
    mu_arrival           DOUBLE PRECISION,
    PRIMARY KEY (city_id, citybikes_network_id, station_id, metric_month, hour_of_day)
);

CREATE INDEX IF NOT EXISTS idx_station_monthly_demand_city_month
    ON station_monthly_demand (city_id, metric_month);
