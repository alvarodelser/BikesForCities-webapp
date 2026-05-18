"""
Database I/O for accident data.
"""

from __future__ import annotations
from typing import Dict, Any, Optional


# Madrid injury codes (cod_lesividad) are NOT ordinal — code 14 (uninjured) is
# numerically greater than code 4 (fatal). MIN over this rank picks the worst
# victim per accident; the inverse map below returns the original code.
_INJURY_RANK_CASE = """
    CASE ap.injury_code
        WHEN 4  THEN 1
        WHEN 3  THEN 2
        WHEN 1  THEN 3
        WHEN 2  THEN 3
        WHEN 5  THEN 3
        WHEN 6  THEN 3
        WHEN 7  THEN 3
        WHEN 14 THEN 4
        ELSE 5
    END
"""

_RANK_TO_CODE_CASE = f"""
    CASE MIN({_INJURY_RANK_CASE})
        WHEN 1 THEN 4
        WHEN 2 THEN 3
        WHEN 3 THEN 1
        WHEN 4 THEN 14
        ELSE NULL
    END
"""


def get_accidents_geojson(
    conn,
    city_id: int,
    cyclists_only: bool = True,
    year: Optional[int] = None,
) -> Dict[str, Any]:
    """Slim GeoJSON for the map (no per-victim participants)."""
    cyclist_clause = "AND 'bike_vmu' = ANY(a.vehicles_involved)" if cyclists_only else ""
    year_clause = "AND EXTRACT(YEAR FROM a.timestamp)::INT = %s" if year is not None else ""
    params = [city_id] + ([year] if year is not None else [])
    with conn.cursor() as cur:
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
                {_RANK_TO_CODE_CASE} AS max_injury_code,
                (ARRAY_AGG(ap.injury_status ORDER BY {_INJURY_RANK_CASE} ASC NULLS LAST)
                 FILTER (WHERE ap.injury_status IS NOT NULL))[1] AS worst_injury_status
            FROM accidents a
            LEFT JOIN accident_participants ap ON ap.accident_db_id = a.id
            WHERE a.city_id = %s
              AND a.geom IS NOT NULL
              {cyclist_clause}
              {year_clause}
            GROUP BY a.id
            ORDER BY a.timestamp DESC
        """, params)
        rows = cur.fetchall()

    features = []
    for (accident_id, ts, street, street_number, district,
         accident_type, weather, lon, lat,
         total_involved, injured, killed,
         vehicles_involved,
         max_injury_code, worst_injury) in rows:
        severity = _classify_severity(killed, injured, max_injury_code, worst_injury)
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [lon, lat]},
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
            },
        })

    return {"type": "FeatureCollection", "features": features}


def get_accidents_summary(conn, city_id: int, year: Optional[int] = None) -> Dict[str, Any]:
    """Aggregate counts for the stats panel — cheap, no features."""
    year_clause = "AND EXTRACT(YEAR FROM timestamp)::INT = %s" if year is not None else ""
    params_counts = [city_id] + ([year] if year is not None else [])
    with conn.cursor() as cur:
        cur.execute(f"""
            SELECT
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE 'bike_vmu' = ANY(vehicles_involved))   AS cyclist,
                COUNT(*) FILTER (WHERE 'pedestrian' = ANY(vehicles_involved)) AS pedestrian,
                MAX(EXTRACT(YEAR FROM timestamp))::INT AS latest_year
            FROM accidents
            WHERE city_id = %s AND geom IS NOT NULL
            {year_clause}
        """, params_counts)
        total, cyclist, pedestrian, latest_year = cur.fetchone()

        cur.execute("""
            SELECT ARRAY_AGG(DISTINCT EXTRACT(YEAR FROM timestamp)::INT ORDER BY 1 DESC)
            FROM accidents
            WHERE city_id = %s AND geom IS NOT NULL AND timestamp IS NOT NULL
        """, (city_id,))
        (available_years,) = cur.fetchone()

    return {
        "total": total or 0,
        "cyclist": cyclist or 0,
        "pedestrian": pedestrian or 0,
        "latest_year": latest_year,
        "available_years": available_years or [],
    }


def get_accident_detail(conn, city_id: int, accident_id: str) -> Optional[Dict[str, Any]]:
    """Per-victim participant breakdown + accident metadata."""
    with conn.cursor() as cur:
        cur.execute(f"""
            SELECT
                a.accident_id,
                a.timestamp,
                a.street,
                a.street_number,
                a.district,
                a.accident_type,
                a.weather,
                a.vehicles_involved,
                JSON_AGG(
                    JSON_BUILD_OBJECT(
                        'vehicle_type', ap.vehicle_type,
                        'person_type', ap.person_type,
                        'injury_code', ap.injury_code,
                        'injury_status', ap.injury_status,
                        'alcohol_positive', ap.alcohol_positive,
                        'drugs_positive', ap.drugs_positive
                    ) ORDER BY {_INJURY_RANK_CASE} ASC NULLS LAST
                ) FILTER (WHERE ap.id IS NOT NULL) AS participants
            FROM accidents a
            LEFT JOIN accident_participants ap ON ap.accident_db_id = a.id
            WHERE a.city_id = %s AND a.accident_id = %s
            GROUP BY a.id
        """, (city_id, accident_id))
        row = cur.fetchone()
    if not row:
        return None
    (acc_id, ts, street, street_number, district,
     accident_type, weather, vehicles_involved, participants) = row
    return {
        "accident_id": acc_id,
        "timestamp": ts.isoformat() if ts else None,
        "street": street,
        "street_number": street_number,
        "district": district,
        "accident_type": accident_type,
        "weather": weather,
        "vehicles_involved": vehicles_involved or [],
        "participants": participants or [],
    }


def _classify_severity(
    killed: Optional[int],
    injured: Optional[int],
    max_code: Optional[int],
    worst_status: Optional[str],
) -> str:
    if killed and killed > 0:
        return "fatal"

    if max_code is not None:
        if max_code == 4:
            return "fatal"
        if max_code == 3:
            return "serious"
        if max_code in (1, 2, 5, 6, 7):
            return "minor"
        if max_code == 14:
            return "uninjured"

    status_lower = (worst_status or "").lower()
    if any(kw in status_lower for kw in ("fallecido", "muerto")):
        return "fatal"
    if any(kw in status_lower for kw in ("hospitaliz", "grave")):
        return "serious"
    if any(kw in status_lower for kw in ("leve", "asistencia sanitaria")):
        return "minor"
    if injured and injured > 0:
        return "minor"

    return "uninjured"
