"""
scores.py – Compute per-mode quality scores for a city.

Each mode (infrastructure / traffic / stations) returns:
  {
    "overall": int (0-100),
    "segments": [{"label": str, "weight": float, "value": float, "color": str}]
  }

Scores are normalized across all cities that have the given mode enabled,
using min-max scaling so a city's score is relative to the full distribution.
"""

from typing import Dict, Any, List, Optional


# Accent colors per mode
_INFRA_COLOR    = "#3b82f6"
_TRAFFIC_COLOR  = "#15803d"
_STATIONS_COLOR = "#22c55e"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _minmax(val: Optional[float], values: List[float]) -> float:
    """Normalize val into [0, 1] using the provided distribution of values.

    Returns 0.0 if val is None/invalid.
    Returns 1.0 if there is only one city (no spread to normalize).
    """
    if val is None:
        return 0.0
    valid = [v for v in values if v is not None]
    if not valid:
        return 0.0
    mn, mx = min(valid), max(valid)
    if mx == mn:
        return 1.0
    normalized = (val - mn) / (mx - mn)
    return max(0.0, min(1.0, float(normalized)))


def _overall(segments: List[Dict]) -> int:
    """Compute weighted overall score (0-100) from segments."""
    total = sum(s["weight"] * s["value"] for s in segments)
    return int(round(total * 100))


# ---------------------------------------------------------------------------
# Infrastructure score
# ---------------------------------------------------------------------------

def _fetch_infra_raw(conn) -> List[Dict]:
    """Fetch raw infrastructure metrics for ALL cities with infrastructure=true."""
    with conn.cursor() as cur:
        # gcc_fraction and total_km from graph module (get_gcc_coverage equivalent inline)
        cur.execute("""
            SELECT
                c.id                          AS city_id,
                c.population,
                cm.coverage,
                cm.total_kilometers,
                (
                    SELECT gcc_frac.gcc_fraction
                    FROM (
                        SELECT
                            city_id,
                            SUM(length) FILTER (WHERE highway LIKE '%%cycleway%%') AS gcc_km,
                            SUM(length) AS total_e_km
                        FROM edges
                        WHERE city_id = c.id
                        GROUP BY city_id
                    ) gcc_frac
                ) AS gcc_km_ratio
            FROM cities c
            JOIN city_modes cm_mode ON cm_mode.city_id = c.id AND cm_mode.infrastructure = true
            LEFT JOIN LATERAL (
                SELECT coverage, total_kilometers
                FROM city_metrics
                WHERE city_id = c.id
                ORDER BY metric_month DESC
                LIMIT 1
            ) cm ON true
        """)
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]


def _compute_infra_scores(rows: List[Dict], city_id: int) -> Optional[Dict[str, Any]]:
    """Given all-city rows, compute normalized infrastructure score for city_id."""
    target = next((r for r in rows if r["city_id"] == city_id), None)
    if target is None:
        return None

    # --- gcc_fraction metric (50%) ---
    # Use gcc_km_ratio only; missing data → segment value = 0
    gcc_vals = [r.get("gcc_km_ratio") for r in rows]
    target_gcc = target.get("gcc_km_ratio")

    # --- coverage metric (25%) ---
    cov_vals = [r.get("coverage") for r in rows]
    target_cov = target.get("coverage")

    # --- km/100k hab metric (25%) ---
    km_per_100k_vals = []
    for r in rows:
        km = r.get("total_kilometers")
        pop = r.get("population")
        if km is not None and pop and pop > 0:
            km_per_100k_vals.append(km / (pop / 100_000))
        else:
            km_per_100k_vals.append(None)

    target_km = target.get("total_kilometers")
    target_pop = target.get("population")
    target_km_per_100k = (
        target_km / (target_pop / 100_000)
        if target_km is not None and target_pop and target_pop > 0
        else None
    )

    gcc_norm  = _minmax(target_gcc, [v for v in gcc_vals if v is not None])
    cov_norm  = _minmax(target_cov, [v for v in cov_vals if v is not None])
    km_norm   = _minmax(target_km_per_100k, [v for v in km_per_100k_vals if v is not None])

    segments = [
        {"label": "GCC fraction",   "weight": 0.50, "value": gcc_norm,  "color": _INFRA_COLOR},
        {"label": "Coverage",        "weight": 0.25, "value": cov_norm,  "color": _INFRA_COLOR},
        {"label": "km / 100k hab",   "weight": 0.25, "value": km_norm,   "color": _INFRA_COLOR},
    ]
    return {"overall": _overall(segments), "segments": segments}


