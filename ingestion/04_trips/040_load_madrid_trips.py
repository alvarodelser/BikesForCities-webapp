"""
040_load_madrid_trips.py
Unified script to download historical BiciMAD trips and ingest them into the DB.

Combines:
  1. Automated download of 2017-2023 historical ZIPs from datos.madrid.es.
  2. Extraction and conversion of monthly JSON trips to the project's CSV format.
  3. Ingestion into the 'routes' table (processed=FALSE).

Usage:
    python3 ingestion/04_trips/040_load_madrid_trips.py
    python3 ingestion/04_trips/040_load_madrid_trips.py --years 2022 2023
    python3 ingestion/04_trips/040_load_madrid_trips.py --single-file  # ingest only one month
"""

from __future__ import annotations

import argparse
import ast
import io
import json
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
    count_routes,
)
from backend.processing.trip_loader import list_trip_csvs, LOG_PATH

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


# ---------------------------------------------------------------------------
# Part 1: Download & Extraction
# ---------------------------------------------------------------------------

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


def _trips_from_json_record(record: dict) -> Optional[dict]:
    try:
        trip_id = str(record.get("_id", ""))
        bike_id = record.get("idBike", "")
        minutes = record.get("travel_time")
        unlock_dt = record.get("unplug_hourTime")
        geo_u = record.get("geolocation_unlock")
        geo_l = record.get("geolocation_lock")

        if not trip_id or geo_u is None or geo_l is None:
            return None

        if isinstance(unlock_dt, dict):
            unlock_dt = unlock_dt.get("$date", "")

        def _coords(g):
            if isinstance(g, dict): return g.get("coordinates", [None, None])
            if isinstance(g, list): return g
            return [None, None]

        coords_u = _coords(geo_u)
        coords_l = _coords(geo_l)

        if None in coords_u or None in coords_l: return None

        return {
            "idTrip": trip_id,
            "idBike": bike_id,
            "trip_minutes": float(minutes) / 60.0 if minutes is not None else None,
            "unlock_date": unlock_dt,
            "lock_date": None,
            "geolocation_unlock": json.dumps({"type": "Point", "coordinates": list(coords_u)}),
            "geolocation_lock": json.dumps({"type": "Point", "coordinates": list(coords_l)}),
        }
    except Exception:
        return None


def ensure_data_present(year: int, force: bool = False) -> int:
    url = HISTORICAL_URLS.get(year)
    if not url: return 0
    year_short = str(year)[2:]

    # Check if we already have some files for this year
    existing = list(DATA_DIR.glob(f"trips_{year_short}_*.csv"))
    if existing and not force:
        return 0

    print(f"\n📦 Year {year} is missing locally — fetching from Portal de Datos Abiertos…")
    raw = _download(url, f"BiciMAD {year}")
    zf = zipfile.ZipFile(io.BytesIO(raw))

    json_members = [m for m in zf.namelist() if m.lower().endswith(".json") and "__MACOSX" not in m]
    written = 0
    for member in sorted(json_members):
        stem = Path(member).stem
        month: Optional[int] = None
        for part in stem.replace("-", "_").split("_"):
            if part.isdigit() and 1 <= int(part) <= 12:
                month = int(part); break
        
        if month is None: continue
        csv_path = DATA_DIR / f"trips_{year_short}_{month:02d}.csv"
        if csv_path.exists() and not force: continue

        data = json.loads(zf.read(member))
        records = data.get("data", data.get("trips", data)) if isinstance(data, dict) else data
        rows = [r for r in [_trips_from_json_record(rec) for rec in records] if r is not None]
        if rows:
            pd.DataFrame(rows).to_csv(csv_path, sep=";", index=False)
            written += 1
            print(f"   ✅ Extracted {csv_path.name}")
    
    return written


# ---------------------------------------------------------------------------
# Part 2: Ingestion
# ---------------------------------------------------------------------------

