import json
import gzip
import re
import requests
import pandas as pd
import argparse
from typing import Dict
from io import BytesIO

# 1. Configuration
SPAIN_DATA_PATH = "data/spain_data.json"
BASE_URL = "https://raw.githubusercontent.com/PopulateTools/gobierto-budgets-data/master/data/presupuestos_municipales"
TYPES = ['planned', 'executed']

def get_target_cities():
    with open(SPAIN_DATA_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return {name: info["ine_code"] for name, info in data.items() if "ine_code" in info}

def fetch_gzipped_lines(url):
    print(f"  Fetching {url}... ", end="", flush=True)
    try:
        r = requests.get(url, stream=True, timeout=15)
        if r.status_code != 200:
            print(f"FAILED ({r.status_code})")
            return []
        print("OK")
        content = BytesIO(r.content)
        with gzip.GzipFile(fileobj=content) as f:
            for line in f:
                yield line.decode('utf-8', errors='replace')
    except Exception as e:
        print(f"FAILED ({e})")
        return []

def get_id_mapping(year: int, ttype: str, target_ine_codes: Dict[str, str]) -> Dict[str, str]:
    url = f"{BASE_URL}/{year}/{ttype}/tb_inventario.sql.gz"
    mapping = {}
    for line in fetch_gzipped_lines(url):
        if line.startswith('INSERT INTO "tb_inventario"'):
            match = re.search(r'VALUES \((.*)\);', line)
            if match:
                parts = re.findall(r"'[^']*'|[^,]+", match.group(1))
                vals = [v.strip(" '") for v in parts]
                if len(vals) >= 6:
                    eid = vals[0]
                    codbdgel = vals[1]
                    for cname, ine in target_ine_codes.items():
                        if codbdgel.startswith(ine) and codbdgel.endswith("AA000"):
                            mapping[eid] = cname
    return mapping

def extract_budgets_for_year(year: int):
    target_cities = get_target_cities()
    rows = []
    
    for ttype in TYPES:
        print(f"\n--- Processing {year} {ttype} ---")
        id_to_city = get_id_mapping(year, ttype, target_cities)
        if not id_to_city:
            print(f"No target cities found in inventory for {year} {ttype}.")
            continue
            
        # Economic
        url_econ = f"{BASE_URL}/{year}/{ttype}/tb_economica.sql.gz"
        for line in fetch_gzipped_lines(url_econ):
            if line.startswith('INSERT INTO "tb_economica"'):
                match = re.search(r'VALUES \((.*)\);', line)
                if match:
                    parts = re.findall(r"'[^']*'|[^,]+", match.group(1))
                    vals = [v.strip(" '") for v in parts]
                    ciente = vals[1]
                    if ciente in id_to_city:
                        rows.append({
                            "year": year,
                            "type": ttype,
                            "city": id_to_city[ciente],
                            "classification": "economic",
                            "tipreig": vals[2], # I/G
                            "code": vals[3],
                            "amount": float(vals[4]) if vals[4] else 0.0
                        })
                        
        # Funcional (Only Expenses G)
        url_func = f"{BASE_URL}/{year}/{ttype}/tb_funcional.sql.gz"
        for line in fetch_gzipped_lines(url_func):
            if line.startswith('INSERT INTO "tb_funcional"'):
                match = re.search(r'VALUES \((.*)\);', line)
                if match:
                    parts = re.findall(r"'[^']*'|[^,]+", match.group(1))
                    vals = [v.strip(" '") for v in parts]
                    ciente = vals[1]
                    if ciente in id_to_city:
                        rows.append({
                            "year": year,
                            "type": ttype,
                            "city": id_to_city[ciente],
                            "classification": "functional",
                            "tipreig": "G",
                            "code": vals[3],
                            "amount": float(vals[4]) if vals[4] else 0.0
                        })
                        
    if rows:
        df = pd.DataFrame(rows)
        return df
    return pd.DataFrame()

def main():
    parser = argparse.ArgumentParser(description="Extract municipal budgets from Gobierto Github Repo.")
    parser.add_argument('--year', type=int, help="Extract for a specific year (e.g. 2023)")
    parser.add_argument('--all', action='store_true', help="Extract for all years (2010-2023)")
    
    args = parser.parse_args()
    
    if args.year:
        print(f"Extracting data for {args.year}...")
        df = extract_budgets_for_year(args.year)
        if not df.empty:
            output_path = f"data/municipal_budgets_{args.year}.csv"
            df.to_csv(output_path, index=False)
            print(f"\n✅ Created dataset at {output_path} with {len(df)} rows!")
        else:
            print(f"\n❌ No data extracted for {args.year}")
            
    elif args.all:
        all_dfs = []
        for year in range(2010, 2024):
            df = extract_budgets_for_year(year)
            if not df.empty:
                all_dfs.append(df)
        
        if all_dfs:
            final_df = pd.concat(all_dfs, ignore_index=True)
            output_path = "data/municipal_budgets_2010_2023.csv"
            final_df.to_csv(output_path, index=False)
            print(f"\n✅ Created aggregated dataset at {output_path} with {len(final_df)} rows!")
        else:
            print("\n❌ No data extracted for any year.")
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