# ---------------------------------------------------------------------------
# Traffic score
# ---------------------------------------------------------------------------

def _fetch_traffic_raw(conn) -> List[Dict]:
    """Fetch raw traffic metrics for ALL cities with traffic=true."""
    with conn.cursor() as cur:
        cur.execute("""
            SELECT
                c.id         AS city_id,
                c.population,
                -- infra_fraction: avg fraction of trip-km on cycling infra (best combo, latest month)
                (
                    SELECT ic.infra_fraction
                    FROM (
                        SELECT
                            et.city_id,
                            SUM(et.trip_count * CASE WHEN e.highway LIKE '%%cycleway%%' THEN 1 ELSE 0 END)::float
                                / NULLIF(SUM(et.trip_count), 0) AS infra_fraction
                        FROM edge_traffic et
                        JOIN edges e ON e.id = et.edge_id
                        WHERE et.city_id = c.id
                          AND et.month = (
                              SELECT MAX(month) FROM edge_traffic WHERE city_id = c.id
                          )
                        GROUP BY et.city_id
                    ) ic
                ) AS infra_fraction,
                -- total trip_count for latest month (any combo)
                (
                    SELECT SUM(trip_count)
                    FROM edge_traffic
                    WHERE city_id = c.id
                      AND month = (SELECT MAX(month) FROM edge_traffic WHERE city_id = c.id)
                ) AS total_trips,
                -- median trip length proxy: avg edge length weighted by trip_count
                (
                    SELECT
                        SUM(e.length * et.trip_count) / NULLIF(SUM(et.trip_count), 0)
                    FROM edge_traffic et
                    JOIN edges e ON e.id = et.edge_id
                    WHERE et.city_id = c.id
                      AND et.month = (SELECT MAX(month) FROM edge_traffic WHERE city_id = c.id)
                ) AS avg_trip_length_m
            FROM cities c
            JOIN city_modes cm ON cm.city_id = c.id AND cm.traffic = true
        """)
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]


def _compute_traffic_scores(rows: List[Dict], city_id: int) -> Optional[Dict[str, Any]]:
    target = next((r for r in rows if r["city_id"] == city_id), None)
    if target is None:
        return None

    # infra_fraction (40%)
    infra_vals = [r.get("infra_fraction") for r in rows]
    target_infra = target.get("infra_fraction")

    # trips/1000 hab (30%)
    trips_per_1k_vals = []
    for r in rows:
        trips = r.get("total_trips")
        pop   = r.get("population")
        if trips is not None and pop and pop > 0:
            trips_per_1k_vals.append(float(trips) / (pop / 1_000))
        else:
            trips_per_1k_vals.append(None)

    target_trips = target.get("total_trips")
    target_pop   = target.get("population")
    target_trips_per_1k = (
        float(target_trips) / (target_pop / 1_000)
        if target_trips is not None and target_pop and target_pop > 0
        else None
    )

    # route efficiency (30%): lower avg length = higher score → invert after normalising
    length_vals = [r.get("avg_trip_length_m") for r in rows]
    target_length = target.get("avg_trip_length_m")
    # invert: efficiency_val = max_length - val  (higher = shorter trips = better)
    valid_lengths = [v for v in length_vals if v is not None]
    if valid_lengths and target_length is not None:
        max_len = max(valid_lengths)
        inverted_length_vals = [max_len - v for v in valid_lengths]
        inverted_target = max_len - target_length
    else:
        inverted_length_vals = []
        inverted_target = None

    infra_norm  = _minmax(target_infra, [v for v in infra_vals if v is not None])
    trips_norm  = _minmax(target_trips_per_1k, [v for v in trips_per_1k_vals if v is not None])
    eff_norm    = _minmax(inverted_target, inverted_length_vals)

    segments = [
        {"label": "Infra coverage",   "weight": 0.40, "value": infra_norm,  "color": _TRAFFIC_COLOR},
        {"label": "Trips / 1k hab",   "weight": 0.30, "value": trips_norm,  "color": _TRAFFIC_COLOR},
        {"label": "Route efficiency", "weight": 0.30, "value": eff_norm,    "color": _TRAFFIC_COLOR},
    ]
    return {"overall": _overall(segments), "segments": segments}


# ---------------------------------------------------------------------------
# Stations score
# ---------------------------------------------------------------------------

