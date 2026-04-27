"""
check_schema.py
Validates that the live DB matches the expected schema.sql structure.
Reports missing tables, columns, indexes, and constraints.

Usage:
    python backend/database/check_schema.py
"""
import sys
from pathlib import Path
from dotenv import load_dotenv

sys.path.append(str(Path(__file__).resolve().parents[2]))
from backend.database.db_io import connect_db

load_dotenv()

# ── What we expect ────────────────────────────────────────────────────────────

EXPECTED_TABLES = [
    "cities", "city_modes", "ingestion_status", "historical_mayors",
    "city_metrics", "station_monthly", "estimated_trips_per_interval",
    "city_elections", "city_councilors", "city_budgets", "city_budget_categories",
    "nodes", "edges", "trips", "paths", "path_edges", "path_nodes", "routes",
    "features", "stations", "station_readings", "edge_traffic",
    "accidents", "accident_participants",
]

# (table, column, expected_data_type)  — data_type is the information_schema value
EXPECTED_COLUMNS = [
    ("cities",        "name",            "text"),
    ("cities",        "alt_name",        "text"),
    ("cities",        "slug",            "text"),
    ("cities",        "wikidata_id",     "text"),
    ("cities",        "center_lat",      "double precision"),
    ("cities",        "center_lon",      "double precision"),
    ("trips",         "origin_node",     "bigint"),
    ("trips",         "dest_node",       "bigint"),
    ("trips",         "generation_type", "text"),
    ("edge_traffic",  "generation_type", "text"),
    ("edge_traffic",  "algorithm",       "text"),
    ("edge_traffic",  "month",           "date"),
    ("accidents",     "vehicles_involved", "ARRAY"),
    ("accidents",     "closest_edge_id", "integer"),
    ("accident_participants", "alcohol_positive", "boolean"),
    ("accident_participants", "drugs_positive",   "boolean"),
]

EXPECTED_INDEXES = [
    "uq_ingestion_status",
    "idx_station_monthly_city_month",
    "idx_trips_city_id",
    "idx_trips_generation_type",
    "idx_trips_origin_node",
    "idx_trips_dest_node",
    "paths_shortest_uq",
    "idx_paths_city_id",
    "idx_path_edges_edge_id",
    "idx_path_nodes_node_id",
    "idx_routes_city_id",
    "idx_routes_trip_id",
    "idx_routes_path_id",
    "idx_edge_traffic_city_id",
    "idx_edge_traffic_month",
    "idx_nodes_network_id",
    "idx_nodes_geom",
    "idx_edges_network_id",
    "idx_edges_geom",
    "idx_features_network_type",
    "idx_stations_city_id",
    "idx_stations_geom",
    "idx_stations_merged_into",
    "idx_station_readings_city_time",
    "idx_station_readings_network_time",
    "idx_accidents_city_id",
    "idx_accidents_geom",
    "idx_accidents_timestamp",
    "idx_accidents_closest_edge",
    "idx_participants_accident_id",
]

# (table, constraint_type, columns_or_description)
EXPECTED_CONSTRAINTS = [
    # edge_traffic composite PK
    ("edge_traffic", "PRIMARY KEY", {"edge_id", "month", "generation_type", "algorithm"}),
    # cities unique slug
    ("cities", "UNIQUE", {"slug"}),
    # cities unique wikidata_id
    ("cities", "UNIQUE", {"wikidata_id"}),
]

# ── Helpers ───────────────────────────────────────────────────────────────────

OK   = "\033[32m✓\033[0m"
FAIL = "\033[31m✗\033[0m"
WARN = "\033[33m~\033[0m"

SYSTEM_TABLES = {"spatial_ref_sys"}  # PostGIS internals, not ours

def check_tables(cur, expected):
    cur.execute("""
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    """)
    existing = {r[0] for r in cur.fetchall()}
    missing = [t for t in expected if t not in existing]
    extra   = [t for t in existing if t not in expected and t not in SYSTEM_TABLES]
    return missing, extra

def check_columns(cur, expected):
    cur.execute("""
        SELECT table_name, column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
    """)
    existing = {(r[0], r[1]): r[2] for r in cur.fetchall()}
    issues = []
    for table, col, dtype in expected:
        key = (table, col)
        if key not in existing:
            issues.append(f"  {FAIL} {table}.{col} — MISSING")
        elif existing[key] != dtype:
            issues.append(f"  {WARN} {table}.{col} — type is '{existing[key]}', expected '{dtype}'")
    return issues

def check_indexes(cur, expected):
    cur.execute("""
        SELECT indexname FROM pg_indexes WHERE schemaname = 'public'
    """)
    existing = {r[0] for r in cur.fetchall()}
    missing = [i for i in expected if i not in existing]
    return missing

def check_constraints(cur, expected):
    cur.execute("""
        SELECT tc.table_name, tc.constraint_type, kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
        WHERE tc.table_schema = 'public'
    """)
    rows = cur.fetchall()
    # group: (table, constraint_type) -> set of columns
    from collections import defaultdict
    grouped = defaultdict(set)
    for table, ctype, col in rows:
        grouped[(table, ctype)].add(col)

    issues = []
    for table, ctype, cols in expected:
        found = grouped.get((table, ctype))
        if found is None:
            issues.append(f"  {FAIL} {table} — no {ctype} constraint found")
        elif not cols.issubset(found):
            missing_cols = cols - found
            issues.append(f"  {FAIL} {table} {ctype} — missing columns {missing_cols} (have {found})")
    return issues

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    conn = connect_db()
    with conn.cursor() as cur:
        print("\n── Tables ───────────────────────────────────────────────")
        missing_tables, extra_tables = check_tables(cur, EXPECTED_TABLES)
        if not missing_tables and not extra_tables:
            print(f"  {OK} All {len(EXPECTED_TABLES)} expected tables present")
        for t in missing_tables:
            print(f"  {FAIL} MISSING table: {t}")
        for t in extra_tables:
            print(f"  {WARN} Extra table (not in checklist): {t}")

        print("\n── Columns ──────────────────────────────────────────────")
        col_issues = check_columns(cur, EXPECTED_COLUMNS)
        if not col_issues:
            print(f"  {OK} All {len(EXPECTED_COLUMNS)} checked columns present with correct types")
        for issue in col_issues:
            print(issue)

        print("\n── Indexes ──────────────────────────────────────────────")
        missing_idx = check_indexes(cur, EXPECTED_INDEXES)
        if not missing_idx:
            print(f"  {OK} All {len(EXPECTED_INDEXES)} expected indexes present")
        for i in missing_idx:
            print(f"  {FAIL} MISSING index: {i}")

        print("\n── Constraints ──────────────────────────────────────────")
        con_issues = check_constraints(cur, EXPECTED_CONSTRAINTS)
        if not con_issues:
            print(f"  {OK} All {len(EXPECTED_CONSTRAINTS)} checked constraints present")
        for issue in con_issues:
            print(issue)

    conn.close()

    total_issues = (
        len(missing_tables) + len(col_issues) +
        len(missing_idx)    + len(con_issues)
    )
    print(f"\n{'─'*52}")
    if total_issues == 0:
        print(f"{OK} Schema is up to date.\n")
        sys.exit(0)
    else:
        print(f"{FAIL} {total_issues} issue(s) found — schema needs migration.\n")
        sys.exit(1)

if __name__ == "__main__":
    main()
