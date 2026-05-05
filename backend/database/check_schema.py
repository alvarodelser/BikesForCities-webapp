"""
check_schema.py
Validates that the live DB matches schema.sql — dynamically parsed, no hardcoded lists.

Usage:
    python backend/database/check_schema.py
"""
import re
import sys
from pathlib import Path
from dotenv import load_dotenv

sys.path.append(str(Path(__file__).resolve().parents[2]))
from backend.database.db_io import connect_db

load_dotenv()

SCHEMA_PATH = Path(__file__).resolve().parent / "schema.sql"

OK   = "\033[32m✓\033[0m"
FAIL = "\033[31m✗\033[0m"
WARN = "\033[33m~\033[0m"

# Maps DDL type tokens → information_schema.data_type values
DDL_TO_INFO_SCHEMA = {
    "serial":           "integer",
    "bigserial":        "bigint",
    "int":              "integer",
    "integer":          "integer",
    "bigint":           "bigint",
    "smallint":         "smallint",
    "boolean":          "boolean",
    "bool":             "boolean",
    "text":             "text",
    "double precision": "double precision",
    "float":            "double precision",
    "real":             "real",
    "numeric":          "numeric",
    "decimal":          "numeric",
    "jsonb":            "jsonb",
    "json":             "json",
    "date":             "date",
    "timestamptz":      "timestamp with time zone",
    "timestamp with time zone":    "timestamp with time zone",
    "timestamp without time zone": "timestamp without time zone",
    "timestamp":        "timestamp without time zone",
    "geometry":         "USER-DEFINED",
    "geography":        "USER-DEFINED",
    "bytea":            "bytea",
    "uuid":             "uuid",
}

# Clause keywords that start a table-level constraint, not a column
TABLE_CONSTRAINT_KEYWORDS = {"unique", "primary", "foreign", "check", "exclude", "constraint"}


def _ddl_type_to_info_schema(ddl_type: str) -> str:
    """Map a DDL type token to information_schema.data_type."""
    t = ddl_type.strip().lower()
    # Strip size modifier: varchar(50) → varchar, geometry(Point,4326) → geometry
    base = re.split(r"[\s(]", t)[0]
    if base in ("varchar", "char", "character varying"):
        return "character varying"
    # Try multi-word match first
    if t.startswith("double precision"):
        return "double precision"
    if t.startswith("timestamp with time zone"):
        return "timestamp with time zone"
    if t.startswith("timestamp without time zone"):
        return "timestamp without time zone"
    if t.startswith("timestamp"):
        return "timestamp without time zone"
    if "[]" in t or t.startswith("text[]") or t.startswith("integer[]"):
        return "ARRAY"
    return DDL_TO_INFO_SCHEMA.get(base, base)


def _split_columns(body: str) -> list[str]:
    """Split a CREATE TABLE body into individual column/constraint definitions."""
    parts = []
    depth = 0
    current: list[str] = []
    for ch in body:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
        if ch == "," and depth == 0:
            parts.append("".join(current).strip())
            current = []
        else:
            current.append(ch)
    if current:
        parts.append("".join(current).strip())
    return [p for p in parts if p]


def parse_schema_sql(path: Path) -> tuple[dict, list]:
    """Parse schema.sql and return (tables, indexes).

    tables: {table_name: {col_name: info_schema_type}}
    indexes: [index_name, ...]
    """
    sql = path.read_text()

    # Strip line comments
    sql = re.sub(r"--[^\n]*", "", sql)

    tables: dict[str, dict[str, str]] = {}
    indexes: list[str] = []

    # ── Tables ────────────────────────────────────────────────────────────────
    for m in re.finditer(
        r"CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+(\w+)\s*\((.+?)\)\s*;",
        sql,
        re.IGNORECASE | re.DOTALL,
    ):
        table_name = m.group(1).lower()
        body = m.group(2)
        columns: dict[str, str] = {}

        for part in _split_columns(body):
            part = part.strip()
            if not part:
                continue
            first_token = part.split()[0].lower()
            if first_token in TABLE_CONSTRAINT_KEYWORDS:
                continue  # table-level constraint, not a column

            # Column definition: name type [modifiers...]
            tokens = part.split()
            col_name = tokens[0].lower()
            if len(tokens) < 2:
                continue
            # Grab the raw type (may be two tokens for "double precision", etc.)
            raw_type = tokens[1]
            if len(tokens) > 2 and tokens[1].lower() == "double" and tokens[2].lower() == "precision":
                raw_type = "double precision"
            elif len(tokens) > 2 and tokens[1].lower() == "timestamp":
                remainder = " ".join(tokens[2:4]).lower()
                if remainder.startswith("with time"):
                    raw_type = "timestamp with time zone"
                elif remainder.startswith("without time"):
                    raw_type = "timestamp without time zone"
            elif len(tokens) > 2 and tokens[1].lower() == "character" and tokens[2].lower() == "varying":
                raw_type = "character varying"

            columns[col_name] = _ddl_type_to_info_schema(raw_type)

        tables[table_name] = columns

    # ── Indexes ───────────────────────────────────────────────────────────────
    for m in re.finditer(
        r"CREATE\s+(?:UNIQUE\s+)?INDEX\s+IF\s+NOT\s+EXISTS\s+(\w+)",
        sql,
        re.IGNORECASE,
    ):
        indexes.append(m.group(1))

    return tables, indexes


