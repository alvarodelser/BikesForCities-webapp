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

import os
MASTER_MAP_PATH = Path("data/Madrid/master_station_map.json")

def load_master_map():
    if MASTER_MAP_PATH.exists():
        try:
            with open(MASTER_MAP_PATH, "r") as f: return json.load(f)
        except: pass
    return {}

def save_master_map(m):
    MASTER_MAP_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(MASTER_MAP_PATH, "w") as f: json.dump(m, f)

def _trips_from_json_record(record: dict, station_map: dict) -> Optional[dict]:
    # Normalise keys for easier lookup
    rec = {k.lower().strip(): v for k, v in record.items()}
    
    def _coords(station_id):
        if pd.isna(station_id): return None
        try:
            # Handle float representations of IDs in CSVs (e.g. 1.0 -> 1)
            sid = str(int(float(station_id)))
        except:
            sid = str(station_id)
            
        res = station_map.get(sid)
        if not res:
            mmap = load_master_map()
            res = mmap.get(sid)
        return res
        
    cu_raw = rec.get("geolocation_unlock")
    cl_raw = rec.get("geolocation_lock")
    cu_str, cl_str = None, None
    if pd.notna(cu_raw) and isinstance(cu_raw, str): cu_str = cu_raw.replace("'", '"')
    if pd.notna(cl_raw) and isinstance(cl_raw, str): cl_str = cl_raw.replace("'", '"')
    
    if not cu_str or not cl_str:
        su = rec.get("idunplug_station", rec.get("station_unlock", rec.get("idunplug_base", rec.get("estacion_origen"))))
        sl = rec.get("idplug_station", rec.get("station_lock", rec.get("idplug_base", rec.get("estacion_destino"))))
        if pd.isna(su) or pd.isna(sl): return None
        
        cu, cl = _coords(su), _coords(sl)
        if not cu or not cl: return None
        if None in cu or None in cl: return None
        
        if not cu_str: cu_str = json.dumps({"type": "Point", "coordinates": [float(cu[0]), float(cu[1])]})
        if not cl_str: cl_str = json.dumps({"type": "Point", "coordinates": [float(cl[0]), float(cl[1])]})
    
    tid = rec.get("_id", rec.get("idtrip", rec.get("trip_id")))
    if not tid and "_id" in rec and isinstance(rec["_id"], dict):
        tid = rec["_id"].get("$oid")
        
    bid = rec.get("idplug_base") or rec.get("idunplug_base") or rec.get("idbike")
    dur = rec.get("travel_time", rec.get("trip_minutes", rec.get("tiempo_viaje")))
    
    udt = rec.get("unplug_hourtime", rec.get("fecha", rec.get("unlock_date", rec.get("fecha_origen"))))
    if isinstance(udt, dict): udt = udt.get("$date")
    
    return {
        "idTrip": tid, "idBike": bid, "trip_minutes": float(dur)/60.0 if dur else None,
        "unlock_date": udt, "lock_date": rec.get("lock_date", rec.get("datetime_lock", rec.get("fecha_destino", rec.get("fecha_origen")))),
        "geolocation_unlock": cu_str,
        "geolocation_lock": cl_str,
    }

def _extract_stations_from_json(content: str) -> dict:
    """Parses a BiciMAD station JSON dump and returns a map of {id: [lon, lat]}"""
    station_map = {}
    try:
        data = json.loads(content)
        records = data.get("data", data.get("stations", data)) if isinstance(data, dict) else data
        for k in records:
            s_id = str(k.get("id", k.get("id_station", k.get("_id", ""))))
            geom = k.get("geometry", {})
            if isinstance(geom, dict) and "coordinates" in geom:
                station_map[s_id] = [float(geom["coordinates"][0]), float(geom["coordinates"][1])]
            elif "latitude" in k and "longitude" in k:
                station_map[s_id] = [float(k["longitude"]), float(k["latitude"])]
    except Exception:
        pass
    
    if station_map:
        mmap = load_master_map()
        mmap.update(station_map)
        save_master_map(mmap)
        
    return station_map


