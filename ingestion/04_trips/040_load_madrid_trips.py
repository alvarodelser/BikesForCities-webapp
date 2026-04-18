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
DATA_DIR = PROJECT_ROOT / "data" / "bicimad_trips"
SOURCES_FILE = DATA_DIR / "sources.json"

def _load_sources() -> dict[int, str]:
    if SOURCES_FILE.exists():
        with open(SOURCES_FILE) as f:
            raw = json.load(f)
        return {int(k): v for k, v in raw.items()}
    # fallback defaults (also written to disk on first run)
    defaults = {
        2017: "https://datos.madrid.es/dataset/900034-0-bicimad-viajes-estaciones/resource/900034-3-bicimad-viajes-estaciones/download/900034-3-bicimad-viajes-estaciones.zip",
        2018: "https://datos.madrid.es/dataset/900034-0-bicimad-viajes-estaciones/resource/900034-2-bicimad-viajes-estaciones/download/900034-2-bicimad-viajes-estaciones.zip",
        2019: "https://datos.madrid.es/dataset/900034-0-bicimad-viajes-estaciones/resource/900034-4-bicimad-viajes-estaciones/download/900034-4-bicimad-viajes-estaciones.zip",
        2020: "https://datos.madrid.es/dataset/900034-0-bicimad-viajes-estaciones/resource/900034-9-bicimad-viajes-estaciones/download/900034-9-bicimad-viajes-estaciones.zip",
        2021: "https://datos.madrid.es/dataset/900034-0-bicimad-viajes-estaciones/resource/900034-1-bicimad-viajes-estaciones/download/900034-1-bicimad-viajes-estaciones.zip",
        2022: "https://datos.madrid.es/dataset/900034-0-bicimad-viajes-estaciones/resource/900034-5-bicimad-viajes-estaciones/download/900034-5-bicimad-viajes-estaciones.zip",
        2023: "https://datos.madrid.es/dataset/900034-0-bicimad-viajes-estaciones/resource/900034-0-bicimad-viajes-estaciones/download/900034-0-bicimad-viajes-estaciones.zip",
    }
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(SOURCES_FILE, "w") as f:
        json.dump({str(k): v for k, v in defaults.items()}, f, indent=2)
    return defaults

HISTORICAL_URLS: dict[int, str] = _load_sources()


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
MASTER_MAP_PATH = DATA_DIR / "master_station_map.json"

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
    
    # Track is a GeoJSON FeatureCollection; features stored in descending secondsfromstart order
    track_raw = rec.get("track")
    track_coords = None
    if isinstance(track_raw, dict):
        features = track_raw.get("features") or []
        if len(features) >= 2:
            sorted_feats = sorted(features, key=lambda f: f.get("properties", {}).get("secondsfromstart", 0))
            def _coord_from_feat(feat):
                c = (feat.get("geometry") or {}).get("coordinates") or []
                return [float(c[0]), float(c[1])] if len(c) >= 2 else None
            pts = [p for p in (_coord_from_feat(f) for f in sorted_feats) if p]
            if len(pts) >= 2:
                if not cu_str:
                    cu_str = json.dumps({"type": "Point", "coordinates": pts[0]})
                if not cl_str:
                    cl_str = json.dumps({"type": "Point", "coordinates": pts[-1]})
                if len(pts) >= 3:
                    track_coords = pts

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
        "track_coords": json.dumps(track_coords) if track_coords else None,
    }