def _fetch_stations_raw(conn) -> List[Dict]:
    """Fetch raw station metrics for ALL cities with stations=true."""
    with conn.cursor() as cur:
        cur.execute("""
            SELECT
                c.id         AS city_id,
                c.population,
                -- reach coverage: avg over unmerged stations
                (
                    SELECT AVG(reach_coverage)
                    FROM stations
                    WHERE city_id = c.id AND merged_into_id IS NULL
                ) AS avg_reach_coverage,
                -- trips/bike/month from latest city_metrics
                (
                    SELECT
                        CASE
                            WHEN cm2.total_stations > 0
                            THEN COALESCE(cm2.actual_monthly_trips, cm2.estimated_monthly_trips) / cm2.total_stations
                            ELSE NULL
                        END
                    FROM city_metrics cm2
                    WHERE cm2.city_id = c.id
                    ORDER BY metric_month DESC
                    LIMIT 1
                ) AS trips_per_station,
                -- total stations (unmerged)
                (
                    SELECT COUNT(*)
                    FROM stations
                    WHERE city_id = c.id AND merged_into_id IS NULL
                ) AS total_stations
            FROM cities c
            JOIN city_modes cm ON cm.city_id = c.id AND cm.stations = true
        """)
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]


def _compute_stations_scores(rows: List[Dict], city_id: int) -> Optional[Dict[str, Any]]:
    target = next((r for r in rows if r["city_id"] == city_id), None)
    if target is None:
        return None

    # reach coverage (40%)
    reach_vals  = [r.get("avg_reach_coverage") for r in rows]
    target_reach = target.get("avg_reach_coverage")

    # trips/station/month (30%)
    tps_vals    = [r.get("trips_per_station") for r in rows]
    target_tps  = target.get("trips_per_station")

    # station density/km² (30%): stations / area proxy (pop/5000)
    density_vals = []
    for r in rows:
        stations = r.get("total_stations")
        pop      = r.get("population")
        if stations is not None and pop and pop > 0:
            area_km2 = pop / 5_000.0
            density_vals.append(float(stations) / area_km2)
        else:
            density_vals.append(None)

    target_stations = target.get("total_stations")
    target_pop      = target.get("population")
    target_density  = (
        float(target_stations) / (target_pop / 5_000.0)
        if target_stations is not None and target_pop and target_pop > 0
        else None
    )

    reach_norm   = _minmax(target_reach, [v for v in reach_vals if v is not None])
    tps_norm     = _minmax(target_tps, [v for v in tps_vals if v is not None])
    density_norm = _minmax(target_density, [v for v in density_vals if v is not None])

    segments = [
        {"label": "Reach coverage",      "weight": 0.40, "value": reach_norm,   "color": _STATIONS_COLOR},
        {"label": "Trips / station / mo", "weight": 0.30, "value": tps_norm,     "color": _STATIONS_COLOR},
        {"label": "Station density",      "weight": 0.30, "value": density_norm, "color": _STATIONS_COLOR},
    ]
    return {"overall": _overall(segments), "segments": segments}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def compute_mode_scores(conn, city_id: int) -> Dict[str, Dict[str, Any]]:
    """Return dict keyed by mode with 'overall' (int 0-100) and 'segments' list.

    Each segment: {label, weight, value (0-1 normalized), color}

    Only modes enabled for the given city are included.
    All scores are normalized across cities sharing the same mode (min-max).
    Missing data for a segment → value = 0.
    """
    # Determine which modes this city has enabled
    with conn.cursor() as cur:
        cur.execute(
            "SELECT infrastructure, traffic, stations FROM city_modes WHERE city_id = %s",
            (city_id,),
        )
        row = cur.fetchone()

    if row is None:
        return {}

    has_infra, has_traffic, has_stations = bool(row[0]), bool(row[1]), bool(row[2])
    result: Dict[str, Dict[str, Any]] = {}

    if has_infra:
        infra_rows = _fetch_infra_raw(conn)
        score = _compute_infra_scores(infra_rows, city_id)
        if score is not None:
            result["infrastructure"] = score

    if has_traffic:
        traffic_rows = _fetch_traffic_raw(conn)
        score = _compute_traffic_scores(traffic_rows, city_id)
        if score is not None:
            result["traffic"] = score

    if has_stations:
        stations_rows = _fetch_stations_raw(conn)
        score = _compute_stations_scores(stations_rows, city_id)
        if score is not None:
            result["stations"] = score

    return result
