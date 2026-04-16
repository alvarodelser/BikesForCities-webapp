"""
040_load_madrid_trips.py
Unified script to download historical BiciMAD trips and ingest them into the DB.

Combines:
  1. Automated download of 2017-2023 historical ZIPs from datos.madrid.es.
  2. Recursive extraction (Zip-in-Zip) and conversion of JSON/CSV trips to CSV.
  3. Ingestion into the 'routes' table.
"""

from __future__ import annotations

import argparse
import ast
import io
import json
import re
import sys
import zipfile
from pathlib import Path
from typing import Optional

import pandas as pd
import requests
from dotenv import load_dotenv
from tqdm import tqdm

sys.path.append(str(Path(__file__).resolve().parents[2]))

from backend.database.db_io import (
    connect_db,
    get_or_create_city,
    upsert_ingestion_status,
    get_ingestion_status,
)
from backend.processing.trip_loader import list_trip_csvs

BATCH_SIZE = 5_000

# ---------------------------------------------------------------------------
# Dataset URLs (historical 2017–2023)
# ---------------------------------------------------------------------------

HISTORICAL_URLS: dict[int, str] = {
    2017: "https://datos.madrid.es/dataset/900034-0-bicimad-viajes-estaciones/resource/900034-3-bicimad-viajes-estaciones/download/900034-3-bicimad-viajes-estaciones.zip",
    2018: "https://datos.madrid.es/dataset/900034-0-bicimad-viajes-estaciones/resource/900034-2-bicimad-viajes-estaciones/download/900034-2-bicimad-viajes-estaciones.zip",
    2019: "https://datos.madrid.es/dataset/900034-0-bicimad-viajes-estaciones/resource/900034-4-bicimad-viajes-estaciones/download/900034-4-bicimad-viajes-estaciones.zip",
    2020: "https://datos.madrid.es/dataset/900034-0-bicimad-viajes-estaciones/resource/900034-9-bicimad-viajes-estaciones/download/900034-9-bicimad-viajes-estaciones.zip",
    2021: "https://datos.madrid.es/dataset/900034-0-bicimad-viajes-estaciones/resource/900034-1-bicimad-viajes-estaciones/download/900034-1-bicimad-viajes-estaciones.zip",
    2022: "https://datos.madrid.es/dataset/900034-0-bicimad-viajes-estaciones/resource/900034-5-bicimad-viajes-estaciones/download/900034-5-bicimad-viajes-estaciones.zip",
    2023: "https://datos.madrid.es/dataset/900034-0-bicimad-viajes-estaciones/resource/900034-0-bicimad-viajes-estaciones/download/900034-0-bicimad-viajes-estaciones.zip",
}

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = PROJECT_ROOT / "data" / "Madrid"


def _download(url: str, desc: str) -> bytes:
    print(f"  ⬇️  Downloading {desc}…")
    resp = requests.get(url, stream=True, timeout=120)
    resp.raise_for_status()
    total = int(resp.headers.get("content-length", 0))
    buf = io.BytesIO()
    with tqdm(total=total or None, unit="B", unit_scale=True,
               unit_divisor=1024, desc=f"    {desc[:40]}") as pbar:
        for chunk in resp.iter_content(chunk_size=65536):
            buf.write(chunk)
            pbar.update(len(chunk))
    return buf.getvalue()


def _detect_month(filename: str) -> Optional[int]:
    stem = Path(filename).stem.lower().replace("-", "_")
    
    # 1. YYYYMM pattern
    yyyymm_match = re.search(r"20\d{2}(\d{2})", stem)
    if yyyymm_match:
        m = int(yyyymm_match.group(1))
        if 1 <= m <= 12: return m
            
    # 2. Month names
    months_map = {
        "enero": 1, "january": 1, "01": 1,
        "febrero": 2, "february": 2, "02": 2,
        "marzo": 3, "march": 3, "03": 3,
        "abril": 4, "april": 4, "04": 4,
        "mayo": 5, "may": 5, "05": 5,
        "junio": 6, "june": 6, "06": 6,
        "julio": 7, "july": 7, "07": 7,
        "agosto": 8, "august": 8, "08": 8,
        "septiembre": 9, "september": 9, "09": 9,
        "octubre": 10, "october": 10, "10": 10,
        "noviembre": 11, "november": 11, "11": 11,
        "diciembre": 12, "december": 12, "12": 12
    }
    
    parts = stem.split("_")
    for p in parts:
        if p.isdigit() and 1 <= int(p) <= 12: return int(p)
        if p in months_map: return months_map[p]
    return None


