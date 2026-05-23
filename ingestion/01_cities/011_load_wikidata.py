"""
011_load_wikidata.py
Fetches population, website, and a deduplicated timeline of historic mayors.
Uses QLever (wikidata mirror) — faster and no per-minute rate limits.
All cities are batched into two queries (basics + mayors) instead of N×2.
"""
import sys
import argparse
import requests
import time
from pathlib import Path
from dotenv import load_dotenv
import pandas as pd

sys.path.append(str(Path(__file__).resolve().parents[2]))

from backend.database.db_io import (
    connect_db, get_all_cities, update_city_wikidata,
    put_historical_mayors, upsert_ingestion_status,
    get_ingestion_status, check_prerequisites,
)

QLEVER_ENDPOINT = "https://qlever.cs.uni-freiburg.de/api/wikidata"
_HEADERS = {
    "Accept": "application/sparql-results+json",
    "User-Agent": "BikesForCities/1.0",
}
# QLever does not pre-define Wikidata prefixes — must declare them in every query.
_PREFIXES = """
PREFIX wd:  <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX p:   <http://www.wikidata.org/prop/>
PREFIX ps:  <http://www.wikidata.org/prop/statement/>
PREFIX pq:  <http://www.wikidata.org/prop/qualifier/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
"""


def run_sparql(query: str) -> pd.DataFrame:
    for attempt in range(3):
        try:
            resp = requests.get(
                QLEVER_ENDPOINT, params={"query": query},
                headers=_HEADERS, timeout=120,
            )
            if resp.status_code == 429:
                wait = 30 * (2 ** attempt)
                print(f"  ⏳ Rate limited. Retrying in {wait}s...")
                time.sleep(wait)
                continue
            resp.raise_for_status()
            bindings = resp.json().get("results", {}).get("bindings", [])
            if not bindings:
                return pd.DataFrame()
            return pd.DataFrame([{k: v["value"] for k, v in row.items()} for row in bindings])
        except Exception as e:
            if attempt == 2:
                raise
            wait = 30 * (2 ** attempt)
            print(f"  ⏳ Query failed ({e}), retrying in {wait}s...")
            time.sleep(wait)


def _qid(uri: str) -> str:
    """Extract Q-identifier from a Wikidata entity URI."""
    return uri.rsplit("/", 1)[-1]


def fetch_basics(wikidata_ids: list) -> dict:
    """Return {qid: {population, website}} for all requested cities in one query."""
    values = " ".join(f"wd:{qid}" for qid in wikidata_ids)
    query = _PREFIXES + f"""
    SELECT ?city ?population ?website WHERE {{
      VALUES ?city {{ {values} }}
      OPTIONAL {{ ?city wdt:P1082 ?population. }}
      OPTIONAL {{ ?city wdt:P856 ?website. }}
    }}
    """
    df = run_sparql(query)
    if df.empty:
        return {}

    df["qid"] = df["city"].map(_qid)
    result = {}
    for qid, group in df.groupby("qid"):
        row = group.iloc[0]
        pop_raw = row.get("population") if "population" in row else None
        try:
            population = int(float(pop_raw)) if pop_raw and pd.notna(pop_raw) else None
        except (ValueError, TypeError):
            population = None
        result[qid] = {
            "population": population,
            "website": row.get("website") if "website" in row else None,
        }
    return result


def fetch_mayors(wikidata_ids: list) -> dict:
    """Return {qid: DataFrame} of deduplicated mayor history for all cities in one query."""
    values = " ".join(f"wd:{qid}" for qid in wikidata_ids)
    # QLever does not support SERVICE wikibase:label — use rdfs:label with FILTER instead.
    query = _PREFIXES + f"""
    SELECT ?city ?mayorLabel ?start ?end ?partyLabel ?partyStart ?partyEnd WHERE {{
      VALUES ?city {{ {values} }}
      ?city wdt:P1313 ?position .
      ?mayor p:P39 ?statement .
      ?statement ps:P39 ?position .
      OPTIONAL {{ ?statement pq:P580 ?start . }}
      OPTIONAL {{ ?statement pq:P582 ?end . }}
      OPTIONAL {{
        ?mayor p:P102 ?partyStmt .
        ?partyStmt ps:P102 ?party .
        OPTIONAL {{ ?partyStmt pq:P580 ?partyStart . }}
        OPTIONAL {{ ?partyStmt pq:P582 ?partyEnd . }}
        OPTIONAL {{ ?party rdfs:label ?partyLabel. FILTER(LANG(?partyLabel) = "es") }}
      }}
      OPTIONAL {{ ?mayor rdfs:label ?mayorLabel. FILTER(LANG(?mayorLabel) = "es") }}
    }} ORDER BY DESC(?start)
    """
    df = run_sparql(query)
    if df.empty:
        return {}

    df["qid"] = df["city"].map(_qid)

    future = pd.Timestamp("2100-01-01")
    past = pd.Timestamp("1800-01-01")

    for col in ["start", "end", "partyStart", "partyEnd"]:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors="coerce").dt.tz_localize(None)

    if "end" in df.columns:        df["end"]       = df["end"].fillna(future)
    if "partyEnd" in df.columns:   df["partyEnd"]  = df["partyEnd"].fillna(future)
    if "start" in df.columns:      df["start"]     = df["start"].fillna(past)
    if "partyStart" in df.columns: df["partyStart"]= df["partyStart"].fillna(past)

    if "partyStart" in df.columns and "partyEnd" in df.columns:
        valid_party = (df["partyStart"] <= df["start"]) & (df["partyEnd"] >= df["start"])
        no_party = df.get("partyLabel", pd.Series(dtype=object)).isna()
        df = df[valid_party | no_party]

    result = {}
    for qid, group in df.groupby("qid"):
        group = group.drop(columns=["qid", "city"], errors="ignore")
        cols_to_group = [c for c in ["mayorLabel", "start", "end"] if c in group.columns]
        city_df = group.groupby(cols_to_group, dropna=False).first().reset_index()
        if "start" in city_df.columns: city_df["start"] = city_df["start"].replace(past, pd.NaT)
        if "end" in city_df.columns:   city_df["end"]   = city_df["end"].replace(future, pd.NaT)
        if "start" in city_df.columns: city_df = city_df.sort_values("start", ascending=False)
        result[qid] = city_df

    return result


