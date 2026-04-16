"""
metrics.py – Database I/O for system-wide metrics and analytics layer.
"""
from typing import List, Tuple, Optional
import datetime as dt
import psycopg2
from psycopg2.extras import execute_values


def get_skellam_readings_diffs(conn, city_id: int, start: dt.datetime, end: dt.datetime) -> list:
    """Fetch consecutive reading differences per station over a time period."""
    query = """
        WITH diffs AS (
            SELECT
                station_id,
                observed_at,
                available_bikes,
                available_bikes - LAG(available_bikes) OVER (
                    PARTITION BY station_id
                    ORDER BY observed_at
                ) AS delta_bikes
            FROM station_readings
            WHERE city_id = %s
              AND observed_at >= %s
              AND observed_at < %s
        )
        SELECT station_id, observed_at, delta_bikes, available_bikes
        FROM diffs
    """
    with conn.cursor() as cur:
        cur.execute(query, (city_id, start, end))
        return cur.fetchall(), [desc[0] for desc in cur.description]


def get_station_merge_map(conn, city_id: int) -> dict:
    """Retrieve map of station ID to its merged representative ID."""
    with conn.cursor() as cur:
        cur.execute("""
            SELECT s1.station_id, COALESCE(s2.station_id, s1.station_id) 
            FROM stations s1
            LEFT JOIN stations s2 ON s1.merged_into_id = s2.id
            WHERE s1.city_id = %s
        """, (city_id,))
        return {row[0]: row[1] for row in cur.fetchall()}


def get_citybikes_network_id(conn, city_id: int) -> Optional[str]:
    """Retrieve the citybikes_network_id for a city."""
    with conn.cursor() as cur:
        cur.execute("SELECT citybikes_network_id FROM stations WHERE city_id = %s LIMIT 1", (city_id,))
        res = cur.fetchone()
        return res[0] if res else None


def upsert_station_monthly(
    conn,
    rows: List[Tuple],  # (city_id, network_id, station_id, month, trips, inbound, outbound, downtime)
) -> None:
    """Upsert per-station monthly Skellam-estimated metrics into station_monthly."""
    if not rows:
        return
    with conn.cursor() as cur:
        execute_values(cur, """
            INSERT INTO station_monthly (
                city_id, citybikes_network_id, station_id, metric_month,
                estimated_trips, estimated_inbound, estimated_outbound, downtime_minutes
            ) VALUES %s
            ON CONFLICT (city_id, citybikes_network_id, station_id, metric_month) DO UPDATE SET
                estimated_trips   = EXCLUDED.estimated_trips,
                estimated_inbound = EXCLUDED.estimated_inbound,
                estimated_outbound= EXCLUDED.estimated_outbound,
                downtime_minutes  = EXCLUDED.downtime_minutes
        """, rows)


def update_station_metrics(conn, station_rows) -> None:
    """DEPRECATED: kept for backward compat. Use upsert_station_monthly instead."""
    pass  # no-op – callers should migrate to upsert_station_monthly


def get_station_monthly_flow(
    conn, city_id: int, metric_month
) -> List[Tuple]:
    """Return (station_id, network_id, lat, lon, inbound, outbound) for a city/month."""
    with conn.cursor() as cur:
        cur.execute("""
            SELECT sm.station_id, sm.citybikes_network_id,
                   s.lat, s.lon,
                   sm.estimated_inbound, sm.estimated_outbound
            FROM station_monthly sm
            JOIN stations s
              ON s.citybikes_network_id = sm.citybikes_network_id
             AND s.station_id = sm.station_id
             AND s.city_id = sm.city_id
             AND s.merged_into_id IS NULL
            WHERE sm.city_id = %s AND sm.metric_month = %s
        """, (city_id, metric_month))
        return cur.fetchall()


def upsert_station_actual_trips(
    conn,
    rows: List[Tuple],  # (actual_trips, city_id, network_id, station_id, month)
) -> None:
    """Overwrite actual trip counts for stations that have real data."""
    if not rows:
        return
    with conn.cursor() as cur:
        execute_values(cur, """
            INSERT INTO station_monthly (
                city_id, citybikes_network_id, station_id, metric_month, actual_trips
            ) VALUES %s
            ON CONFLICT (city_id, citybikes_network_id, station_id, metric_month) DO UPDATE SET
                actual_trips = EXCLUDED.actual_trips
        """, rows, template="(%s, %s, %s, %s, %s)")



def upsert_estimated_trips_interval(conn, rows: List[Tuple[int, dt.datetime, float]]) -> None:
    """Batch upsert estimated trips per interval."""
    if not rows:
        return
    with conn.cursor() as cur:
        execute_values(cur, """
            INSERT INTO estimated_trips_per_interval (city_id, observed_at, estimated_trips)
            VALUES %s
            ON CONFLICT (city_id, observed_at) DO UPDATE SET
                estimated_trips = EXCLUDED.estimated_trips
        """, rows)


