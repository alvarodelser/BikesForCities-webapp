"""
013_load_budgets.py
Downloads municipal budget data from the Gobierto Budgets Data repository,
extracts functional expenses for target cities, and loads them into the database.
"""
import sys
import os
import argparse
import gzip
import re
import requests
import json
import pandas as pd
from io import BytesIO
from pathlib import Path
from dotenv import load_dotenv

sys.path.append(str(Path(__file__).resolve().parents[2]))
from backend.database.db_io import (
    connect_db, get_all_cities, put_city_budgets, put_city_budget_lines,
    upsert_ingestion_status, get_ingestion_status, check_prerequisites
)

# Configuration
BASE_URL = "https://raw.githubusercontent.com/PopulateTools/gobierto-budgets-data/master/data/presupuestos_municipales"
TYPES = ['planned', 'executed']
DEFAULT_YEAR = 2023

def fetch_gzipped_lines(url):
    try:
        r = requests.get(url, stream=True, timeout=15)
        if r.status_code != 200:
            return []
        content = BytesIO(r.content)
        with gzip.GzipFile(fileobj=content) as f:
            for line in f:
                yield line.decode('utf-8', errors='replace')
    except Exception:
        return []

def get_mapping_dict(year, ttype, table_name, id_col, name_col):
    """Fetches a classification dictionary (e.g. functional programs)."""
    url = f"{BASE_URL}/{year}/{ttype}/{table_name}.sql.gz"
    mapping = {}
    for line in fetch_gzipped_lines(url):
        if line.startswith(f'INSERT INTO "{table_name}"'):
            match = re.search(r'VALUES \((.*)\);', line)
            if match:
                parts = re.findall(r"'[^']*'|[^,]+", match.group(1))
                vals = [v.strip(" '") for v in parts]
                if len(vals) >= max(id_col, name_col) + 1:
                    mapping[vals[id_col]] = vals[name_col]
    return mapping

def get_entity_id_to_city_id_map(conn, year, ttype, db_cities):
    """Maps Gobierto Entity IDs to our internal City IDs using INE codes."""
    url = f"{BASE_URL}/{year}/{ttype}/tb_inventario.sql.gz"
    
    # Map INE code -> city_id from our database
    # Assuming Spain INE codes are stored in city description or we need to match by name
    # For now, we'll use a hardcoded map or try to match names if available.
    # PRO TIP: The 'spain_data.json' has the ine_codes.
    
    spain_data_path = Path(__file__).resolve().parents[2] / "data" / "spain_data.json"
    with open(spain_data_path, 'r', encoding='utf-8') as f:
        spain_data = json.load(f)
    
    ine_to_cid = {}
    for city_name, info in spain_data.items():
        if "ine_code" in info:
            cid = next((c[0] for c in db_cities if c[1] == city_name), None)
            if cid:
                ine_to_cid[info["ine_code"]] = cid

    entity_to_cid = {}
    for line in fetch_gzipped_lines(url):
        if line.startswith('INSERT INTO "tb_inventario"'):
            match = re.search(r'VALUES \((.*)\);', line)
            if match:
                parts = re.findall(r"'[^']*'|[^,]+", match.group(1))
                vals = [v.strip(" '") for v in parts]
                if len(vals) >= 6:
                    eid = vals[0]
                    codbdgel = vals[1] # This contains the INE code at the start
                    for ine, cid in ine_to_cid.items():
                        if codbdgel.startswith(ine) and codbdgel.endswith("AA000"):
                            entity_to_cid[eid] = cid
    return entity_to_cid

def process_year(conn, year, db_cities):
    print(f"\n📅 Processing budgets for {year}...")
    
    for ttype in TYPES:
        status_key = f"013_load_budgets_{ttype}"
        
        # 1. Get mappings
        print(f"  🔍 Fetching functional mapping for {year} {ttype}...")
        func_map = get_mapping_dict(year, ttype, 'tb_cuentasProgramas', 0, 1)
        if not func_map:
            print(f"  ⚠️ Could not fetch functional mapping for {year} {ttype}. Skipping.")
            continue

        # 2. Map entities
        id_to_cid = get_entity_id_to_city_id_map(conn, year, ttype, db_cities)
        if not id_to_cid:
            print(f"  ⚠️ No target cities found in inventory for {year} {ttype}.")
            continue

        # 3. Fetch budget lines
        print(f"  📥 Fetching functional budget lines for {year} {ttype}...")
        url_func = f"{BASE_URL}/{year}/{ttype}/tb_funcional.sql.gz"
        
        city_rows = {cid: [] for cid in id_to_cid.values()}
        
        for line in fetch_gzipped_lines(url_func):
            if line.startswith('INSERT INTO "tb_funcional"'):
                match = re.search(r'VALUES \((.*)\);', line)
                if match:
                    parts = re.findall(r"'[^']*'|[^,]+", match.group(1))
                    vals = [v.strip(" '") for v in parts]
                    eid = vals[1]
                    if eid in id_to_cid:
                        cid = id_to_cid[eid]
                        code = vals[3]
                        amount = float(vals[4]) if vals[4] else 0.0
                        city_rows[cid].append({
                            "category_code": code,
                            "category_name": func_map.get(code, "Unknown"),
                            "amount": amount
                        })

        # 4. Save to DB per city
        for cid, rows in city_rows.items():
            if not rows: continue
            
            city_name = next(c[1] for c in db_cities if c[0] == cid)
            upsert_ingestion_status(conn, status_key, "RUNNING", city_id=cid, time_period=str(year))
            
            print(f"  💾 Loading {len(rows)} functional lines for {city_name} ({ttype})...")
            
            # Update summary (total expenses for this year/type)
            # We use 'planned' for the main summary if available
            if ttype == 'planned':
                total_exp = sum(r['amount'] for r in rows if len(str(r['category_code'])) == 1)
                put_city_budgets(conn, cid, year, total_expenses=total_exp)
            
            # Load detailed lines
            df_lines = pd.DataFrame(rows)
            put_city_budget_lines(conn, cid, year, ttype, df_lines)
            
            upsert_ingestion_status(conn, status_key, "SUCCESS", city_id=cid, time_period=str(year))

def main():
    parser = argparse.ArgumentParser(description="Ingest Municipal Budget Data")
    parser.add_argument("--year", type=int, default=DEFAULT_YEAR, help="Year to ingest (default 2023)")
    parser.add_argument("--all", action="store_true", help="Ingest all years 2010-2023")
    parser.add_argument("--force", action="store_true", help="Force re-ingestion")
    args = parser.parse_args()

    load_dotenv()
    conn = connect_db()
    
    db_cities = get_all_cities(conn)
    if not db_cities:
        print("❌ No cities found in database.")
        return

    years = range(2010, 2024) if args.all else [args.year]
    
    try:
        for year in years:
            process_year(conn, year, db_cities)
        print("\n🏁 Budget ingestion complete.")
    except Exception as e:
        print(f"❌ Error during budget ingestion: {e}")
        import traceback
        traceback.print_exc()
    finally:
        conn.commit()
        conn.close()

if __name__ == "__main__":
    main()
