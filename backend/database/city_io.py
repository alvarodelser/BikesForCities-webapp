from datetime import datetime
import psycopg2
from typing import List, Optional, Tuple



# Connect to the database
def connect_db():
    import os
    return psycopg2.connect(
        dbname=os.getenv("POSTGRES_DB"),
        user=os.getenv("POSTGRES_USER"),
        password=os.getenv("POSTGRES_PASSWORD"),
        host=os.getenv("POSTGRES_HOST"),
        port=os.getenv("POSTGRES_PORT", "5432")
    )

# Insert (or retrieve) a city and return its ID
def get_or_create_city(conn, name: str, description: Optional[str] = None, 
                          center_lat: Optional[float] = None, center_lon: Optional[float] = None, 
                          radius: Optional[float] = None, angle: Optional[float] = None,
                          wikidata_id: Optional[str] = None) -> int:
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO cities (name, description, center_lat, center_lon, radius, angle, wikidata_id)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (name) DO UPDATE SET 
                description = EXCLUDED.description,
                center_lat = EXCLUDED.center_lat,
                center_lon = EXCLUDED.center_lon,
                radius = EXCLUDED.radius,
                angle = EXCLUDED.angle,
                wikidata_id = EXCLUDED.wikidata_id
            RETURNING id
        """, (name, description, center_lat, center_lon, radius, angle, wikidata_id))
        return cur.fetchone()[0]

def put_city_modes(conn, city_id: int, modes_dict: dict):
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO city_modes (
                city_id, infrastructure, traffic, accidents, 
                topography, intersections, stations, forum
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (city_id) DO UPDATE SET
                infrastructure = EXCLUDED.infrastructure,
                traffic = EXCLUDED.traffic,
                accidents = EXCLUDED.accidents,
                topography = EXCLUDED.topography,
                intersections = EXCLUDED.intersections,
                stations = EXCLUDED.stations,
                forum = EXCLUDED.forum
        """, (
            city_id,
            modes_dict.get('infrastructure', False),
            modes_dict.get('traffic', False),
            modes_dict.get('accidents', False),
            modes_dict.get('topography', False),
            modes_dict.get('intersections', False),
            modes_dict.get('stations', False),
            modes_dict.get('forum', False)
        ))
    conn.commit()

def update_city_wikidata(conn, city_id: int, population: Optional[int] = None, 
                         website: Optional[str] = None, mayor: Optional[str] = None, 
                         mayor_party: Optional[str] = None):
    with conn.cursor() as cur:
        cur.execute("""
            UPDATE cities
            SET population = %s,
                website = %s,
                mayor = %s,
                mayor_party = %s
            WHERE id = %s
        """, (population, website, mayor, mayor_party, city_id))
    conn.commit()

def get_ingestion_status(conn, city_id: int, data_type: str) -> Optional[dict]:
    with conn.cursor() as cur:
        cur.execute("""
            SELECT updated_at, status, details
            FROM ingestion_status
            WHERE city_id = %s AND data_type = %s
        """, (city_id, data_type))
        row = cur.fetchone()
        if row:
            return {"updated_at": row[0], "status": row[1], "details": row[2] or {}}
        return None