def _trips_from_json_record(record: dict) -> Optional[dict]:
    try:
        # Schema agnostic mapping
        tid = str(record.get("_id", record.get("idTrip", record.get("trip_id", ""))))
        bid = record.get("idBike", record.get("bike_id", record.get("idbike", "")))
        dur = record.get("travel_time", record.get("duration", record.get("total_duration_ms")))
        if dur and dur > 100000: dur /= 1000.0 # ms to s

        udt = record.get("unplug_hourTime", record.get("unlock_date", record.get("unplug_date")))
        gu = record.get("geolocation_unlock", record.get("unlock_station_location", record.get("unlock_location")))
        gl = record.get("geolocation_lock", record.get("lock_station_location", record.get("lock_location")))

        if not tid or gu is None or gl is None: return None
        if isinstance(udt, dict): udt = udt.get("$date", "")

        def _coords(g):
            if isinstance(g, dict):
                if "coordinates" in g: return g["coordinates"]
                if "lon" in g and "lat" in g: return [g["lon"], g["lat"]]
            return g if isinstance(g, list) else [None, None]

        cu, cl = _coords(gu), _coords(gl)
        if None in cu or None in cl: return None

        return {
            "idTrip": tid, "idBike": bid, "trip_minutes": float(dur)/60.0 if dur else None,
            "unlock_date": udt, "lock_date": record.get("lock_date", record.get("datetime_lock")),
            "geolocation_unlock": json.dumps({"type": "Point", "coordinates": list(cu)}),
            "geolocation_lock": json.dumps({"type": "Point", "coordinates": list(cl)}),
        }
    except: return None


def _process_archive(zf: zipfile.ZipFile, year_short: str, force: bool = False) -> int:
    written = 0
    for member in sorted(zf.namelist()):
        if "__MACOSX" in member: continue
        
        if member.lower().endswith(".zip"):
            print(f"     📦 Nested ZIP: {member}")
            try:
                with zf.open(member) as nf:
                    with zipfile.ZipFile(io.BytesIO(nf.read())) as nzf:
                        written += _process_archive(nzf, year_short, force)
            except Exception as e: print(f"       ❌ Failed nested ZIP {member}: {e}")
            continue

        is_json, is_csv = member.lower().endswith(".json"), member.lower().endswith(".csv")
        if not (is_json or is_csv): continue
        
        month = _detect_month(member) or _detect_month(str(Path(member).parent))
        if month is None:
            print(f"     ⚠️  No month detected for {member}")
            continue
            
        csv_path = DATA_DIR / f"trips_{year_short}_{month:02d}.csv"
        if csv_path.exists() and not force: continue

        print(f"     📂 Processing {member}...")
        try:
            with zf.open(member) as f:
                if is_json:
                    content = f.read().decode("utf-8", errors="replace")
                    try:
                        data = json.loads(content)
                        recs = data.get("data", data.get("trips", data)) if isinstance(data, dict) else data
                    except:
                        recs = [json.loads(l) for l in content.splitlines() if l.strip()]
                    
                    rows = [r for r in [_trips_from_json_record(rc) for rc in recs] if r]
                    if not rows and recs:
                        print(f"       ⚠️  0 valid trips. Keys: {list(recs[0].keys())}")
                else:
                    df = pd.read_csv(f, sep=None, engine="python", on_bad_lines="skip")
                    df.to_csv(csv_path, sep=";", index=False)
                    written += 1; print(f"     ✅ Created {csv_path.name} (CSV copy)"); continue

                if rows:
                    pd.DataFrame(rows).to_csv(csv_path, sep=";", index=False)
                    written += 1; print(f"     ✅ Created {csv_path.name} ({len(rows):,} trips)")
        except Exception as e: print(f"       ❌ Error {member}: {e}")
    return written


def ensure_data_present(year: int, force: bool = False) -> int:
    url = HISTORICAL_URLS.get(year)
    if not url: return 0
    year_short = str(year)[2:]
    if list(DATA_DIR.glob(f"trips_{year_short}_*.csv")) and not force: return 0

    print(f"\n📦 Fetching BiciMAD {year} dataset...")
    raw = _download(url, f"BiciMAD {year}")
    with zipfile.ZipFile(io.BytesIO(raw)) as zf:
        return _process_archive(zf, year_short, force)