def get_city_months_with_station_data(conn, city_id: int) -> List[dt.datetime]:
    """Get distinct months with available station readings."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT DISTINCT date_trunc('month', observed_at)::timestamptz AS m
            FROM station_readings
            WHERE city_id = %s
            ORDER BY m
            """,
            (city_id,),
        )
        return [row[0] for row in cur.fetchall()]


def calculate_osm_metrics(conn, city_id: int, center_lat: float, center_lon: float, angle: float) -> Tuple[float, Optional[float]]:
    """Calculate bike lane kilometers and coverage for a city within a 10km bbox."""
    import math
    dy = 5000.0 / 111320.0
    dx = 5000.0 / (111320.0 * math.cos(math.radians(center_lat)))
    
    with conn.cursor() as cur:
        bbox_query = """
            SELECT ST_Translate(
                ST_Rotate(
                    ST_GeomFromText(%s, 4326),
                    radians(%s),
                    ST_SetSRID(ST_Point(0, 0), 4326)
                ),
                %s, %s
            ) AS geom
        """
        poly_wkt = f"POLYGON(({-dx} {-dy}, {dx} {-dy}, {dx} {dy}, {-dx} {dy}, {-dx} {-dy}))"
        cur.execute(bbox_query, (poly_wkt, -angle, center_lon, center_lat))
        bbox_geom = cur.fetchone()[0]

        # Total Kilometers of bike paths
        cur.execute(
            """
            SELECT SUM(ST_Length(ST_Intersection(geom, %s)::geography)) / 1000.0 
            FROM edges 
            WHERE city_id = %s AND highway LIKE '%%cycleway%%'
              AND ST_Intersects(geom, %s)
            """,
            (bbox_geom, city_id, bbox_geom),
        )
        res = cur.fetchone()
        total_km = float(res[0]) if res and res[0] else 0.0

        # Coverage
        cur.execute(
            """
            SELECT 
              (SELECT COUNT(*) FROM features WHERE city_id = %s AND feature_type = 'bike_path_buildings' AND ST_Intersects(geometry, %s)),
              (SELECT COUNT(*) FROM features WHERE city_id = %s AND feature_type IN ('buildings', 'bike_path_buildings') AND ST_Intersects(geometry, %s))
            """,
            (city_id, bbox_geom, city_id, bbox_geom),
        )
        close_bldgs, total_bldgs = cur.fetchone()

        coverage = None
        if total_bldgs is not None:
            t_vals = int(total_bldgs)
            if t_vals > 0:
                coverage = float(close_bldgs) / float(t_vals)

        return total_km, coverage


def get_total_active_stations(conn, city_id: int, start: dt.datetime, end: dt.datetime) -> int:
    """Count the total number of active stations in a month."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT COUNT(DISTINCT station_id)
            FROM station_readings
            WHERE city_id = %s
              AND observed_at >= %s
              AND observed_at < %s
            """,
            (city_id, start, end),
        )
        return int(cur.fetchone()[0] or 0)


def upsert_city_metrics(
    conn,
    city_id: int,
    metric_month: dt.datetime,
    coverage: Optional[float],
    total_km: float,
    estimated_monthly_trips: float,
    total_stations: int,
    station_downtime: float
) -> None:
    """Upsert monthly analytics metrics into city_metrics."""
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO city_metrics (
                city_id, metric_month, coverage, total_kilometers,
                estimated_monthly_trips, total_stations, avg_station_downtime, updated_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
            ON CONFLICT (city_id, metric_month) DO UPDATE SET
                coverage = COALESCE(EXCLUDED.coverage, city_metrics.coverage),
                total_kilometers = COALESCE(EXCLUDED.total_kilometers, city_metrics.total_kilometers),
                estimated_monthly_trips = EXCLUDED.estimated_monthly_trips,
                total_stations = EXCLUDED.total_stations,
                avg_station_downtime = EXCLUDED.avg_station_downtime,
                updated_at = NOW()
            """,
            (city_id, metric_month, coverage, total_km, estimated_monthly_trips, total_stations, station_downtime),
        )


def upsert_city_actual_trips(conn, city_id: int, metric_month, actual_trips: float) -> None:
    """Write actual trip count (from real data) into city_metrics."""
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO city_metrics (city_id, metric_month, actual_monthly_trips, updated_at)
            VALUES (%s, %s, %s, NOW())
            ON CONFLICT (city_id, metric_month) DO UPDATE SET
                actual_monthly_trips = EXCLUDED.actual_monthly_trips,
                updated_at = NOW()
        """, (city_id, metric_month, actual_trips))


def get_city_actual_vs_estimated(conn, city_id: int):
    """Return per-month estimated vs actual trips for a city."""
    with conn.cursor() as cur:
        cur.execute("""
            SELECT metric_month, estimated_monthly_trips, actual_monthly_trips
            FROM city_metrics
            WHERE city_id = %s AND estimated_monthly_trips IS NOT NULL
            ORDER BY metric_month
        """, (city_id,))
        return cur.fetchall()
