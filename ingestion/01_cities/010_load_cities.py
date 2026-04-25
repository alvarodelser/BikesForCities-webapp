"""
01_load_cities.py
Reads spain_data.json, skips cities without modes, and loads them into the DB.
"""
import json
import sys
from pathlib import Path
from dotenv import load_dotenv

# Add project root to python path to import backend
sys.path.append(str(Path(__file__).resolve().parents[2]))

from backend.database.db_io import connect_db, get_or_create_city, put_city_modes, upsert_ingestion_status

load_dotenv()

SPAIN_DATA_PATH = Path(__file__).resolve().parents[2] / "data" / "spain_data.json"

def main():
    if not SPAIN_DATA_PATH.exists():
        print(f"❌ Error: Could not find {SPAIN_DATA_PATH}")
        return

    with open(SPAIN_DATA_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    conn = connect_db()
    
    loaded_count = 0
    skipped_count = 0
    
    for city_key, city_info in data.items():
        modes_list = city_info.get("modes", [])
        
        # Insert or update city
        city_id = get_or_create_city(
            conn,
            name=city_info["name"],
            center_lat=city_info.get("latitude"),
            center_lon=city_info.get("longitude"),
            angle=city_info.get("angle", 0.0),
            radius=20000, # default distance
            wikidata_id=city_info.get("wikidata_id")
        )
        
        # Reset all modes to False at the beginning of ingestion
        # Modes will be dynamically refreshed by their respective ingestion processes
        modes_dict = {
            "infrastructure": False,
            "traffic": False,
            "accidents": False,
            "topography": False,
            "intersections": False,
            "stations": False,
            "forum": False
        }
        
        put_city_modes(conn, city_id, modes_dict)
        upsert_ingestion_status(conn, "010_load_cities", "SUCCESS", city_id=city_id)
        print(f"✅ Loaded {city_key} (ID: {city_id}, WD: {city_info.get('wikidata_id', 'None')})")
        loaded_count += 1
        
    print(f"\n🏁 Finished loading cities. {loaded_count} loaded, {skipped_count} skipped.")
    conn.commit()
    conn.close()

if __name__ == "__main__":
    main()