def _process_archive(zf: zipfile.ZipFile, year_short: str, station_map: dict, force: bool = False) -> int:
    written = 0
    members = sorted(zf.namelist())
    
    for member in members:
        if "__MACOSX" in member: continue
        if member.lower().endswith(".zip") and "station" in member.lower():
            try:
                with zf.open(member) as nf:
                    with zipfile.ZipFile(io.BytesIO(nf.read())) as nzf:
                        for sub_member in nzf.namelist():
                            if sub_member.lower().endswith(".json"):
                                content = nzf.read(sub_member).decode("utf-8", errors="replace")
                                station_map.update(_extract_stations_from_json(content))
            except Exception: pass
        elif member.lower().endswith(".json") and "station" in member.lower():
            content = zf.read(member).decode("utf-8", errors="replace")
            station_map.update(_extract_stations_from_json(content))

    for member in members:
        if "__MACOSX" in member: continue
        
        if member.lower().endswith(".zip") and "station" not in member.lower():
            print(f"     📦 Nested ZIP: {member}")
            try:
                with zf.open(member) as nf:
                    with zipfile.ZipFile(io.BytesIO(nf.read())) as nzf:
                        written += _process_archive(nzf, year_short, station_map, force)
            except Exception as e: print(f"       ❌ Failed nested ZIP {member}: {e}")
            continue

        is_json, is_csv = member.lower().endswith(".json"), member.lower().endswith(".csv")
        if not (is_json or is_csv): continue
        if "station" in member.lower(): continue
        
        month = _detect_month(member) or _detect_month(str(Path(member).parent))
        if month is None:
            continue
            
        csv_path = DATA_DIR / f"trips_{year_short}_{month:02d}.csv"
        if csv_path.exists():
            if not force: continue
            else: csv_path.unlink() # Delete the zombie csv so we don't accidentally preserve error-filled versions

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
                    
                    rows = [r for r in [_trips_from_json_record(rc, station_map) for rc in recs] if r]
                else:
                    df = pd.read_csv(f, sep=";", engine="python", on_bad_lines="skip")
                    if len(df.columns) < 2:
                        # Fallback to comma if semicolon fails
                        f.seek(0)
                        df = pd.read_csv(f, sep=",", engine="python", on_bad_lines="skip")
                    recs = df.to_dict("records")
                    rows = [r for r in [_trips_from_json_record(rc, station_map) for rc in recs] if r]

                if not rows and recs:
                    print(f"       ⚠️  0 valid trips. Keys: {list(recs[0].keys())[:10]}")

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
    
    # We build the station map entirely from within the BiciMAD zip files, not the DB
    station_map = {}
    with zipfile.ZipFile(io.BytesIO(raw)) as zf:
        return _process_archive(zf, year_short, station_map, force)


def _load_csv(path: Path) -> pd.DataFrame:
    import math
    expected = {"geolocation_unlock", "geolocation_lock", "idTrip", "_id", "idBike", "trip_minutes", "unlock_date", "lock_date"}
    df = pd.read_csv(path, sep=";", usecols=lambda c: c in expected)
    if "idTrip" not in df.columns or df["idTrip"].isnull().all():
        df["idTrip"] = df["_id"] if "_id" in df.columns and not df["_id"].isnull().all() else [f"{path.stem}_{i}" for i in range(len(df))]
    df.dropna(subset=["geolocation_unlock", "geolocation_lock", "idTrip", "unlock_date"], inplace=True)
    df = df[df["geolocation_unlock"] != df["geolocation_lock"]]
    def _p(x):
        try: 
            pts = ast.literal_eval(x)["coordinates"]
        except: 
            try:
                pts = json.loads(x)["coordinates"]
            except:
                return None
                
        if pts[0] is None or pts[1] is None: return None
        try:
            f0, f1 = float(pts[0]), float(pts[1])
            if math.isnan(f0) or math.isnan(f1): return None
            return [f0, f1]
        except:
            return None
            
    df["geolocation_unlock"] = df["geolocation_unlock"].apply(_p)
    df["geolocation_lock"] = df["geolocation_lock"].apply(_p)
    
    # Drop rows where parsing resulted in None (missing coordinates)
    df.dropna(subset=["geolocation_unlock", "geolocation_lock"], inplace=True)
    return df.reset_index(drop=True)