def upsert_ingestion_status(conn, city_id: int, data_type: str, status: str, details: Optional[dict] = None):
    import json
    details_json = json.dumps(details) if details else None
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO ingestion_status (city_id, data_type, updated_at, status, details)
            VALUES (%s, %s, NOW(), %s, %s)
            ON CONFLICT (city_id, data_type) DO UPDATE SET
                updated_at = NOW(),
                status = EXCLUDED.status,
                details = COALESCE(EXCLUDED.details, ingestion_status.details)
        """, (city_id, data_type, status, details_json))
    conn.commit()

import pandas as pd
from psycopg2.extras import execute_values


def put_historical_mayors(conn, city_id: int, mayors_df: pd.DataFrame):
    """Bulk insert historical mayors for a given city and clear existing."""
    if mayors_df.empty: return
    
    with conn.cursor() as cur:
        cur.execute("DELETE FROM historical_mayors WHERE city_id = %s", (city_id,))
        
        args = []
        for _, row in mayors_df.iterrows():
            name = row.get('mayorLabel')
            if not name or pd.isna(name): continue
            
            party = row.get('partyLabel') if 'partyLabel' in row and not pd.isna(row.get('partyLabel')) else None
            
            start_dt = row.get('start')
            start_date = start_dt.strftime('%Y-%m-%d') if pd.notna(start_dt) else None
            
            end_dt = row.get('end')
            end_date = end_dt.strftime('%Y-%m-%d') if pd.notna(end_dt) else None
            
            args.append((city_id, name, party, start_date, end_date))
            
        if args:
            execute_values(
                cur,
                """
                INSERT INTO historical_mayors (city_id, name, party, start_date, end_date)
                VALUES %s
                ON CONFLICT (city_id, name, start_date) DO NOTHING
                """,
                args
            )
    conn.commit()

def put_city_elections(conn, city_id: int, elections_df: pd.DataFrame):
    """Bulk insert multi-party electoral results."""
    if elections_df.empty: return
    with conn.cursor() as cur:
        years = tuple(int(y) for y in elections_df['year'].unique())
        if years:
            cur.execute("DELETE FROM city_elections WHERE city_id = %s AND year IN %s", (city_id, years))
            
        args = []
        for _, row in elections_df.iterrows():
            args.append((
                city_id, 
                int(row['year']), 
                row['party'], 
                int(row['votes']), 
                int(row['councilors'])
            ))
            
        if args:
            execute_values(
                cur,
                """
                INSERT INTO city_elections (city_id, year, party, votes, councilors)
                VALUES %s
                ON CONFLICT (city_id, year, party) DO NOTHING
                """,
                args
            )
    conn.commit()

def put_city_councilors(conn, city_id: int, councilors_df: pd.DataFrame):
    """Bulk insert individual candidates."""
    if councilors_df.empty: return
    with conn.cursor() as cur:
        years = tuple(int(y) for y in councilors_df['year'].unique())
        if years:
            cur.execute("DELETE FROM city_councilors WHERE city_id = %s AND year IN %s", (city_id, years))
            
        args = []
        for _, row in councilors_df.iterrows():
            args.append((
                city_id, 
                int(row['year']), 
                row['party'], 
                row['name'], 
                row['elected']
            ))
            
        if args:
            execute_values(
                cur,
                """
                INSERT INTO city_councilors (city_id, year, party, name, elected)
                VALUES %s
                ON CONFLICT (city_id, year, party, name) DO NOTHING
                """,
                args
            )
    conn.commit()


def put_city_budgets(conn, city_id: int, year: int, total_income: int, total_expenses: int, public_debt: int, lines_list: List[dict]):
    """
    Upserts a yearly city budget and replaces its functional/economic breakdown lines.
    lines_list is a list of dicts: {'category_name': str, 'line_type': 'INCOME'|'EXPENSE', 'amount': int}
    """
    with conn.cursor() as cur:
        # Upsert the main budget
        cur.execute("""
            INSERT INTO city_budgets (city_id, year, total_income, total_expenses, public_debt)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (city_id, year)
            DO UPDATE SET 
                total_income = EXCLUDED.total_income,
                total_expenses = EXCLUDED.total_expenses,
                public_debt = EXCLUDED.public_debt
            RETURNING id;
        """, (city_id, year, total_income, total_expenses, public_debt))
        
        budget_id = cur.fetchone()[0]
        
        # Clear existing lines for this budget to avoid duplication
        cur.execute("DELETE FROM budget_lines WHERE budget_id = %s;", (budget_id,))
        
        # Insert the new breakdown lines
        if lines_list:
            args_str = ','.join(cur.mogrify("(%s,%s,%s,%s)", (
                budget_id, 
                line['category_name'], 
                line['line_type'], 
                line['amount']
            )).decode('utf-8') for line in lines_list)
            
            cur.execute(f"""
                INSERT INTO budget_lines (budget_id, category_name, line_type, amount)
                VALUES {args_str};
            """)
    conn.commit()
    return budget_id


def put_nodes(conn, nodes: List[Tuple[int, int, int, float, float, str, int]]):
    """Bulk‐insert node rows.

    Expected tuple layout:
        (city_id, id, osmid, lat, lon, geom_wkt, street_count)
    """
    with conn.cursor() as cur:
        cur.executemany(
            """
            INSERT INTO nodes (
                city_id, id, osmid, lat, lon, geom, street_count
            )
            VALUES (
                %s, %s, %s, %s, %s, ST_GeomFromText(%s, 4326), %s
            )
            ON CONFLICT (id) DO NOTHING
            """,
            nodes,
        )
    conn.commit()


def put_edges(conn, edges: List[Tuple]):
    """Bulk‐insert edge rows.

    Each tuple should follow the layout generated by
    `app.processing.city_ops.extract_edges`:

        (city_id, osmid, u, v, k, geom, highway, name, length, width,
         maxspeed, lanes, oneway, tunnel, bridge)
    """
    with conn.cursor() as cur:
        cur.executemany(
            """
            INSERT INTO edges (
                city_id, osmid, u, v, k, geom, highway, name, length, width,
                maxspeed, lanes, oneway, tunnel, bridge
            )
            VALUES (
                %s, %s, %s, %s, %s, ST_GeomFromText(%s, 4326),
                %s, %s, %s, %s, %s, %s, %s, %s, %s
            )
            ON CONFLICT (u, v, k) DO NOTHING
            """,
            [
                (
                    e[0],  # city_id
                    e[1],  # osmid
                    e[2],  # u
                    e[3],  # v
                    e[4],  # k
                    e[5].wkt,  # geom as WKT
                    *e[6:],
                )
                for e in edges
            ],
        )
    conn.commit()


def put_routes(conn, routes: List[Tuple[int, str, int, int, str, float, datetime, int]]):
    """Bulk insert routes.

    Tuple layout must follow the column order in backend/database/schema.sql:

        (city_id, id_trip, origin_node, dest_node, strategy, trip_minutes,
         datetime_unlock, id_bike)
    """

    with conn.cursor() as cur:
        cur.executemany(
            """
            INSERT INTO routes (
                city_id, id_trip, origin_node, dest_node, strategy,
                trip_minutes, datetime_unlock, id_bike
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id_trip) DO NOTHING
            """,
            routes,
        )
    conn.commit()

def get_nodes(conn: psycopg2.extensions.connection, city_id: int) -> List[Tuple[int, float, float, str, int]]:
    """
    Retrieve all nodes belonging to the given city ID.
    
    :param conn: PostgreSQL database connection
    :param city_id: ID of the city to filter nodes by
    :return: List of tuples (id, lat, lon, geom_wkt, street_count)
    """
    with conn.cursor() as cur:
        cur.execute("""
            SELECT id, lat, lon, ST_AsText(geom), street_count
            FROM nodes
            WHERE city_id = %s
        """, (city_id,))
        return cur.fetchall()


def get_edges(conn: psycopg2.extensions.connection, city_id: int) -> List[Tuple]:
    """
    Retrieve all edges belonging to the given city ID.
    
    :param conn: PostgreSQL database connection
    :param city_id: ID of the city to filter edges by
    :return: List of edge attribute tuples
    """
    with conn.cursor() as cur:
        cur.execute("""
            SELECT 
                osmid, u, v, k, ST_AsText(geom),
                highway, name, length, width,
                maxspeed, lanes, oneway, tunnel, bridge
            FROM edges
            WHERE city_id = %s
        """, (city_id,))
        return cur.fetchall()


def get_all_cities(conn: psycopg2.extensions.connection) -> List[Tuple]:
    """
    Retrieve all cities from the database with their latest metrics.
    
    :param conn: PostgreSQL database connection
    :return: List of tuples containing city data and metrics
    """
    with conn.cursor() as cur:
        cur.execute("""
            SELECT 
                c.id, c.name, c.description, c.wikidata_id, c.center_lat, c.center_lon, c.radius, c.angle,
                c.population,
                (SELECT total_expenses FROM city_budgets cb WHERE cb.city_id = c.id ORDER BY year DESC LIMIT 1) as budget,
                (SELECT coverage FROM city_metrics cm WHERE cm.city_id = c.id ORDER BY metric_month DESC LIMIT 1) as coverage,
                (SELECT total_kilometers FROM city_metrics cm WHERE cm.city_id = c.id ORDER BY metric_month DESC LIMIT 1) as cycling_network,
                (SELECT MIN(lat) FROM nodes WHERE city_id = c.id) as min_lat,
                (SELECT MAX(lat) FROM nodes WHERE city_id = c.id) as max_lat,
                (SELECT MIN(lon) FROM nodes WHERE city_id = c.id) as min_lon,
                (SELECT MAX(lon) FROM nodes WHERE city_id = c.id) as max_lon,
                m.infrastructure, m.traffic, m.accidents, m.topography, m.intersections, m.stations, m.forum,
                c.mayor, c.mayor_party,
                (SELECT citybikes_network_id FROM stations s WHERE s.city_id = c.id LIMIT 1) as service_name,
                (SELECT COUNT(*) FROM stations s WHERE s.city_id = c.id) as stations_count,
                (SELECT SUM(estimated_trips) FROM estimated_trips_per_interval et WHERE et.city_id = c.id AND et.observed_at > (SELECT MAX(observed_at) FROM estimated_trips_per_interval) - INTERVAL '30 days') as monthly_trips
            FROM cities c 
            LEFT JOIN city_modes m ON c.id = m.city_id
            ORDER BY c.name
        """)
        return cur.fetchall()


def get_city_center(conn: psycopg2.extensions.connection, city_id: int) -> Optional[Tuple[float, float, float]]:
    """
    Get the center point and radius for a city.
    
    :param conn: PostgreSQL database connection
    :param city_id: ID of the city
    :return: Tuple of (center_lat, center_lon, radius) or None if not set
    """
    with conn.cursor() as cur:
        cur.execute("""
            SELECT center_lat, center_lon, radius 
            FROM cities 
            WHERE id = %s
        """, (city_id,))
        result = cur.fetchone()
        if result and all(x is not None for x in result):
            return result
        return None


def count_nodes(conn: psycopg2.extensions.connection, city_id: int) -> int:
    """
    Count the number of nodes for a given city ID.
    
    :param conn: PostgreSQL database connection
    :param city_id: ID of the city to count nodes for
    :return: Number of nodes
    """
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM nodes WHERE city_id = %s", (city_id,))
        return cur.fetchone()[0]


def count_edges(conn: psycopg2.extensions.connection, city_id: int) -> int:
    """
    Count the number of edges for a given city ID.
    
    :param conn: PostgreSQL database connection
    :param city_id: ID of the city to count edges for
    :return: Number of edges
    """
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM edges WHERE city_id = %s", (city_id,))
        return cur.fetchone()[0]


def count_routes(conn: psycopg2.extensions.connection, city_id: int) -> int:
    """
    Count the number of routes/trips for a given city ID.
    
    :param conn: PostgreSQL database connection
    :param city_id: ID of the city to count routes for
    :return: Number of routes
    """
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM routes WHERE city_id = %s", (city_id,))
        return cur.fetchone()[0]


def put_features(conn, city_id: int, features_data: List[Tuple]):
    """
    Bulk insert features (same pattern as put_nodes/put_edges).
    
    Expected tuple layout:
        (feature_type, geometry_wkt, tags_json)
    
    :param conn: PostgreSQL database connection
    :param city_id: ID of the city to insert features for
    :param features_data: List of feature tuples
    """
    with conn.cursor() as cur:
        cur.executemany(
            """
            INSERT INTO features (
                city_id, feature_type, geometry, tags
            )
            VALUES (
                %s, %s, ST_GeomFromText(%s, 4326), %s
            )
            ON CONFLICT DO NOTHING
            """,
            [(city_id, feature_type, geom_wkt, tags_json) 
             for feature_type, geom_wkt, tags_json in features_data]
        )
    conn.commit()


def get_features(conn: psycopg2.extensions.connection, city_id: int, feature_type: Optional[str] = None) -> List[Tuple]:
    """
    Get features by city and optionally filter by type.
    
    :param conn: PostgreSQL database connection
    :param city_id: ID of the city to filter features by
    :param feature_type: Optional feature type to filter by
    :return: List of feature tuples (id, feature_type, geometry_wkt, tags)
    """
    with conn.cursor() as cur:
        if feature_type:
            cur.execute("""
                SELECT id, feature_type, ST_AsText(geometry), tags
                FROM features
                WHERE city_id = %s AND feature_type = %s
            """, (city_id, feature_type))
        else:
            cur.execute("""
                SELECT id, feature_type, ST_AsText(geometry), tags
                FROM features
                WHERE city_id = %s
            """, (city_id,))
        return cur.fetchall()


def count_features(conn: psycopg2.extensions.connection, city_id: int, feature_type: Optional[str] = None) -> int:
    """
    Count the number of features for a given city ID and optionally by type.
    
    :param conn: PostgreSQL database connection
    :param city_id: ID of the city to count features for
    :param feature_type: Optional feature type to filter by
    :return: Number of features
    """
    with conn.cursor() as cur:
        if feature_type:
            cur.execute("SELECT COUNT(*) FROM features WHERE city_id = %s AND feature_type = %s", (city_id, feature_type))
        else:
            cur.execute("SELECT COUNT(*) FROM features WHERE city_id = %s", (city_id,))
        return cur.fetchone()[0]