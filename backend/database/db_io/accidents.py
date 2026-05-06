"""
Database I/O for accident data.
"""

from __future__ import annotations
from typing import List, Dict, Any, Optional


def get_accidents_geojson(
    conn,
    city_id: int,
    cyclists_only: bool = True,
) -> Dict[str, Any]:
    """Return cyclist-involved accidents as a GeoJSON FeatureCollection.

    Each feature is a Point with properties:
      - accident_id, timestamp, street, district, accident_type, weather,
        total_involved, injured, killed, vehicles_involved
    """
    with conn.cursor() as cur:
        cyclist_clause = "AND 'bike_vmu' = ANY(a.vehicles_involved)" if cyclists_only else ""
        cur.execute(f"""
            SELECT
                a.accident_id,
                a.timestamp,
                a.street,
                a.street_number,
                a.district,
                a.accident_type,
                a.weather,
                ST_X(a.geom) AS lon,
                ST_Y(a.geom) AS lat,
                a.total_involved,
                a.injured,
                a.killed,
                a.vehicles_involved,
                MAX(ap.injury_code) AS max_injury_code,
                (ARRAY_AGG(ap.injury_status ORDER BY COALESCE(ap.injury_code, 0) DESC))[1]
                    AS worst_injury_status,
                JSON_AGG(
                    JSON_BUILD_OBJECT(
                        'vehicle_type', ap.vehicle_type,
                        'person_type', ap.person_type,
                        'injury_code', ap.injury_code,
                        'injury_status', ap.injury_status,
                        'alcohol_positive', ap.alcohol_positive,
                        'drugs_positive', ap.drugs_positive
                    )
                ) AS participants
            FROM accidents a
            LEFT JOIN accident_participants ap ON ap.accident_db_id = a.id
            WHERE a.city_id = %s
              AND a.geom IS NOT NULL
              {cyclist_clause}
            GROUP BY a.id
            ORDER BY a.timestamp DESC
        """, (city_id,))
        rows = cur.fetchall()

    features = []
    for row in rows:
        (accident_id, ts, street, street_number, district,
         accident_type, weather, lon, lat,
         total_involved, injured, killed,
         vehicles_involved,
         max_injury_code, worst_injury,
         participants) = row

        # Determine severity category
        severity = _classify_severity(killed, injured, max_injury_code, worst_injury)

        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [lon, lat],
            },
            "properties": {
                "accident_id": accident_id,
                "timestamp": ts.isoformat() if ts else None,
                "street": street,
                "street_number": street_number,
                "district": district,
                "accident_type": accident_type,
                "weather": weather,
                "total_involved": total_involved or 0,
                "injured": injured or 0,
                "killed": killed or 0,
                "vehicles_involved": vehicles_involved or [],
                "severity": severity,
                "max_injury_code": max_injury_code,
                "worst_injury_status": worst_injury,
                "participants": participants,
            },
        })

    return {
        "type": "FeatureCollection",
        "features": features,
    }


def _classify_severity(
    killed: Optional[int],
    injured: Optional[int],
    max_code: Optional[int],
    worst_status: Optional[str],
) -> str:
    """Map raw accident data to a severity bucket.

    Returns one of: 'fatal', 'serious', 'minor', 'uninjured'.
    """
    if killed and killed > 0:
        return "fatal"

    status_lower = (worst_status or "").lower()

    # Code-based (Madrid open data)
    # 4: Fallecido 24 horas
    # 3: Ingreso hospitalario (>24h)
    # 1, 2, 5, 6, 7: Asistencia sanitaria / Leve
    # 14: Sin asistencia sanitaria (Ileso)
    # 77: Desconocido
    if max_code is not None:
        if max_code == 4:
            return "fatal"
        elif max_code == 3:
            return "serious"
        elif max_code in (1, 2, 5, 6, 7):
            return "minor"
        elif max_code == 14:
            return "uninjured"
        # If 77 or other, fall through to text-based or injured count

    # Fallback: text-based
    if any(kw in status_lower for kw in ("fallecido", "muerto")):
        return "fatal"
    if any(kw in status_lower for kw in ("hospitaliz", "grave")):
        return "serious"
    if any(kw in status_lower for kw in ("leve", "asistencia sanitaria")):
        return "minor"
    if injured and injured > 0:
        return "minor"

    return "uninjured"
