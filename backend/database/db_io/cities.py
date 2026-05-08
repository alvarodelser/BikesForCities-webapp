"""
cities.py – CRUD for city-level tables:
  cities, city_modes, ingestion_status, historical_mayors,
  city_elections, city_councilors, city_budgets / budget_lines.
"""
import json
from typing import List, Optional, Tuple

import pandas as pd
import psycopg2
from psycopg2.extras import execute_values, RealDictCursor


# ---------------------------------------------------------------------------
# Core city table
# ---------------------------------------------------------------------------

def get_or_create_city(
    conn,
    name: str,
    slug: str,
    alt_name: Optional[str] = None,
    description: Optional[str] = None,
    center_lat: Optional[float] = None,
    center_lon: Optional[float] = None,
    radius: Optional[float] = None,
    wikidata_id: Optional[str] = None,
) -> int:
    with conn.cursor() as cur:
        if wikidata_id:
            cur.execute(
                """
                UPDATE cities SET
                    name          = %s,
                    alt_name      = %s,
                    slug          = %s,
                    description   = COALESCE(%s, description),
                    center_lat    = COALESCE(%s, center_lat),
                    center_lon    = COALESCE(%s, center_lon),
                    radius        = COALESCE(%s, radius)
                WHERE wikidata_id = %s
                RETURNING id
                """,
                (name, alt_name, slug, description, center_lat, center_lon, radius, wikidata_id),
            )
            row = cur.fetchone()
            if row:
                return row[0]

        cur.execute(
            """
            INSERT INTO cities (name, alt_name, slug, description, center_lat, center_lon, radius, wikidata_id)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (slug) DO UPDATE SET
                name          = EXCLUDED.name,
                alt_name      = EXCLUDED.alt_name,
                description   = COALESCE(EXCLUDED.description, cities.description),
                center_lat    = COALESCE(EXCLUDED.center_lat, cities.center_lat),
                center_lon    = COALESCE(EXCLUDED.center_lon, cities.center_lon),
                radius        = COALESCE(EXCLUDED.radius, cities.radius),
                wikidata_id   = EXCLUDED.wikidata_id
            RETURNING id
            """,
            (name, alt_name, slug, description, center_lat, center_lon, radius, wikidata_id),
        )
        return cur.fetchone()[0]


def put_city_modes(conn, city_id: int, modes_dict: dict):
    combos = modes_dict.get("traffic_combinations", [])
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO city_modes (
                city_id, infrastructure, traffic, traffic_combinations,
                accidents, stations
            ) VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (city_id) DO UPDATE SET
                infrastructure       = EXCLUDED.infrastructure,
                traffic              = EXCLUDED.traffic,
                traffic_combinations = EXCLUDED.traffic_combinations,
                accidents            = EXCLUDED.accidents,
                stations             = EXCLUDED.stations
            """,
            (
                city_id,
                modes_dict.get("infrastructure", False),
                modes_dict.get("traffic", False),
                json.dumps(combos),
                modes_dict.get("accidents", False),
                modes_dict.get("stations", False),
            ),
        )


def update_city_wikidata(
    conn,
    city_id: int,
    population: Optional[int] = None,
    website: Optional[str] = None,
    mayor: Optional[str] = None,
    mayor_party: Optional[str] = None,
):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE cities
            SET population  = %s,
                website     = %s,
                mayor       = %s,
                mayor_party = %s
            WHERE id = %s
            """,
            (population, website, mayor, mayor_party, city_id),
        )