# ── Checks ────────────────────────────────────────────────────────────────────

def check_tables(cur, expected_tables: dict) -> tuple[list, list]:
    cur.execute("""
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    """)
    existing = {r[0] for r in cur.fetchall()}
    system = {"spatial_ref_sys"}
    missing = [t for t in expected_tables if t not in existing]
    extra   = [t for t in existing if t not in expected_tables and t not in system]
    return missing, extra


def check_columns(cur, expected_tables: dict) -> list[str]:
    cur.execute("""
        SELECT table_name, column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
    """)
    existing: dict[tuple, str] = {(r[0], r[1]): r[2] for r in cur.fetchall()}
    issues = []
    for table, cols in expected_tables.items():
        for col, expected_type in cols.items():
            key = (table, col)
            if key not in existing:
                issues.append(f"  {FAIL} {table}.{col} — MISSING")
            elif expected_type != "?" and existing[key] != expected_type:
                issues.append(
                    f"  {WARN} {table}.{col} — type is '{existing[key]}', expected '{expected_type}'"
                )
    return issues


def check_indexes(cur, expected_indexes: list) -> list[str]:
    cur.execute("SELECT indexname FROM pg_indexes WHERE schemaname = 'public'")
    existing = {r[0] for r in cur.fetchall()}
    return [i for i in expected_indexes if i not in existing]


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print(f"Parsing {SCHEMA_PATH.name}…")
    expected_tables, expected_indexes = parse_schema_sql(SCHEMA_PATH)
    print(f"  Found {len(expected_tables)} tables, "
          f"{sum(len(c) for c in expected_tables.values())} columns, "
          f"{len(expected_indexes)} indexes\n")

    conn = connect_db()
    with conn.cursor() as cur:
        print("── Tables ───────────────────────────────────────────────")
        missing_tables, extra_tables = check_tables(cur, expected_tables)
        if not missing_tables and not extra_tables:
            print(f"  {OK} All {len(expected_tables)} expected tables present")
        for t in missing_tables:
            print(f"  {FAIL} MISSING table: {t}")
        for t in extra_tables:
            print(f"  {WARN} Extra table (not in schema.sql): {t}")

        print("\n── Columns ──────────────────────────────────────────────")
        col_issues = check_columns(cur, expected_tables)
        total_cols = sum(len(c) for c in expected_tables.values())
        if not col_issues:
            print(f"  {OK} All {total_cols} columns present with correct types")
        for issue in col_issues:
            print(issue)

        print("\n── Indexes ──────────────────────────────────────────────")
        missing_idx = check_indexes(cur, expected_indexes)
        if not missing_idx:
            print(f"  {OK} All {len(expected_indexes)} indexes present")
        for i in missing_idx:
            print(f"  {FAIL} MISSING index: {i}")

    conn.close()

    total_issues = len(missing_tables) + len(col_issues) + len(missing_idx)
    print(f"\n{'─'*52}")
    if total_issues == 0:
        print(f"{OK} Schema is up to date.\n")
        sys.exit(0)
    else:
        print(f"{FAIL} {total_issues} issue(s) found — schema needs migration.\n")
        sys.exit(1)


if __name__ == "__main__":
    main()