def _load_csv(path: Path) -> pd.DataFrame:
    expected = {"geolocation_unlock", "geolocation_lock", "idTrip", "_id", "idBike", "trip_minutes", "unlock_date", "lock_date"}
    df = pd.read_csv(path, sep=";", usecols=lambda c: c in expected)

    if "idTrip" not in df.columns:
        if "_id" in df.columns:
            df["idTrip"] = df["_id"]
        else:
            df["idTrip"] = [f"{path.stem}_{i}" for i in range(len(df))]

    df.dropna(subset=["geolocation_unlock", "geolocation_lock", "idTrip", "unlock_date", "lock_date"], inplace=True)
    df = df[df["geolocation_unlock"] != df["geolocation_lock"]]
    df["geolocation_unlock"] = df["geolocation_unlock"].apply(lambda x: ast.literal_eval(x)["coordinates"])
    df["geolocation_lock"] = df["geolocation_lock"].apply(lambda x: ast.literal_eval(x)["coordinates"])
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
            lat_u, lon_u, lat_l, lon_l, row["lock_date"], False
        ))

        if len(batch) >= BATCH_SIZE:
            with conn.cursor() as cur:
                execute_values(cur, """
                    INSERT INTO routes (city_id, id_trip, origin_node, dest_node, strategy, trip_minutes, datetime_unlock, id_bike, origin_lat, origin_lon, dest_lat, dest_lon, datetime_lock, processed)
                    VALUES %s ON CONFLICT (id_trip) DO NOTHING
                """, batch)
            conn.commit()
            rows_inserted += len(batch)
            batch.clear()
            pbar.set_postfix({"inserted": f"{rows_inserted:,}"})

    if batch:
        with conn.cursor() as cur:
            execute_values(cur, """
                INSERT INTO routes (city_id, id_trip, origin_node, dest_node, strategy, trip_minutes, datetime_unlock, id_bike, origin_lat, origin_lon, dest_lat, dest_lon, datetime_lock, processed)
                VALUES %s ON CONFLICT (id_trip) DO NOTHING
            """, batch)
        conn.commit()
        rows_inserted += len(batch)
    
    pbar.close()
    return rows_inserted


def ingest_csvs(conn, city_id: int, done_files: set[str], on_file_done, single_file: bool = False) -> int:
    csv_files = list_trip_csvs("Madrid")
    files_processed = 0
    for f in csv_files:
        if f.name in done_files: continue
        print(f"\n📂 Ingesting {f.name}")
        df = _load_csv(f)
        n = _insert_trips(conn, city_id, df, f.name)
        on_file_done(f.name)
        files_processed += 1
        if single_file: break
    return files_processed


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    load_dotenv()
    parser = argparse.ArgumentParser(description="Unified Madrid trip downloader and loader")
    parser.add_argument("--years", nargs="+", type=int, choices=sorted(HISTORICAL_URLS.keys()), help="Years to download")
    parser.add_argument("--force", action="store_true", help="Force re-download")
    parser.add_argument("--single-file", action="store_true", help="Process only one month")
    args = parser.parse_args()

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = connect_db()
    city_id = get_or_create_city(conn, "Madrid")
    data_type = "madrid trips"

    try:
        # Step 1: Automated Download
        years = args.years or sorted(HISTORICAL_URLS.keys())
        for year in years:
            ensure_data_present(year, force=args.force)

        # Step 2: Ingestion
        status_obj = get_ingestion_status(conn, city_id, data_type)
        details = (status_obj.get("details") or {}) if status_obj else {}
        done_files = set(details.get("done_files", []))

        upsert_ingestion_status(conn, city_id, data_type, "RUNNING", details=details)

        def on_file_done(fname: str):
            done_files.add(fname)
            details["done_files"] = list(done_files)
            upsert_ingestion_status(conn, city_id, data_type, "RUNNING", details=details)
            conn.commit()

        n = ingest_csvs(conn, city_id, done_files, on_file_done, single_file=args.single_file)
        upsert_ingestion_status(conn, city_id, data_type, "SUCCESS", details=details)
        print(f"\n🏁 Finished! {n} monthly files ingested.")

    except Exception as exc:
        upsert_ingestion_status(conn, city_id, data_type, "FAILED")
        print(f"❌ {exc}")
        raise
    finally:
        conn.commit()
        conn.close()

if __name__ == "__main__":
    main()
