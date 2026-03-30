"""
stations.py – CRUD for bike-share stations table.
"""
from typing import List, Tuple


def get_stations(conn, city_id: int) -> List[Tuple]:
    """Retrieve all active (non-merged) stations for a city.

    Returns (id, station_id, name, lat, lon, citybikes_network_id,
             extra, estimated_monthly_trips, downtime_minutes).
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, station_id, name, lat, lon, citybikes_network_id,
                   extra, estimated_monthly_trips, downtime_minutes
            FROM stations
            WHERE city_id = %s AND merged_into_id IS NULL
            """,
            (city_id,),
        )
        return cur.fetchall()