def main():
    parser = argparse.ArgumentParser(description="Ingest Wikidata population, website and mayors")
    parser.add_argument("--force", action="store_true", help="Force re-ingestion even if already SUCCESS")
    args = parser.parse_args()

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

    cities_to_process = []
    for city_row in cities:
        city_id, city_name, city_alt_name, city_slug, city_description, wikidata_id, *rest = city_row

        if not wikidata_id:
            print(f"⏭️  Skipping '{city_name}' (No wikidata_id in DB)")
            continue

        missing = check_prerequisites(conn, ["010_load_cities"], city_id=city_id)
        if missing:
            print(f"⚠️  Skipping '{city_name}': prerequisites not met: {missing}")
            continue

        status_obj = get_ingestion_status(conn, "011_load_wikidata", city_id=city_id)
        if status_obj and status_obj.get("status") == "SUCCESS" and not args.force:
            print(f"⏭️  Skipping '{city_name}': already ingested. Use --force to override.")
            continue

        upsert_ingestion_status(conn, "011_load_wikidata", "RUNNING", city_id=city_id)
        cities_to_process.append((city_id, city_name, wikidata_id))

    if not cities_to_process:
        print("Nothing to do.")
        conn.commit()
        conn.close()
        return

    wikidata_ids = [qid for _, _, qid in cities_to_process]
    print(f"📡 Fetching basics for {len(wikidata_ids)} cities...")
    basics_map = fetch_basics(wikidata_ids)
    print(f"📡 Fetching mayor histories for {len(wikidata_ids)} cities...")
    mayors_map = fetch_mayors(wikidata_ids)

    updated_count = 0
    for city_id, city_name, wikidata_id in cities_to_process:
        try:
            basics = basics_map.get(wikidata_id)
            df_mayors = mayors_map.get(wikidata_id, pd.DataFrame())

            mayor_current = None
            party_current = None

            if not df_mayors.empty:
                current_row = df_mayors.iloc[0]
                mayor_current = current_row.get("mayorLabel")
                party_current = current_row.get("partyLabel") if "partyLabel" in current_row else None
                put_historical_mayors(conn, city_id, df_mayors)

            if basics:
                update_city_wikidata(
                    conn,
                    city_id=city_id,
                    population=basics.get("population"),
                    website=basics.get("website"),
                    mayor=mayor_current,
                    mayor_party=party_current,
                )
                w_str = (basics["website"][:30] + "...") if basics["website"] and len(basics["website"]) > 30 else basics["website"]
                pop_str = f"{basics['population']:,}" if basics["population"] else "None"
                print(f"  ✔ {city_name}: Pop: {pop_str} | Web: {w_str}")
                print(f"       Mayor: {mayor_current} ({party_current}) | {len(df_mayors)} historical records.")
                updated_count += 1
                upsert_ingestion_status(conn, "011_load_wikidata", "SUCCESS", city_id=city_id)
            else:
                print(f"  ❌ {city_name}: No data found for {wikidata_id}.")
                upsert_ingestion_status(conn, "011_load_wikidata", "FAILED", city_id=city_id)
        except Exception as e:
            upsert_ingestion_status(conn, "011_load_wikidata", "FAILED", city_id=city_id)
            print(f"  ❌ Error processing {city_name}: {e}")

    print(f"\n🏁 Finished updating {updated_count} cities with Wikidata info.")
    conn.commit()
    conn.close()


if __name__ == "__main__":
    main()
