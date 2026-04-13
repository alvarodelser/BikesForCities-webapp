"""
02_load_wikidata.py
Fetches population, website, and an entire deduplicated timeline of historic mayors.
"""
import sys
import requests
from pathlib import Path
from dotenv import load_dotenv
import pandas as pd
from SPARQLWrapper import SPARQLWrapper, JSON

# Add project root to python path to import backend
sys.path.append(str(Path(__file__).resolve().parents[1]))

from backend.database.db_io import connect_db, get_all_cities, update_city_wikidata, put_historical_mayors, upsert_ingestion_status

def query_wikidata(sparql_query):
    sparql = SPARQLWrapper("https://query.wikidata.org/sparql")
    sparql.setQuery(sparql_query)
    sparql.setReturnFormat(JSON)
    results = sparql.query().convert()
    
    parsed_results = []
    for result in results.get("results", {}).get("bindings", []):
        row = {}
        for key in result:
            row[key] = result[key]["value"]
        parsed_results.append(row)
        
    if not parsed_results: return pd.DataFrame()
    return pd.DataFrame(parsed_results)


def get_city_basics(wikidata_id: str):
    query = f"""
    SELECT ?population ?website WHERE {{
      wd:{wikidata_id} wdt:P31/wdt:P279* wd:Q2074737. 
      OPTIONAL {{ wd:{wikidata_id} wdt:P1082 ?population. }}
      OPTIONAL {{ wd:{wikidata_id} wdt:P856 ?website. }}
    }} LIMIT 1
    """
    try:
        url = "https://query.wikidata.org/sparql"
        headers = { "Accept": "application/json", "User-Agent": "BikesForCities/1.0" }
        response = requests.get(url, params={'query': query}, headers=headers)
        response.raise_for_status()
        bindings = response.json().get("results", {}).get("bindings", [])
        if not bindings: return None
        result = bindings[0]
        pop_str = result.get("population", {}).get("value")
        
        return {
            "population": int(pop_str) if pop_str else None,
            "website": result.get("website", {}).get("value")
        }
    except Exception as e:
        print(f"Error fetching basics: {e}")
        return None


def get_historical_mayors(wikidata_id: str):
    query = f"""
    SELECT ?mayorLabel ?start ?end ?partyLabel ?partyStart ?partyEnd WHERE {{
      wd:{wikidata_id} wdt:P1313 ?position .
      ?mayor p:P39 ?statement .
      ?statement ps:P39 ?position .
      
      OPTIONAL {{ ?statement pq:P580 ?start . }}
      OPTIONAL {{ ?statement pq:P582 ?end . }}
      
      OPTIONAL {{
        ?mayor p:P102 ?partyStmt .
        ?partyStmt ps:P102 ?party .
        OPTIONAL {{ ?partyStmt pq:P580 ?partyStart . }}
        OPTIONAL {{ ?partyStmt pq:P582 ?partyEnd . }}
      }}
      SERVICE wikibase:label {{ bd:serviceParam wikibase:language "es". }}
    }} ORDER BY DESC(?start)
    """
    df = query_wikidata(query)
    if df.empty:
        return df
        
    for col in ['start', 'end', 'partyStart', 'partyEnd']:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors='coerce').dt.tz_localize(None)

    future = pd.Timestamp('2100-01-01')
    past = pd.Timestamp('1800-01-01')
    
    if 'end' in df.columns: df['end'] = df['end'].fillna(future)
    if 'partyEnd' in df.columns: df['partyEnd'] = df['partyEnd'].fillna(future)
    if 'start' in df.columns: df['start'] = df['start'].fillna(past)
    if 'partyStart' in df.columns: df['partyStart'] = df['partyStart'].fillna(past)

    if 'partyStart' in df.columns and 'partyEnd' in df.columns:
        valid_party = (df['partyStart'] <= df['start']) & (df['partyEnd'] >= df['start'])
        no_party = df.get('partyLabel', pd.Series(dtype=object)).isna()
        df = df[valid_party | no_party]

    cols_to_group = ['mayorLabel', 'start', 'end']
    available_cols = [c for c in cols_to_group if c in df.columns]
    df = df.groupby(available_cols, dropna=False).first().reset_index()
    
    if 'start' in df.columns: df['start'] = df['start'].replace(past, pd.NaT)
    if 'end' in df.columns: df['end'] = df['end'].replace(future, pd.NaT)
    if 'start' in df.columns: df = df.sort_values(by='start', ascending=False)
        
    return df


def main():
    load_dotenv()
    
    try:
        conn = connect_db()
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        return
        
    cities = get_all_cities(conn)
    
    if not cities:
        print("❌ No cities found in database. Run 01_load_cities.py first.")
        conn.commit()
        conn.close()
        return
        
    print(f"🔍 Starting Wikidata ingestion for {len(cities)} cities...\n")
    
    updated_count = 0
    
    for city_row in cities:
        city_id, city_name, _, wikidata_id, *rest = city_row
        
        if not wikidata_id:
            print(f"⏭️  Skipping '{city_name}' (No wikidata_id in DB)")
            continue
            
        upsert_ingestion_status(conn, city_id, "wikidata population website and mayors", "RUNNING")
        try:
            print(f"▶️  Fetching data for '{city_name}' ({wikidata_id})...")
            basics = get_city_basics(wikidata_id)
            df_mayors = get_historical_mayors(wikidata_id)
            
            mayor_current = None
            party_current = None
            
            # Populate current mayor into main cities table if history exists
            if not df_mayors.empty:
                current_row = df_mayors.iloc[0]
                mayor_current = current_row.get('mayorLabel')
                party_current = current_row.get('partyLabel') if 'partyLabel' in current_row else None
                
                # Insert full history to historical_mayors
                put_historical_mayors(conn, city_id, df_mayors)
            
            if basics:
                update_city_wikidata(
                    conn, 
                    city_id=city_id,
                    population=basics.get("population"),
                    website=basics.get("website"),
                    mayor=mayor_current,
                    mayor_party=party_current
                )
                
                w_str = (basics['website'][:30] + '...') if basics['website'] and len(basics['website']) > 30 else basics['website']
                pop_str = f"{basics['population']:,}" if basics['population'] else 'None'
                
                print(f"  ✔ Pop: {pop_str} | Website: {w_str}")
                print(f"  ✔ Current Mayor: {mayor_current} ({party_current}) | Loaded {len(df_mayors)} historical records.")
                updated_count += 1
                upsert_ingestion_status(conn, city_id, "wikidata population website and mayors", "SUCCESS")
            else:
                print(f"  ❌ No matching Wikidata municipality entry found for {wikidata_id}.")
                upsert_ingestion_status(conn, city_id, "wikidata population website and mayors", "FAILED")
        except Exception as e:
            upsert_ingestion_status(conn, city_id, "wikidata population website and mayors", "FAILED")
            print(f"  ❌ Error fetching Wikidata for {city_name}: {e}")
            
    print(f"\n🏁 Finished updating {updated_count} cities with Wikidata info.")
    conn.commit()
    conn.close()

if __name__ == "__main__":
    main()
