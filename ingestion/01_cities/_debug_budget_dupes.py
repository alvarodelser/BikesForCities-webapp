"""
_debug_budget_dupes.py
Quick diagnostic: print the raw parsed rows for Palma (city_id 114) to
understand why category_code '17' appears twice in the 2023 planned data.
"""
import sys, re, gzip, json, requests
from io import BytesIO
from pathlib import Path
from collections import Counter

sys.path.append(str(Path(__file__).resolve().parents[2]))
from backend.database.db_io import connect_db, get_all_cities

BASE_URL = "https://raw.githubusercontent.com/PopulateTools/gobierto-budgets-data/master/data/presupuestos_municipales"
YEAR, TTYPE = 2023, "planned"
TARGET_CITY_NAME = "Palma"

def fetch_lines(url):
    r = requests.get(url, stream=True, timeout=30)
    if r.status_code != 200:
        print(f"HTTP {r.status_code} for {url}")
        return
    with gzip.GzipFile(fileobj=BytesIO(r.content)) as f:
        for line in f:
            yield line.decode("utf-8", errors="replace")

def get_entity_ids_for_palma(conn, db_cities):
    """Return all entity IDs that map to Palma."""
    spain_data_path = Path(__file__).resolve().parents[2] / "data" / "spain_data.json"
    with open(spain_data_path) as f:
        spain_data = json.load(f)

    palma_city_id = next(c[0] for c in db_cities if c[1] == TARGET_CITY_NAME)
    ine_code = spain_data.get(TARGET_CITY_NAME, {}).get("ine_code")
    print(f"Palma city_id={palma_city_id}, INE code={ine_code}")

    url = f"{BASE_URL}/{YEAR}/{TTYPE}/tb_inventario.sql.gz"
    matched_eids = {}
    for line in fetch_lines(url):
        if line.startswith('INSERT INTO "tb_inventario"'):
            match = re.search(r'VALUES \((.*)\);', line)
            if match:
                parts = re.findall(r"'[^']*'|[^,]+", match.group(1))
                vals = [v.strip(" '") for v in parts]
                if len(vals) >= 6:
                    eid, codbdgel = vals[0], vals[1]
                    if ine_code and codbdgel.startswith(ine_code):
                        matched_eids[eid] = codbdgel
                        print(f"  → matched entity {eid!r} with codbdgel={codbdgel!r} (ends_AA000={codbdgel.endswith('AA000')})")

    return palma_city_id, matched_eids

def main():
    conn = connect_db()
    db_cities = get_all_cities(conn)
    conn.close()

    palma_city_id, matched_eids = get_entity_ids_for_palma(conn, db_cities)

    print(f"\nAll entity IDs matching Palma's INE prefix: {list(matched_eids.keys())}")

    # Now fetch functional lines for ALL matched entity IDs
    url_func = f"{BASE_URL}/{YEAR}/{TTYPE}/tb_funcional.sql.gz"
    rows_by_eid = {eid: [] for eid in matched_eids}

    for line in fetch_lines(url_func):
        if line.startswith('INSERT INTO "tb_funcional"'):
            match = re.search(r'VALUES \((.*)\);', line)
            if match:
                parts = re.findall(r"'[^']*'|[^,]+", match.group(1))
                vals = [v.strip(" '") for v in parts]
                if len(vals) >= 5:
                    eid = vals[1]
                    if eid in matched_eids:
                        code = vals[3]
                        amount = vals[4]
                        rows_by_eid[eid].append((code, amount))

    print("\n=== Rows per entity ===")
    all_rows = []
    for eid, rows in rows_by_eid.items():
        print(f"\n  Entity {eid!r} (codbdgel={matched_eids[eid]!r}): {len(rows)} rows")
        codes = [r[0] for r in rows]
        dupes = [code for code, cnt in Counter(codes).items() if cnt > 1]
        if dupes:
            print(f"    ⚠️  Duplicate codes within this entity: {dupes}")
        all_rows.extend(rows)

    # Check for code 17 specifically
    code17_rows = [(eid, r) for eid, rows in rows_by_eid.items() for r in rows if r[0] == '17']
    if code17_rows:
        print(f"\n=== All rows with code '17' ===")
        for eid, (code, amount) in code17_rows:
            print(f"  entity={eid!r}, code={code!r}, amount={amount!r}")

    # Check if multi-row INSERT issue: look for lines with multiple VALUES
    print("\n=== Checking INSERT format (multi-row?) ===")
    count_single, count_multi = 0, 0
    for line in fetch_lines(url_func):
        if line.startswith('INSERT INTO "tb_funcional"'):
            n_values = line.count("VALUES (") + line.count("),(")
            if n_values > 1:
                count_multi += 1
            else:
                count_single += 1
    print(f"  Single-row INSERTs: {count_single}")
    print(f"  Multi-row INSERTs:  {count_multi}")

if __name__ == "__main__":
    main()