def _insert_trips(conn, city_id: int, df: pd.DataFrame, fname: str, graph) -> int:
    from backend.database.db_io.routes import put_routes
    import osmnx as ox
    
    if len(df) == 0:
        return 0
        
    rows_inserted = 0
    batch = []
    
    # Extract coordinates directly into pure float lists
    lons_u, lats_u = zip(*df["geolocation_unlock"].tolist())
    lons_l, lats_l = zip(*df["geolocation_lock"].tolist())
    
    print(f"     🗺️  Snapping {len(df):,} trips to graph nodes...")
    nodes_u = ox.distance.nearest_nodes(graph, X=lons_u, Y=lats_u)
    nodes_l = ox.distance.nearest_nodes(graph, X=lons_l, Y=lats_l)

    pbar = tqdm(range(len(df)), desc=f"Inserting {fname}", unit="trips")
    for idx in pbar:
        row = df.iloc[idx]
        nu, nl = nodes_u[idx], nodes_l[idx]
        
        # Verify distance (optional safety mechanism)
        gu = (graph.nodes[nu]['x'], graph.nodes[nu]['y'])
        gl = (graph.nodes[nl]['x'], graph.nodes[nl]['y'])
        d1 = ox.distance.great_circle(lats_u[idx], lons_u[idx], gu[1], gu[0])
        d2 = ox.distance.great_circle(lats_l[idx], lons_l[idx], gl[1], gl[0])
        if d1 > 150.0 or d2 > 150.0:
            continue
            
        batch.append((
            city_id, str(row["idTrip"]), int(nu), int(nl), "shortest",
            float(row["trip_minutes"]) if pd.notna(row["trip_minutes"]) else None,
            row["unlock_date"], int(row["idBike"]) if pd.notna(row["idBike"]) else None,
            row.get("lock_date")
        ))
        
        if len(batch) >= BATCH_SIZE:
            put_routes(conn, batch)
            rows_inserted += len(batch)
            batch.clear()
            pbar.set_postfix({"inserted": f"{rows_inserted:,}"})
            
    if batch:
        put_routes(conn, batch)
        rows_inserted += len(batch)
        
    pbar.close()
    return rows_inserted


def ingest_csvs(conn, city_id: int, done_files: set[str], on_file_done, single_file: bool = False, force: bool = False) -> int:
    from backend.processing.city_ops import build_graph
    
    csv_files = list_trip_csvs("Madrid")
    processed = 0
    if not csv_files: return processed
    
    print(f"\n🌐 Loading OSM Graph for Madrid to snap coordinates to nodes...")
    graph = build_graph(conn, city_id)
    
    for f in csv_files:
        if f.name in done_files and not force: continue
        print(f"\n📂 Ingesting {f.name}")
        df = _load_csv(f)
        _insert_trips(conn, city_id, df, f.name, graph)
        on_file_done(f.name)
        processed += 1
        conn.commit()
        if single_file: break
    return processed


def main():
    load_dotenv()
    parser = argparse.ArgumentParser(description="Unified Madrid trip downloader and loader")
    parser.add_argument("--years", nargs="+", type=int, choices=sorted(HISTORICAL_URLS.keys()), help="Years to download")
    parser.add_argument("--force", action="store_true", help="Force re-download and re-ingest")
    parser.add_argument("--single-file", action="store_true", help="Process only one file")
    args = parser.parse_args()

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = connect_db()
    city_id = get_or_create_city(conn, "Madrid")
    dtype = "madrid trips"

    try:
        status_obj = get_ingestion_status(conn, city_id, dtype)
        details = (status_obj.get("details") or {}) if status_obj else {}
        done_files = set(details.get("done_files", []))
        
        if args.force:
            done_files.clear()
            details["done_files"] = []
        
        years = args.years or sorted(HISTORICAL_URLS.keys(), reverse=True)
        for year in years:
            ensure_data_present(year, force=args.force)

        print("\n🏁 Finished downloading BiciMAD trips.")
        
        def on_file_done(fn):
            done_files.add(fn); details["done_files"] = list(done_files)
            upsert_ingestion_status(conn, city_id, dtype, "RUNNING", details=details); conn.commit()

        n = ingest_csvs(conn, city_id, done_files, on_file_done, single_file=args.single_file, force=args.force)
        upsert_ingestion_status(conn, city_id, dtype, "SUCCESS", details=details)
        print(f"\n🏁 Finished! {n} files ingested.")
    except Exception as e:
        upsert_ingestion_status(conn, city_id, dtype, "FAILED")
        print(f"❌ {e}")
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    main()

