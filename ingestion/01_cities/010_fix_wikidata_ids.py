"""
Fix corrupted wikidata_id values in cities table.
Replaces slug-based wikidata_ids with actual Wikidata Q-numbers from spain_data.json
"""
import json
import sys
from pathlib import Path
from dotenv import load_dotenv

sys.path.append(str(Path(__file__).resolve().parents[2]))
from backend.database.db_io import connect_db

SPAIN_DATA_PATH = Path(__file__).resolve().parents[2] / "data" / "spain_data.json"

def main():
    if not SPAIN_DATA_PATH.exists():
        print(f"❌ Error: Could not find {SPAIN_DATA_PATH}")
        return

    with open(SPAIN_DATA_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)

    conn = connect_db()
    fixed_count = 0

    with conn.cursor() as cur:
        for city_key, city_info in data.items():
            correct_wikidata_id = city_info.get("wikidata_id")
            slug = city_info.get("slug")

            if not correct_wikidata_id or not slug:
                continue

            # Check if the city has a bad wikidata_id (slug instead of Q-number)
            cur.execute("SELECT id, wikidata_id FROM cities WHERE slug = %s", (slug,))
            row = cur.fetchone()

            if row:
                city_id, current_wikidata = row
                if current_wikidata != correct_wikidata_id:
                    # Fix it
                    cur.execute(
                        "UPDATE cities SET wikidata_id = %s WHERE id = %s",
                        (correct_wikidata_id, city_id)
                    )
                    print(f"✅ Fixed {city_info['name']}: {current_wikidata} → {correct_wikidata_id}")
                    fixed_count += 1
                else:
                    print(f"⏭️  {city_info['name']} already has correct wikidata_id")
            else:
                print(f"⚠️  City {slug} not found in database")

    print(f"\n🏁 Fixed {fixed_count} cities with correct Wikidata IDs")
    conn.commit()
    conn.close()

if __name__ == "__main__":
    main()
