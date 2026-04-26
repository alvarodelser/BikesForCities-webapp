"""
stations.py – CRUD for bike-share stations table.
"""
from typing import List, Tuple, Optional
import psycopg2
from psycopg2.extras import RealDictCursor, execute_values
import datetime as dt


def get_stations(conn, city_id: int) -> List[Tuple]:
    """Retrieve all active (non-merged) stations for a city, with latest monthly metrics.

    Returns (id, station_id, name, lat, lon, citybikes_network_id,
             extra, estimated_monthly_trips, downtime_minutes,
             estimated_inbound, estimated_outbound, actual_trips).
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT s.id, s.station_id, s.name, s.lat, s.lon, s.citybikes_network_id,
                   s.extra,
                   sm.estimated_trips       AS estimated_monthly_trips,
                   sm.downtime_minutes,
                   sm.estimated_inbound,
                   sm.estimated_outbound,
                   sm.actual_trips
            FROM stations s
            LEFT JOIN LATERAL (
                SELECT estimated_trips, downtime_minutes,
                       estimated_inbound, estimated_outbound, actual_trips
                FROM station_monthly
                WHERE city_id = s.city_id
                  AND citybikes_network_id = s.citybikes_network_id
                  AND station_id = s.station_id
                ORDER BY metric_month DESC
                LIMIT 1
            ) sm ON TRUE
            WHERE s.city_id = %s AND s.merged_into_id IS NULL
            """,
            (city_id,)
        )
        return cur.fetchall()


def get_paginated_stations(conn, city_id: int, limit: int = 100, offset: int = 0) -> Tuple[list, int]:
    """Retrieve paginated stations for API."""
    with conn.cursor() as cur:
        # Count
        cur.execute("SELECT COUNT(*) FROM stations WHERE city_id = %s AND merged_into_id IS NULL", (city_id,))
        total = cur.fetchone()[0]
        
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        query = """
            SELECT
                s.id, s.station_id, s.name, s.lat, s.lon, s.citybikes_network_id,
                s.extra, s.reach_coverage,
                sm.estimated_trips  AS estimated_monthly_trips,
                sm.downtime_minutes
            FROM stations s
            LEFT JOIN LATERAL (
                SELECT estimated_trips, downtime_minutes
                FROM station_monthly
                WHERE city_id = s.city_id
                  AND citybikes_network_id = s.citybikes_network_id
                  AND station_id = s.station_id
                ORDER BY metric_month DESC
                LIMIT 1
            ) sm ON TRUE
            WHERE s.city_id = %s AND s.merged_into_id IS NULL
            ORDER BY s.id
            LIMIT %s OFFSET %s
        """
        cur.execute(query, (city_id, limit, offset))
        return cur.fetchall(), total


def has_station_readings_for_month(conn, network_id: str, start: dt.datetime, end: dt.datetime) -> bool:
    """Check if station readings exist for a given network and month."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT 1
            FROM station_readings
            WHERE citybikes_network_id = %s
              AND observed_at >= %s
              AND observed_at < %s
            LIMIT 1
            """,
            (network_id, start, end),
        )
        return cur.fetchone() is not None


def get_nearby_unmerged_station(conn, city_id: int, sid: str, lon: float, lat: float, distance_m: int = 50) -> Optional[int]:
    """Find a nearby station to merge into."""
    with conn.cursor() as cur:
        cur.execute("""
            SELECT id 
            FROM stations 
            WHERE city_id = %s 
              AND station_id != %s
              AND merged_into_id IS NULL
              AND ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography, %s)
            LIMIT 1
        """, (city_id, sid, lon, lat, distance_m))
        res = cur.fetchone()
        return res[0] if res else None


