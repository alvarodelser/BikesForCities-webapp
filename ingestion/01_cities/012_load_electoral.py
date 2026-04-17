"""
06_load_electoral.py
Downloads the latest municipal electoral data from the Spanish Ministry of Interior
and parses the fixed-width DAT files to extract parties, votes, and councilors for our cities.
"""
import sys
import os
import argparse
import requests
import zipfile
import pandas as pd
from pathlib import Path
from dotenv import load_dotenv

sys.path.append(str(Path(__file__).resolve().parents[2]))
from backend.database.db_io import connect_db, get_all_cities, put_city_elections, put_city_councilors, upsert_ingestion_status, get_ingestion_status, check_prerequisites

# Current latest election: May 2023
ELECTION_YEAR = 2023
URL = "https://infoelectoral.interior.gob.es/estaticos/docxl/apliextr/04202305_MUNI.zip"

def download_and_extract(url, extract_to):
    os.makedirs(extract_to, exist_ok=True)
    zip_path = os.path.join(extract_to, "data.zip")
    
    # Disable SSL warnings for gov sites often having cert issues
    requests.packages.urllib3.disable_warnings()

    if not os.path.exists(zip_path):
        print(f"📥 Downloading {url}...")
        r = requests.get(url, verify=False)
        r.raise_for_status()
        with open(zip_path, 'wb') as f:
            f.write(r.content)
            
    # Always extract just in case it was interrupted
    print(f"📦 Extracting zip to {extract_to}...")
    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        zip_ref.extractall(extract_to)

def parse_elections(data_dir, cities):
    """
    cities is a list of tuples: (city_id, name)
    """
    muni_file = os.path.join(data_dir, "05042305.DAT")
    party_file = os.path.join(data_dir, "03042305.DAT")
    results_file = os.path.join(data_dir, "06042305.DAT")
    
    # Check if files exist
    for f in [muni_file, party_file, results_file]:
        if not os.path.exists(f):
            raise FileNotFoundError(f"Missing required extraction file: {f}")
            
    print("🔍 Parsing municipalities (05042305.DAT)...")
    code_to_city_id = {}
    city_names_db = {name.lower(): cid for cid, name in cities}
    
    with open(muni_file, 'r', encoding='iso-8859-1') as f:
        for line in f:
            prov = line[11:13]
            muni = line[13:16]
            name = line[18:118].strip()
            # Try to match the name (e.g. Madrid, Barcelona) to our DB exactly
            if name.lower() in city_names_db:
                code_to_city_id[(prov, muni)] = city_names_db[name.lower()]

    print(f"✔ Matched {len(code_to_city_id)} target cities in the electoral dataset.")
    if not code_to_city_id:
        print("❌ No cities matched! Ensure the names in DB match exactly.")
        return []

    print("🔍 Parsing political parties (03042305.DAT)...")
    party_map = {}
    with open(party_file, 'r', encoding='iso-8859-1') as f:
        for line in f:
            code = line[8:14]
            siglas = line[14:64].strip()
            nombre = line[64:214].strip()
            # Use Siglas if available, else raw name
            party_map[code] = siglas if siglas else nombre
            
    print("🔍 Compiling electoral results (06042305.DAT)...")
    parsed_results = []
    
    with open(results_file, 'r', encoding='iso-8859-1') as f:
        for line in f:
            prov = line[9:11]      # Pos 10-11
            muni = line[11:14]     # Pos 12-14
            district = line[14:16] # Pos 15-16
            
            # We only care about municipality-level totals (district 99)
            if district != '99': continue
            
            if (prov, muni) in code_to_city_id:
                cid = code_to_city_id[(prov, muni)]
                p_code = line[16:22]
                try:
                    votos = int(line[22:30])
                    concejales = int(line[30:33])
                except ValueError:
                    continue
                
                # Only save if they got votes
                if votos >= 0:
                    party_name = party_map.get(p_code, "Unknown")
                    parsed_results.append({
                        "city_id": cid,
                        "year": ELECTION_YEAR,
                        "party": party_name,
                        "votes": votos,
                        "councilors": concejales
                    })
                    
    print("🔍 Compiling candidates (04042305.DAT)...")
    candidates_file = os.path.join(data_dir, "04042305.DAT")
    parsed_candidates = []
    
    if os.path.exists(candidates_file):
        with open(candidates_file, 'r', encoding='iso-8859-1') as f:
            for line in f:
                prov = line[9:11]
                muni = line[12:15]
                
                if (prov, muni) in code_to_city_id:
                    cid = code_to_city_id[(prov, muni)]
                    p_code = line[15:21]
                    party_name = party_map.get(p_code, "Unknown")
                    
                    nombre = line[25:50].strip()
                    apellido1 = line[50:75].strip()
                    apellido2 = line[75:100].strip()
                    
                    tail = line[100:].strip()
                    elected = tail.endswith('S') or tail.endswith('s')
                    
                    full_name = f"{nombre} {apellido1} {apellido2}".strip().title()
                    if full_name and elected:
                        parsed_candidates.append({
                            "city_id": cid,
                            "year": ELECTION_YEAR,
                            "party": party_name,
                            "name": full_name,
                            "elected": elected
                        })
                        
    return pd.DataFrame(parsed_results), pd.DataFrame(parsed_candidates)