def get_all_cities(conn) -> List[Tuple]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                c.id, c.name, c.alt_name, c.slug, c.description, c.wikidata_id,
                c.center_lat, c.center_lon, c.radius,
                c.population,
                (SELECT total_expenses FROM city_budgets cb
                 WHERE cb.city_id = c.id
                 ORDER BY year DESC,
                          CASE WHEN budget_type = 'executed' THEN 1 ELSE 2 END ASC
                 LIMIT 1) AS budget,
                cm.coverage,
                cm.total_kilometers AS cycling_network,
                c.bounds_min_lat, c.bounds_max_lat, c.bounds_min_lon, c.bounds_max_lon,
                m.infrastructure, m.traffic, m.traffic_combinations, m.accidents, m.stations,
                c.mayor, c.mayor_party,
                (SELECT citybikes_network_id FROM stations s
                 WHERE s.city_id = c.id LIMIT 1) AS service_name,
                cm.total_stations,
                COALESCE(cm.actual_monthly_trips, cm.estimated_monthly_trips) AS monthly_trips,
                cm.bicycles_count,
                cm.station_coverage
            FROM cities c
            LEFT JOIN city_modes m ON c.id = m.city_id
            LEFT JOIN LATERAL (
                SELECT coverage, total_kilometers, total_stations, estimated_monthly_trips, bicycles_count, station_coverage
                FROM city_metrics
                WHERE city_id = c.id
                ORDER BY metric_month DESC
                LIMIT 1
            ) cm ON true
            ORDER BY c.name
            """
        )
        return cur.fetchall()


def get_city_center(conn, city_id: int) -> Optional[Tuple[float, float, float]]:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT center_lat, center_lon, radius FROM cities WHERE id = %s",
            (city_id,),
        )
        result = cur.fetchone()
        if result and all(x is not None for x in result):
            return result
        return None


def city_exists(conn, city_id: int) -> bool:
    with conn.cursor() as cur:
        cur.execute("SELECT 1 FROM cities WHERE id = %s", (city_id,))
        return cur.fetchone() is not None


def get_city_id_by_name(conn, name: str) -> Optional[int]:
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM cities WHERE name = %s", (name,))
        result = cur.fetchone()
        return result[0] if result else None


def get_city_details(conn, city_id: int) -> Optional[dict]:
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT
                c.id, c.name, c.alt_name, c.slug, c.description, c.wikidata_id,
                c.center_lat, c.center_lon, c.radius,
                c.population,
                (SELECT total_expenses FROM city_budgets cb
                 WHERE cb.city_id = c.id
                 ORDER BY year DESC,
                          CASE WHEN budget_type = 'executed' THEN 1 ELSE 2 END ASC
                 LIMIT 1) AS budget,
                cm.coverage,
                cm.total_kilometers AS cycling_network,
                c.mayor, c.mayor_party,
                (SELECT citybikes_network_id FROM stations s
                 WHERE s.city_id = c.id LIMIT 1) AS service_name,
                cm.total_stations AS stations_count,
                COALESCE(cm.actual_monthly_trips, cm.estimated_monthly_trips) AS monthly_trips,
                cm.bicycles_count,
                cm.station_coverage,
                m.infrastructure, m.traffic, m.traffic_combinations,
                m.accidents, m.stations
            FROM cities c
            LEFT JOIN city_modes m ON c.id = m.city_id
            LEFT JOIN LATERAL (
                SELECT coverage, total_kilometers, total_stations, estimated_monthly_trips, bicycles_count, station_coverage
                FROM city_metrics
                WHERE city_id = c.id
                ORDER BY metric_month DESC
                LIMIT 1
            ) cm ON true
            WHERE c.id = %s
            """,
            (city_id,)
        )
        return cur.fetchone()


def get_city_bounds(conn, city_id: int) -> Optional[dict]:
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT bounds_min_lat AS min_lat, bounds_max_lat AS max_lat,
                   bounds_min_lon AS min_lon, bounds_max_lon AS max_lon
            FROM cities WHERE id = %s
            """,
            (city_id,)
        )
        result = cur.fetchone()
        if result and result.get("min_lat") is not None:
            return dict(result)
        return None


# ---------------------------------------------------------------------------
# Ingestion status
# ---------------------------------------------------------------------------

def get_ingestion_status(
    conn,
    process_name: str,
    city_id: Optional[int] = None,
    time_period: Optional[str] = None,
) -> Optional[dict]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT updated_at, status, details, city_id, time_period
            FROM ingestion_status
            WHERE process_name = %s
              AND city_id IS NOT DISTINCT FROM %s
              AND time_period IS NOT DISTINCT FROM %s
            """,
            (process_name, city_id, time_period),
        )
        row = cur.fetchone()
        if row:
            return {
                "updated_at": row[0],
                "status": row[1],
                "details": row[2] or {},
                "city_id": row[3],
                "time_period": row[4]
            }
        return None


