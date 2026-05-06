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
    connect_db, get_all_cities, put_city_budgets, put_city_budget_categories,
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
        if f'INSERT INTO "{table_name}"' in line:
            tuples = re.findall(r"\(([^)]+)\)", line)
            for t in tuples:
                parts = re.findall(r"'[^']*'|[^,]+", t)
                vals = [v.strip(" '") for v in parts]
                if len(vals) >= max(id_col, name_col) + 1:
                    mapping[vals[id_col]] = vals[name_col]
    return mapping

def get_entity_id_to_city_id_map(conn, year, ttype, db_cities):
    """Maps Gobierto Entity IDs to our internal City IDs using INE codes."""
    url = f"{BASE_URL}/{year}/{ttype}/tb_inventario.sql.gz"
    
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
        if 'INSERT INTO "tb_inventario"' in line:
            tuples = re.findall(r"\(([^)]+)\)", line)
            for t in tuples:
                parts = re.findall(r"'[^']*'|[^,]+", t)
                vals = [v.strip(" '") for v in parts]
                if len(vals) >= 6:
                    eid = vals[0]
                    codbdgel = vals[1]
                    for ine, cid in ine_to_cid.items():
                        # We only take the main municipality entity (codbdgel ends with AA000)
                        if codbdgel.startswith(ine) and codbdgel.endswith("AA000"):
                            entity_to_cid[eid] = cid
    return entity_to_cid

def process_year(conn, year, db_cities):
    print(f"\n📅 Processing budgets for {year}...")
    
    for ttype in TYPES:
        status_key = f"013_load_budgets_{ttype}"
        
        print(f"  🔍 Fetching functional mapping for {year} {ttype}...")
        func_map = get_mapping_dict(year, ttype, 'tb_cuentasProgramas', 0, 1)
        if not func_map:
            print(f"  ⚠️ Could not fetch functional mapping for {year} {ttype}. Skipping.")
            continue

        id_to_cid = get_entity_id_to_city_id_map(conn, year, ttype, db_cities)
        if not id_to_cid:
            print(f"  ⚠️ No target cities found in inventory for {year} {ttype}.")
            continue

        print(f"  📥 Fetching functional budget lines for {year} {ttype}...")
        url_func = f"{BASE_URL}/{year}/{ttype}/tb_funcional.sql.gz"
        
        city_rows = {cid: [] for cid in id_to_cid.values()}
        
        for line in fetch_gzipped_lines(url_func):
            if 'INSERT INTO "tb_funcional"' in line:
                # Find all tuples (...) in the line. Gobierto dumps use multi-row inserts.
                tuples = re.findall(r"\(([^)]+)\)", line)
                for t in tuples:
                    parts = re.findall(r"'[^']*'|[^,]+", t)
                    vals = [v.strip(" '") for v in parts]
                    if len(vals) >= 5:
                        eid = vals[1]
                        if eid in id_to_cid:
                            cid = id_to_cid[eid]
                            code = vals[3]
                            try:
                                amount_str = vals[4].lower()
                                amount = float(amount_str) if amount_str != 'null' else 0.0
                            except (ValueError, IndexError):
                                amount = 0.0
                            
                            city_rows[cid].append({
                                "category_code": str(code),
                                "category_name": func_map.get(code, "Unknown"),
                                "amount": amount
                            })

        for cid, rows in city_rows.items():
            if not rows: continue
            
            city_name = next(c[1] for c in db_cities if c[0] == cid)
            upsert_ingestion_status(conn, status_key, "RUNNING", city_id=cid, time_period=str(year))
            
            # Aggregate: sum amounts for same code (some cities have multiple rows per code in raw data)
            df_lines = pd.DataFrame(rows)
            df_lines = (
                df_lines.groupby('category_code', as_index=False)
                .agg(category_name=('category_name', 'first'), amount=('amount', 'sum'))
            )
            
            # Total expenses: sum of 1-digit functional codes
            total_exp = float(df_lines[df_lines['category_code'].str.len() == 1]['amount'].sum())
            print(f"  💾 Loading {len(df_lines)} aggregated lines for {city_name} ({ttype}). Total: {total_exp:,.0f}€")

            # Convert numpy types to Python types for SQL
            df_lines['amount'] = df_lines['amount'].astype(int)

            put_city_budgets(conn, cid, year, budget_type=ttype, total_expenses=int(total_exp))
            put_city_budget_categories(conn, cid, year, ttype, df_lines)
            
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