def _extract_stations_from_json(content: str) -> dict:
    """Parses a BiciMAD station JSON dump and returns a map of {id: [lon, lat]}"""
    station_map = {}
    try:
        data = json.loads(content)
        records = data.get("data", data.get("stations", data)) if isinstance(data, dict) else data
        for k in records:
            if not isinstance(k, dict): continue
            s_id = str(k.get("id", k.get("id_station", k.get("_id", ""))))
            coords = None
            geom = k.get("geometry", {})
            if isinstance(geom, dict) and "coordinates" in geom:
                coords = [float(geom["coordinates"][0]), float(geom["coordinates"][1])]
            elif "latitude" in k and "longitude" in k:
                coords = [float(k["longitude"]), float(k["latitude"])]
            # BiciMAD format where coordinates are nested inside a 'stations' sub-document
            if coords is None:
                nested = k.get("stations", {})
                if isinstance(nested, dict):
                    geom2 = nested.get("geometry", {})
                    if isinstance(geom2, dict) and "coordinates" in geom2:
                        coords = [float(geom2["coordinates"][0]), float(geom2["coordinates"][1])]
                    elif "latitude" in nested and "longitude" in nested:
                        coords = [float(nested["longitude"]), float(nested["latitude"])]
            if coords and s_id:
                station_map[s_id] = coords
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
    
    # First pass: extract station coordinates from ALL JSON files (station files may not have
    # "station" in their filename, e.g. 202101.json contains station data for 2021)
    for member in members:
        if "__MACOSX" in member: continue
        if member.lower().endswith(".zip"):
            try:
                with zf.open(member) as nf:
                    with zipfile.ZipFile(io.BytesIO(nf.read())) as nzf:
                        for sub_member in nzf.namelist():
                            if sub_member.lower().endswith(".json"):
                                content = nzf.read(sub_member).decode("utf-8", errors="replace")
                                station_map.update(_extract_stations_from_json(content))
            except Exception: pass
        elif member.lower().endswith(".json"):
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

                    # Skip files that are station records, not trip records
                    if isinstance(recs, list) and recs and isinstance(recs[0], dict):
                        first_keys = set(recs[0].keys())
                        trip_indicators = {'geolocation_unlock', 'geolocation_lock', 'idunplug_station', 'idplug_station', 'travel_time', 'trip_minutes'}
                        if 'stations' in first_keys and not first_keys & trip_indicators:
                            continue

                    rows = [r for r in [_trips_from_json_record(rc, station_map) for rc in recs] if r]
                else:
                    csv_content = f.read()
                    df = pd.read_csv(io.BytesIO(csv_content), sep=";", engine="python", on_bad_lines="skip")
                    if len(df.columns) < 2:
                        df = pd.read_csv(io.BytesIO(csv_content), sep=",", engine="python", on_bad_lines="skip")
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
    """Download and extract BiciMAD data for a year if not already present locally.
    
    --force never re-downloads raw ZIPs; it only re-extracts already-downloaded data.
    To force a fresh download, delete the raw cache file manually.
    """
    url = HISTORICAL_URLS.get(year)
    if not url: return 0
    year_short = str(year)[2:]
    
    # Raw ZIP cache path – never re-downloaded if present
    raw_cache = DATA_DIR / "raw" / f"bicimad_{year}.zip"
    raw_cache.parent.mkdir(parents=True, exist_ok=True)
    
    # If CSVs already exist and we're not forcing re-extract, skip entirely
    if list(DATA_DIR.glob(f"trips_{year_short}_*.csv")) and not force:
        return 0

    print(f"\n📦 Fetching BiciMAD {year} dataset...")
    if raw_cache.exists():
        print(f"   📂 Using cached raw ZIP: {raw_cache.name}")
        raw = raw_cache.read_bytes()
    else:
        raw = _download(url, f"BiciMAD {year}")
        raw_cache.write_bytes(raw)
        print(f"   💾 Saved raw ZIP to {raw_cache.name}")
    
    station_map = {}
    with zipfile.ZipFile(io.BytesIO(raw)) as zf:
        return _process_archive(zf, year_short, station_map, force)


def _build_leuven_map(graph):
    from leuvenmapmatching.map.inmem import InMemMap
    print("     🗺️  Building leuven InMemMap from OSM graph...")
    try:
        m = InMemMap("bicimad", use_rtree=True, index_edges=True)
    except Exception:
        print("     ⚠️  rtree unavailable, falling back to linear search (slower)")
        m = InMemMap("bicimad", use_rtree=False, index_edges=True)
    for node_id, data in graph.nodes(data=True):
        m.add_node(node_id, (data['y'], data['x']))  # (lat, lon)
    for u, v in graph.edges():
        m.add_edge(u, v)
    m.purge()
    print(f"     ✅ InMemMap ready ({graph.number_of_nodes():,} nodes, {graph.number_of_edges():,} edges)")
    return m


def _map_match(leuven_map, track_coords) -> Optional[list]:
    from leuvenmapmatching.matcher.distance import DistanceMatcher
    try:
        path = [(lat, lon) for lon, lat in track_coords]
        matcher = DistanceMatcher(
            leuven_map,
            max_dist=100,
            obs_noise=50,
            min_prob_norm=0.001,
            non_emitting_states=True,
        )
        matcher.match(path)
        nodes = matcher.path_pred_onlynodes
        return list(nodes) if len(nodes) >= 2 else None
    except Exception:
        return None


def _load_csv(path: Path) -> pd.DataFrame:
    import math
    expected = {"geolocation_unlock", "geolocation_lock", "idTrip", "_id", "idBike", "trip_minutes", "unlock_date", "lock_date", "track_coords"}
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
    if "track_coords" in df.columns:
        def _parse_tc(x):
            if pd.isna(x): return None
            try: return json.loads(x)
            except: return None
        df["track_coords"] = df["track_coords"].apply(_parse_tc)
    return df.reset_index(drop=True)


