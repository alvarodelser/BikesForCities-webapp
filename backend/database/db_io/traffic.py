"""
traffic.py – CRUD for edge_traffic (trip counts per edge per month).
"""
from datetime import date
from typing import List, Optional, Tuple

from psycopg2.extras import execute_values


# ---------------------------------------------------------------------------
# Write
# ---------------------------------------------------------------------------

def upsert_edge_traffic(
    conn,
    records: List[Tuple[int, int, int, date]],
):
    """Bulk upsert edge_traffic rows.

    record tuple: (edge_id, city_id, trip_count, month)
    The month should be the first day of the month (date object).
    """
    with conn.cursor() as cur:
        execute_values(
            cur,
            """
            INSERT INTO edge_traffic (edge_id, city_id, trip_count, month)
            VALUES %s
            ON CONFLICT (edge_id, month) DO UPDATE SET
                trip_count = EXCLUDED.trip_count
            """,
            records,
        )


def upsert_edge_traffic_for_city(
    conn,
    city_id: int,
    city_name: str,
    month_filter: Optional[date] = None,
):
    """Aggregate route_edges → edge_traffic for a city.

    If *month_filter* is given, only that month is (re)calculated.
    Otherwise all months present in routes are processed.
    """
    print(f"🔄 Calculating traffic for {city_name} (city_id={city_id})...")

    month_clause = ""
    params: list = [city_id, city_id]

    if month_filter:
        month_clause = "AND DATE_TRUNC('month', r.datetime_unlock) = %s"
        params.append(month_filter)

    with conn.cursor() as cur:
        # Delete existing traffic for this city (and month if filtered)
        if month_filter:
            cur.execute(
                "DELETE FROM edge_traffic WHERE city_id = %s AND month = %s",
                (city_id, month_filter),
            )
        else:
            cur.execute("DELETE FROM edge_traffic WHERE city_id = %s", (city_id,))

        query = f"""
            INSERT INTO edge_traffic (edge_id, city_id, trip_count, month)
            SELECT
                re.edge_id,
                e.city_id,
                COUNT(re.route_id),
                DATE_TRUNC('month', r.datetime_unlock)::DATE AS month
            FROM route_edges re
            JOIN edges  e ON re.edge_id  = e.id
            JOIN routes r ON re.route_id = r.id
            WHERE e.city_id = %s
              AND r.city_id = %s
              {month_clause}
              AND r.datetime_unlock IS NOT NULL
            GROUP BY re.edge_id, e.city_id, DATE_TRUNC('month', r.datetime_unlock)
            ON CONFLICT (edge_id, month) DO UPDATE SET
                trip_count = EXCLUDED.trip_count
        """
        cur.execute(query, params)
        rows = cur.rowcount
        print(f"   ✅ Upserted {rows} edge-traffic records.")

        # Enable traffic mode flag
        cur.execute(
            """
            INSERT INTO city_modes (city_id, traffic)
            VALUES (%s, TRUE)
            ON CONFLICT (city_id) DO UPDATE SET traffic = TRUE
            """,
            (city_id,),
        )



# ---------------------------------------------------------------------------
# Read
# ---------------------------------------------------------------------------

def get_edge_traffic(
    conn,
    city_id: int,
    month: Optional[date] = None,
) -> List[Tuple[int, int, date]]:
    """Return traffic records for a city.

    If *month* is given, filter to that month only.
    Returns (edge_id, trip_count, month).
    """
    with conn.cursor() as cur:
        if month:
            cur.execute(
                """
                SELECT edge_id, trip_count, month
                FROM edge_traffic
                WHERE city_id = %s AND month = %s
                ORDER BY edge_id
                """,
                (city_id, month),
            )
        else:
            cur.execute(
                """
                SELECT edge_id, trip_count, month
                FROM edge_traffic
                WHERE city_id = %s
                ORDER BY month DESC, edge_id
                """,
                (city_id,),
            )
        return cur.fetchall()


def get_latest_traffic_month(conn, city_id: int) -> Optional[date]:
    """Return the most recent month available in edge_traffic for a city."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT MAX(month) FROM edge_traffic WHERE city_id = %s",
            (city_id,),
        )
        row = cur.fetchone()
        return row[0] if row else None


def has_traffic(conn, city_id: int) -> bool:
    """Return True if any traffic data exists for the city."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT EXISTS(SELECT 1 FROM edge_traffic WHERE city_id = %s)",
            (city_id,),
        )
        return cur.fetchone()[0]