def upsert_ingestion_status(
    conn,
    process_name: str,
    status: str,
    city_id: Optional[int] = None,
    time_period: Optional[str] = None,
    details: Optional[dict] = None
):
    details_json = json.dumps(details) if details else None
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO ingestion_status (process_name, city_id, time_period, updated_at, status, details)
            VALUES (%s, %s, %s, NOW(), %s, %s)
            ON CONFLICT (process_name, COALESCE(city_id, 0), COALESCE(time_period, ''))
            DO UPDATE SET
                updated_at = NOW(),
                status     = EXCLUDED.status,
                details    = COALESCE(EXCLUDED.details, ingestion_status.details)
            """,
            (process_name, city_id, time_period, status, details_json),
        )


def check_prerequisites(conn, pnames: list, city_id: Optional[int] = None) -> list:
    """Returns names from pnames that are not SUCCESS in ingestion_status for the given city."""
    return [p for p in pnames if (get_ingestion_status(conn, p, city_id=city_id) or {}).get("status") != "SUCCESS"]


# ---------------------------------------------------------------------------
# Historical mayors
# ---------------------------------------------------------------------------

def put_historical_mayors(conn, city_id: int, mayors_df: pd.DataFrame):
    """Bulk insert historical mayors for a given city (clears existing first)."""
    if mayors_df.empty:
        return
    with conn.cursor() as cur:
        cur.execute("DELETE FROM historical_mayors WHERE city_id = %s", (city_id,))
        args = []
        for _, row in mayors_df.iterrows():
            name = row.get("mayorLabel")
            if not name or pd.isna(name):
                continue
            party = (
                row.get("partyLabel")
                if "partyLabel" in row and not pd.isna(row.get("partyLabel"))
                else None
            )
            start_dt = row.get("start")
            start_date = start_dt.strftime("%Y-%m-%d") if pd.notna(start_dt) else None
            end_dt = row.get("end")
            end_date = end_dt.strftime("%Y-%m-%d") if pd.notna(end_dt) else None
            args.append((city_id, name, party, start_date, end_date))
        if args:
            execute_values(
                cur,
                """
                INSERT INTO historical_mayors (city_id, name, party, start_date, end_date)
                VALUES %s
                ON CONFLICT (city_id, name, start_date) DO NOTHING
                """,
                args,
            )


# ---------------------------------------------------------------------------
# City elections & councilors
# ---------------------------------------------------------------------------

def put_city_elections(conn, city_id: int, elections_df: pd.DataFrame):
    """Bulk insert multi-party electoral results."""
    if elections_df.empty:
        return
    with conn.cursor() as cur:
        years = tuple(int(y) for y in elections_df["year"].unique())
        if years:
            cur.execute(
                "DELETE FROM city_elections WHERE city_id = %s AND year IN %s",
                (city_id, years),
            )
        args = [
            (city_id, int(row["year"]), row["party"], int(row["votes"]), int(row["councilors"]))
            for _, row in elections_df.iterrows()
        ]
        if args:
            execute_values(
                cur,
                """
                INSERT INTO city_elections (city_id, year, party, votes, councilors)
                VALUES %s
                ON CONFLICT (city_id, year, party) DO NOTHING
                """,
                args,
            )


def put_city_councilors(conn, city_id: int, councilors_df: pd.DataFrame):
    """Bulk insert individual candidates."""
    if councilors_df.empty:
        return
    with conn.cursor() as cur:
        years = tuple(int(y) for y in councilors_df["year"].unique())
        if years:
            cur.execute(
                "DELETE FROM city_councilors WHERE city_id = %s AND year IN %s",
                (city_id, years),
            )
        args = [
            (city_id, int(row["year"]), row["party"], row["name"], row["elected"])
            for _, row in councilors_df.iterrows()
        ]
        if args:
            execute_values(
                cur,
                """
                INSERT INTO city_councilors (city_id, year, party, name, elected)
                VALUES %s
                ON CONFLICT (city_id, year, party, name) DO NOTHING
                """,
                args,
            )


# ---------------------------------------------------------------------------
# City budgets
# ---------------------------------------------------------------------------

def put_city_budgets(
    conn,
    city_id: int,
    year: int,
    budget_type: str = 'planned',
    total_income: Optional[int] = None,
    total_expenses: Optional[int] = None,
    public_debt: Optional[int] = None,
) -> int:
    """Upsert a yearly city budget summary."""
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO city_budgets (city_id, year, budget_type, total_income, total_expenses, public_debt)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (city_id, year, budget_type)
            DO UPDATE SET
                total_income   = COALESCE(EXCLUDED.total_income, city_budgets.total_income),
                total_expenses = COALESCE(EXCLUDED.total_expenses, city_budgets.total_expenses),
                public_debt    = COALESCE(EXCLUDED.public_debt, city_budgets.public_debt)
            RETURNING id
            """,
            (city_id, year, budget_type, total_income, total_expenses, public_debt),
        )
        return cur.fetchone()[0]


def put_city_budget_categories(
    conn,
    city_id: int,
    year: int,
    budget_type: str,
    lines_df: pd.DataFrame,
):
    """
    Bulk insert functional budget categories for a city/year/type.
    lines_df columns: ['category_code', 'category_name', 'amount']
    """
    if lines_df.empty:
        return
        
    with conn.cursor() as cur:
        # Clear existing lines for this city/year/type before re-ingesting
        cur.execute(
            "DELETE FROM city_budget_categories WHERE city_id = %s AND year = %s AND budget_type = %s",
            (city_id, year, budget_type)
        )
        
        args = [
            (city_id, year, budget_type, str(row["category_code"]), row["category_name"], int(row["amount"]))
            for _, row in lines_df.iterrows()
        ]
        
        execute_values(
            cur,
            """
            INSERT INTO city_budget_categories (city_id, year, budget_type, category_code, category_name, amount)
            VALUES %s
            ON CONFLICT (city_id, year, budget_type, category_code)
            DO UPDATE SET
                category_name = EXCLUDED.category_name,
                amount        = city_budget_categories.amount + EXCLUDED.amount
            """,
            args
        )