def _insert_trips(conn, city_id: int, df: pd.DataFrame, fname: str, graph,
                  leuven_map=None, edge_id_map=None) -> int:
    from backend.database.db_io.routes import put_routes, put_map_matched_routes, put_route_edges_with_order
    import osmnx as ox

    if len(df) == 0:
        return 0

    rows_inserted = 0
    shortest_batch: list = []   # strategy="shortest", processed=False
    mm_route_batch: list = []   # strategy="map_matched", processed=True
    mm_edges: dict[int, list] = {}  # mm_route_batch index → [(edge_id, order)]

    lons_u, lats_u = zip(*df["geolocation_unlock"].tolist())
    lons_l, lats_l = zip(*df["geolocation_lock"].tolist())

    print(f"     🗺️  Snapping {len(df):,} trips to graph nodes...")
    nodes_u = ox.distance.nearest_nodes(graph, X=lons_u, Y=lats_u)
    nodes_l = ox.distance.nearest_nodes(graph, X=lons_l, Y=lats_l)

    has_tracks = "track_coords" in df.columns

    def _flush():
        nonlocal rows_inserted
        n = len(shortest_batch)
        if shortest_batch:
            put_routes(conn, shortest_batch)
        if mm_route_batch:
            id_map = put_map_matched_routes(conn, mm_route_batch)
            if mm_edges and edge_id_map:
                edge_tuples = []
                for b_idx, edge_seq in mm_edges.items():
                    route_id = id_map.get(mm_route_batch[b_idx][1])
                    if route_id:
                        for edge_id, order in edge_seq:
                            edge_tuples.append((route_id, edge_id, order))
                if edge_tuples:
                    put_route_edges_with_order(conn, edge_tuples)
        rows_inserted += n
        shortest_batch.clear()
        mm_route_batch.clear()
        mm_edges.clear()

    pbar = tqdm(range(len(df)), desc=f"Inserting {fname}", unit="trips")
    for idx in pbar:
        row = df.iloc[idx]
        trip_id = str(row["idTrip"])
        trip_minutes = float(row["trip_minutes"]) if pd.notna(row["trip_minutes"]) else None
        unlock_date = row["unlock_date"]
        id_bike = int(row["idBike"]) if pd.notna(row["idBike"]) else None
        lock_date = row.get("lock_date")

        # Snap start/end to nearest nodes and validate distance (used for shortest route)
        nu, nl = nodes_u[idx], nodes_l[idx]
        gu = (graph.nodes[nu]['x'], graph.nodes[nu]['y'])
        gl = (graph.nodes[nl]['x'], graph.nodes[nl]['y'])
        d1 = ox.distance.great_circle(lats_u[idx], lons_u[idx], gu[1], gu[0])
        d2 = ox.distance.great_circle(lats_l[idx], lons_l[idx], gl[1], gl[0])
        if d1 > 150.0 or d2 > 150.0:
            continue

        # Always add the shortest route (processed=False, edges computed by 042)
        shortest_batch.append((
            city_id, trip_id, int(nu), int(nl), "shortest",
            trip_minutes, unlock_date, id_bike, lock_date,
        ))

        # For trips with a GPS track, also add a map_matched route (processed=True, edges now)
        track_coords = row["track_coords"] if has_tracks else None
        if track_coords and isinstance(track_coords, list) and len(track_coords) >= 3 and leuven_map:
            matched_nodes = _map_match(leuven_map, track_coords)
            if matched_nodes:
                mm_idx = len(mm_route_batch)
                mm_route_batch.append((
                    city_id, trip_id,
                    int(matched_nodes[0]), int(matched_nodes[-1]),
                    "map_matched", trip_minutes, unlock_date, id_bike, lock_date,
                ))
                if edge_id_map:
                    edge_seq = []
                    for i in range(len(matched_nodes) - 1):
                        eid = edge_id_map.get((matched_nodes[i], matched_nodes[i + 1]))
                        if eid:
                            edge_seq.append((eid, i))
                    if edge_seq:
                        mm_edges[mm_idx] = edge_seq

        if len(shortest_batch) >= BATCH_SIZE:
            _flush()
            pbar.set_postfix({"inserted": f"{rows_inserted:,}"})

    if shortest_batch:
        _flush()

    pbar.close()
    return rows_inserted


def ingest_csvs(conn, city_id: int, done_files: set[str], on_file_done, single_file: bool = False, force: bool = False) -> int:
    from backend.processing.city_ops import build_graph
    from backend.database.db_io.graph import get_edge_id_map

    csv_files = sorted(DATA_DIR.glob("trips_*.csv"))
    processed = 0
    if not csv_files: return processed

    print(f"\n🌐 Loading OSM Graph for Madrid...")
    graph = build_graph(conn, city_id)

    print(f"   📐 Building leuven map for GPS track matching...")
    leuven_map = _build_leuven_map(graph)

    print(f"   🗃️  Loading edge ID map...")
    edge_id_map = get_edge_id_map(conn, city_id)
    print(f"   ✅ Loaded {len(edge_id_map):,} edges.")

    for f in csv_files:
        if f.name in done_files and not force: continue
        print(f"\n📂 Ingesting {f.name}")
        df = _load_csv(f)
        _insert_trips(conn, city_id, df, f.name, graph, leuven_map, edge_id_map)
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
    PROCESS_NAME = "040_load_madrid_trips"

    try:
        status_obj = get_ingestion_status(conn, PROCESS_NAME, city_id=city_id)
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
            upsert_ingestion_status(conn, PROCESS_NAME, "RUNNING", city_id=city_id, details=details); conn.commit()

        n = ingest_csvs(conn, city_id, done_files, on_file_done, single_file=args.single_file, force=args.force)
        upsert_ingestion_status(conn, PROCESS_NAME, "SUCCESS", city_id=city_id, details=details)
        print(f"\n🏁 Finished! {n} files ingested.")
    except Exception as e:
        upsert_ingestion_status(conn, PROCESS_NAME, "FAILED", city_id=city_id)
        print(f"❌ {e}")
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    main()