def upsert_stations(conn, rows: List[Tuple]) -> int:
    """Bulk upsert stations."""
    if not rows:
        return 0
    from .cities import STATIONS_MIN_COUNT
    with conn.cursor() as cur:
        execute_values(
            cur,
            """
            INSERT INTO stations (
                city_id, citybikes_network_id, station_id, name, lat, lon, geom, extra, first_seen, last_seen, merged_into_id
            )
            VALUES %s
            ON CONFLICT (citybikes_network_id, station_id)
            DO UPDATE SET
                city_id = EXCLUDED.city_id,
                name = COALESCE(EXCLUDED.name, stations.name),
                lat = COALESCE(EXCLUDED.lat, stations.lat),
                lon = COALESCE(EXCLUDED.lon, stations.lon),
                geom = COALESCE(EXCLUDED.geom, stations.geom),
                extra = COALESCE(EXCLUDED.extra, stations.extra),
                first_seen = COALESCE(stations.first_seen, EXCLUDED.first_seen),
                last_seen = GREATEST(
                    COALESCE(stations.last_seen, EXCLUDED.last_seen),
                    COALESCE(EXCLUDED.last_seen, stations.last_seen)
                ),
                merged_into_id = COALESCE(stations.merged_into_id, EXCLUDED.merged_into_id)
            """,
            rows,
            template="(%s,%s,%s,%s,%s,%s,ST_SetSRID(ST_MakePoint(%s,%s),4326),%s,%s,%s,%s)",
        )
        # Update stations mode flag for each affected city
        city_ids = {row[0] for row in rows}
        for cid in city_ids:
            cur.execute(
                """
                INSERT INTO city_modes (city_id, stations)
                SELECT %(id)s, (COUNT(*) >= %(min)s)
                FROM stations WHERE city_id = %(id)s AND merged_into_id IS NULL
                ON CONFLICT (city_id) DO UPDATE SET stations = EXCLUDED.stations
                """,
                {'id': cid, 'min': STATIONS_MIN_COUNT},
            )
    return len(rows)


def insert_station_readings(conn, rows: List[Tuple]) -> int:
    """Bulk insert station readings."""
    if not rows:
        return 0
    with conn.cursor() as cur:
        res = execute_values(
            cur,
            """
            INSERT INTO station_readings (
                citybikes_network_id, station_id, observed_at, available_bikes, empty_slots, city_id, extra
            )
            VALUES %s
            ON CONFLICT (citybikes_network_id, station_id, observed_at) DO NOTHING
            RETURNING 1
            """,
            rows,
            fetch=True
        )
    return len(res) if res else 0


def get_station_hourly_availability(conn, city_id: int, station_id: str, day_mode: str = "all") -> List[dict]:
    """
    Get the average bike availability per hour of the day for a specific station.
    day_mode: 'all', 'week' (Mon-Fri), 'weekend' (Sat-Sun)
    """
    where_clause = "WHERE s.city_id = %s AND s.station_id = %s AND r.observed_at >= NOW() - INTERVAL '3 months'"
    params = [city_id, station_id]

    if day_mode == 'week':
        where_clause += " AND EXTRACT(DOW FROM r.observed_at) BETWEEN 1 AND 5"
    elif day_mode == 'weekend':
        where_clause += " AND EXTRACT(DOW FROM r.observed_at) IN (0, 6)"

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(f"""
            WITH daily_samples AS (
                SELECT DISTINCT ON (
                    DATE(r.observed_at AT TIME ZONE 'UTC'),
                    EXTRACT(hour FROM r.observed_at AT TIME ZONE 'UTC')
                )
                    EXTRACT(hour FROM r.observed_at AT TIME ZONE 'UTC') AS hour_of_day,
                    r.available_bikes
                FROM station_readings r
                JOIN stations s ON s.citybikes_network_id = r.citybikes_network_id AND s.station_id = r.station_id
                {where_clause}
                ORDER BY 
                    DATE(r.observed_at AT TIME ZONE 'UTC'),
                    EXTRACT(hour FROM r.observed_at AT TIME ZONE 'UTC'),
                    r.observed_at DESC
            )
            SELECT 
                hour_of_day,
                PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY available_bikes) AS avg_bikes
            FROM daily_samples
            GROUP BY hour_of_day
            ORDER BY hour_of_day
        """, params)
        return cur.fetchall()


def update_station_reach_coverage(conn, city_id: int, coverages: dict):
    """Batch-update reach_coverage for stations.

    coverages: {station_id: coverage_pct}
    """
    if not coverages:
        return
    from psycopg2.extras import execute_values
    rows = [(v, city_id, k) for k, v in coverages.items()]
    with conn.cursor() as cur:
        execute_values(
            cur,
            """
            UPDATE stations AS s SET reach_coverage = d.coverage
            FROM (VALUES %s) AS d(coverage, city_id, station_id)
            WHERE s.city_id = d.city_id::int AND s.station_id = d.station_id
            """,
            rows,
            template="(%s, %s, %s)",
        )

