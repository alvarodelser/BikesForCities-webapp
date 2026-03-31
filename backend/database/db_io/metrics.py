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
        cur.execute("SELECT station_id, COALESCE(merged_into_id, station_id) FROM stations WHERE city_id = %s", (city_id,))
        return {row[0]: row[1] for row in cur.fetchall()}


def get_citybikes_network_id(conn, city_id: int) -> Optional[str]:
    """Retrieve the citybikes_network_id for a city."""
    with conn.cursor() as cur:
        cur.execute("SELECT citybikes_network_id FROM stations WHERE city_id = %s LIMIT 1", (city_id,))
        res = cur.fetchone()
        return res[0] if res else None


def update_station_metrics(conn, station_rows: List[Tuple[float, float, dt.datetime, str, str]]) -> None:
    """Batch update estimated_monthly_trips and downtime for stations."""
    if not station_rows:
        return
    with conn.cursor() as cur:
        execute_values(cur, """
            UPDATE stations AS s
            SET estimated_monthly_trips = data.trips,
                downtime_minutes = data.downtime,
                metric_month = CAST(data.month AS TIMESTAMPTZ)
            FROM (VALUES %s) AS data(trips, downtime, month, net_id, sta_id)
            WHERE s.citybikes_network_id = data.net_id AND s.station_id = data.sta_id
        """, station_rows)


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
                coverage = EXCLUDED.coverage,
                total_kilometers = EXCLUDED.total_kilometers,
                estimated_monthly_trips = EXCLUDED.estimated_monthly_trips,
                total_stations = EXCLUDED.total_stations,
                avg_station_downtime = EXCLUDED.avg_station_downtime,
                updated_at = NOW()
            """,
            (city_id, metric_month, coverage, total_km, estimated_monthly_trips, total_stations, station_downtime),
        )