TRAFFIC_MIN_EDGES   = 50   # minimum rows in edge_traffic to enable traffic mode
STATIONS_MIN_COUNT  = 3    # minimum non-merged stations to enable stations mode


def refresh_city_modes(conn, city_id: int) -> dict:
    """Recompute all dynamic modes from actual data counts.

    Two round-trips: first resolves the available traffic combinations, then
    writes the full city_modes row. Call after ingesting any data.
    Returns the updated modes dict.
    """
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT generation_type, algorithm
            FROM edge_traffic
            WHERE city_id = %s
            GROUP BY generation_type, algorithm
            HAVING COUNT(DISTINCT edge_id) >= %s
            ORDER BY
                CASE generation_type
                    WHEN 'real'                 THEN 1
                    WHEN 'station_based'        THEN 2
                    WHEN 'buildings_population' THEN 3
                    ELSE 4
                END,
                CASE algorithm
                    WHEN 'map_matched' THEN 1
                    WHEN 'shortest'    THEN 2
                    ELSE 3
                END
            """,
            (city_id, TRAFFIC_MIN_EDGES),
        )
        combos = [
            {"generation_type": r["generation_type"], "algorithm": r["algorithm"]}
            for r in cur.fetchall()
        ]

        cur.execute(
            """
            INSERT INTO city_modes (
                city_id, infrastructure, traffic, traffic_combinations,
                stations, accidents
            )
            SELECT
                %(id)s,
                EXISTS (SELECT 1 FROM edges WHERE city_id = %(id)s),
                %(has_traffic)s,
                %(combos)s::jsonb,
                (SELECT COUNT(*) >= %(s_min)s FROM stations
                 WHERE city_id = %(id)s AND merged_into_id IS NULL),
                EXISTS (SELECT 1 FROM accidents WHERE city_id = %(id)s)
            ON CONFLICT (city_id) DO UPDATE SET
                infrastructure       = EXCLUDED.infrastructure,
                traffic              = EXCLUDED.traffic,
                traffic_combinations = EXCLUDED.traffic_combinations,
                stations             = EXCLUDED.stations,
                accidents            = EXCLUDED.accidents
            RETURNING infrastructure, traffic, traffic_combinations, stations, accidents
            """,
            {
                'id': city_id,
                'has_traffic': len(combos) > 0,
                'combos': json.dumps(combos),
                's_min': STATIONS_MIN_COUNT,
            },
        )
        return dict(cur.fetchone())


def get_city_modes(conn, city_id: int) -> Optional[dict]:
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT infrastructure, traffic, traffic_combinations, accidents, stations
            FROM city_modes
            WHERE city_id = %s
            """,
            (city_id,),
        )
        row = cur.fetchone()
    return dict(row) if row else None


def get_city_budgets(conn, city_id: int) -> List[dict]:
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT
                cb.id,
                cb.year,
                cb.total_income,
                cb.total_expenses,
                cb.public_debt,
                COALESCE(
                    (SELECT json_agg(
                        json_build_object(
                            'category_code', cat.category_code,
                            'category_name', cat.category_name,
                            'amount', cat.amount,
                            'budget_type', cat.budget_type
                        )
                    ) FROM city_budget_categories cat
                      WHERE cat.city_id = cb.city_id 
                        AND cat.year = cb.year),
                    '[]'::json
                ) AS lines
            FROM city_budgets cb
            WHERE cb.city_id = %s
            ORDER BY cb.year DESC
            """,
            (city_id,),
        )
        return [dict(r) for r in cur.fetchall()]


def get_infra_budget(conn, city_id: int) -> dict:
    """Return the latest Vías Públicas (functional code 153) budget for a city."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT year, budget_type, amount
            FROM city_budget_categories
            WHERE city_id = %s AND category_code = '153'
            ORDER BY year DESC,
                     CASE WHEN budget_type = 'executed' THEN 1 ELSE 2 END
            LIMIT 1
            """,
            (city_id,),
        )
        row = cur.fetchone()
    if not row:
        return {"year": None, "budget_type": None, "amount_eur": None}
    return {"year": row[0], "budget_type": row[1], "amount_eur": int(row[2])}


def get_historical_mayors(conn, city_id: int) -> list:
    """Return chronological list of mayors for a city."""
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT name, party, start_date, end_date
            FROM historical_mayors
            WHERE city_id = %s
            ORDER BY start_date
            """,
            (city_id,),
        )
        return [dict(r) for r in cur.fetchall()]


def get_city_elections_data(conn, city_id: int) -> list:
    """Return electoral results per party per year."""
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT year, party, votes, councilors
            FROM city_elections
            WHERE city_id = %s
            ORDER BY year, councilors DESC
            """,
            (city_id,),
        )
        return [dict(r) for r in cur.fetchall()]