def _load_csv(path: Path) -> pd.DataFrame:
    expected = {"geolocation_unlock", "geolocation_lock", "idTrip", "_id", "idBike", "trip_minutes", "unlock_date", "lock_date"}
    df = pd.read_csv(path, sep=";", usecols=lambda c: c in expected)
    if "idTrip" not in df.columns:
        df["idTrip"] = df["_id"] if "_id" in df.columns else [f"{path.stem}_{i}" for i in range(len(df))]
    df.dropna(subset=["geolocation_unlock", "geolocation_lock", "idTrip", "unlock_date"], inplace=True)
    df = df[df["geolocation_unlock"] != df["geolocation_lock"]]
    def _p(x):
        try: return ast.literal_eval(x)["coordinates"]
        except: return json.loads(x)["coordinates"]
    df["geolocation_unlock"] = df["geolocation_unlock"].apply(_p)
    df["geolocation_lock"] = df["geolocation_lock"].apply(_p)
    return df.reset_index(drop=True)


def _insert_trips(conn, city_id: int, df: pd.DataFrame, fname: str) -> int:
    from psycopg2.extras import execute_values
    rows_inserted = 0
    batch = []
    pbar = tqdm(range(len(df)), desc=f"Inserting {fname}", unit="trips")
    for idx in pbar:
        row = df.iloc[idx]
        lon_u, lat_u = row["geolocation_unlock"]
        lon_l, lat_l = row["geolocation_lock"]
        batch.append((
            city_id, str(row["idTrip"]), None, None, "shortest",
            float(row["trip_minutes"]) if pd.notna(row["trip_minutes"]) else None,
            row["unlock_date"], int(row["idBike"]) if pd.notna(row["idBike"]) else None,
            lat_u, lon_u, lat_l, lon_l, row.get("lock_date"), False
        ))
        if len(batch) >= BATCH_SIZE:
            with conn.cursor() as cur:
                execute_values(cur, """
                    INSERT INTO routes (city_id, id_trip, origin_node, dest_node, strategy, trip_minutes, datetime_unlock, id_bike, origin_lat, origin_lon, dest_lat, dest_lon, datetime_lock, processed)
                    VALUES %s ON CONFLICT (id_trip) DO NOTHING
                """, batch)
            conn.commit(); rows_inserted += len(batch); batch.clear()
            pbar.set_postfix({"inserted": f"{rows_inserted:,}"})
    if batch:
        with conn.cursor() as cur:
            execute_values(cur, "INSERT INTO routes (...) VALUES %s ON CONFLICT (id_trip) DO NOTHING", batch)
        conn.commit(); rows_inserted += len(batch)
    pbar.close(); return rows_inserted


def ingest_csvs(conn, city_id: int, done_files: set[str], on_file_done, single_file: bool = False) -> int:
    csv_files = list_trip_csvs("Madrid")
    processed = 0
    for f in csv_files:
        if f.name in done_files: continue
        print(f"\n📂 Ingesting {f.name}")
        df = _load_csv(f)
        _insert_trips(conn, city_id, df, f.name)
        on_file_done(f.name); processed += 1
        if single_file: break
    return processed


def main():
    load_dotenv()
    parser = argparse.ArgumentParser()
    parser.add_argument("--years", nargs="+", type=int)
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--single-file", action="store_true")
    args = parser.parse_args()

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = connect_db()
    city_id = get_or_create_city(conn, "Madrid")
    dtype = "madrid trips"

    try:
        status_obj = get_ingestion_status(conn, city_id, dtype)
        details = (status_obj.get("details") or {}) if status_obj else {}
        done_files = set(details.get("done_files", []))

        years = args.years or sorted(HISTORICAL_URLS.keys())
        for year in years: ensure_data_present(year, force=args.force)

        def on_file_done(fn):
            done_files.add(fn); details["done_files"] = list(done_files)
            upsert_ingestion_status(conn, city_id, dtype, "RUNNING", details=details); conn.commit()

        n = ingest_csvs(conn, city_id, done_files, on_file_done, single_file=args.single_file)
        upsert_ingestion_status(conn, city_id, dtype, "SUCCESS", details=details)
        print(f"\n🏁 Finished! {n} files ingested.")
    except Exception as e:
        upsert_ingestion_status(conn, city_id, dtype, "FAILED")
        print(f"❌ {e}"); raise
    finally: conn.close()

if __name__ == "__main__":
    main()