def main():
    parser = argparse.ArgumentParser(description="Ingest Municipal Electoral Data")
    parser.add_argument("--force", action="store_true", help="Force re-ingestion of Electoral data even if already SUCCESS")
    args = parser.parse_args()

    load_dotenv()
    conn = connect_db()
    
    # We only need the id and name
    db_cities_raw = get_all_cities(conn)
    if not db_cities_raw:
        print("❌ No cities found in database.")
        return
        
    all_cities = [(r[0], r[1]) for r in db_cities_raw]
    cities_to_process = []
    
    if args.force:
        cities_to_process = all_cities
    else:
        for cid, name in all_cities:
            status_obj = get_ingestion_status(conn, "012_load_electoral", city_id=cid, time_period=str(ELECTION_YEAR))
            if not (status_obj and status_obj.get("status") == "SUCCESS"):
                cities_to_process.append((cid, name))
                
    checked = []
    for cid, name in cities_to_process:
        missing = check_prerequisites(conn, ["010_load_cities"], city_id=cid)
        if missing:
            print(f"⚠️  Skipping '{name}': prerequisites not met: {missing}")
        else:
            checked.append((cid, name))
    cities_to_process = checked

    if not cities_to_process:
        print("⏭️  Skipping electoral data: All cities already successfully ingested. Use --force to override.")
        conn.commit()
        conn.close()
        return

    try:
        data_dir = str(Path(__file__).resolve().parents[2] / "data" / "electoral_data")
        download_and_extract(URL, data_dir)
        
        print("\n▶️  Processing raw DAT files into analytical format...")
        df_results, df_candidates = parse_elections(data_dir, cities_to_process)
        
        if df_results.empty:
            print("❌ No results parsed. Exiting.")
            conn.commit()
            conn.close()
            return
            
        print(f"✔ Prepared {len(df_results)} electoral rows.")
        
        # Upsert to DB grouping by City
        city_name_map = {cid: name for cid, name in cities_to_process}
        for city_id, group in df_results.groupby('city_id'):
            city_name = city_name_map[int(city_id)]
            upsert_ingestion_status(conn, "012_load_electoral", "RUNNING", city_id=city_id, time_period=str(ELECTION_YEAR))
            print(f"  • Upserting {len(group)} parties for {city_name}...")
            put_city_elections(conn, city_id, group)
            upsert_ingestion_status(conn, "012_load_electoral", "SUCCESS", city_id=city_id, time_period=str(ELECTION_YEAR))

        if not df_candidates.empty:
            print(f"✔ Prepared {len(df_candidates)} candidates.")
            for city_id, group in df_candidates.groupby('city_id'):
                city_name = city_name_map[int(city_id)]
                print(f"  • Upserting {len(group)} candidates for {city_name}...")
                put_city_councilors(conn, city_id, group)
                
        print("\n🏁 Spanish Municipal Electoral Ingestion complete.")
    except Exception as e:
        print(f"❌ Error during electoral ingestion: {e}")
        for city_id, name in cities_to_process:
            upsert_ingestion_status(conn, "012_load_electoral", "FAILED", city_id=city_id, time_period=str(ELECTION_YEAR))
    finally:
        conn.commit()
        conn.close()

if __name__ == "__main__":
    main()
