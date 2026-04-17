"""
05_load_stations.py
Loads CityBikes station metadata + historical occupancy time series into PostGIS.

Requires DB tables (added to `backend/database/schema.sql`):
- `stations`
- `station_readings`

CityBikes docs: https://docs.citybik.es/api/
Historical parquet: https://data.citybik.es/  (dumps/by-network/YYYY/YYYYMM-<network>-stats.parquet)
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from dotenv import load_dotenv
from psycopg2.extras import execute_values
import numpy as np

# Add project root to python path to import backend
sys.path.append(str(Path(__file__).resolve().parents[2]))

from backend.database.db_io import connect_db, get_ingestion_status, upsert_ingestion_status, get_city_id_by_name  # noqa: E402
from backend.database.db_io.stations import (
    has_station_readings_for_month,
    get_nearby_unmerged_station,
    upsert_stations,
    insert_station_readings
)


CITYBIKES_API_BASE = "https://api.citybik.es/v2"
CITYBIKES_DUMPS_BASE = "https://data.citybik.es/dumps/by-network"
SPAIN_DATA_PATH = Path(__file__).resolve().parents[2] / "data" / "spain_data.json"


def _fetch_json(url: str, api_key: str | None = None, timeout_s: int = 30) -> Dict[str, Any]:
    headers = {"accept": "application/json"}
    if api_key:
        headers["x-api-key"] = api_key
    req = Request(url, headers=headers)
    try:
        with urlopen(req, timeout=timeout_s) as resp:  # noqa: S310
            raw = resp.read().decode("utf-8")
            return json.loads(raw)
    except HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace") if hasattr(exc, "read") else ""
        raise RuntimeError(f"HTTP {exc.code} for {url}\n{body}") from exc
    except URLError as exc:
        raise RuntimeError(f"Network error fetching {url}: {exc}") from exc


def _parse_iso(ts: str) -> dt.datetime:
    # Some feeds send timestamps like "...+00:00Z"; normalize trailing Z safely.
    if ts.endswith("Z"):
        ts = ts[:-1]
    return dt.datetime.fromisoformat(ts)


def _month_start(year: int, month: int) -> dt.datetime:
    return dt.datetime(year, month, 1, tzinfo=dt.timezone.utc)


def _next_month_start(d: dt.datetime) -> dt.datetime:
    if d.month == 12:
        return _month_start(d.year + 1, 1)
    return _month_start(d.year, d.month + 1)


def _iter_months(start_yyyymm: str, end_inclusive: dt.datetime) -> Iterable[Tuple[int, int]]:
    sy = int(start_yyyymm[:4])
    sm = int(start_yyyymm[4:6])
    cur = _month_start(sy, sm)
    end_month = _month_start(end_inclusive.year, end_inclusive.month)
    while cur <= end_month:
        yield cur.year, cur.month
        cur = _next_month_start(cur)


def _head_ok(url: str, timeout_s: int = 30) -> bool:
    req = Request(url, method="HEAD")
    try:
        with urlopen(req, timeout=timeout_s):  # noqa: S310
            return True
    except Exception:
        return False


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Ingest CityBikes stations + historical readings into DB.")
    parser.add_argument("--start", type=str, default="202401", help="Start month YYYYMM (default: 202401).")
    parser.add_argument("--only-city", type=str, default=None, help="Only ingest one city key from spain_data.json.")
    parser.add_argument("--download-timeout", type=int, default=60, help="HTTP timeout for dumps download (seconds).")
    parser.add_argument("--api-timeout", type=int, default=30, help="HTTP timeout for CityBikes API (seconds).")
    parser.add_argument("--no-history", action="store_true", help="Skip historical parquet ingestion (metadata only).")
    parser.add_argument("--no-metadata", action="store_true", help="Skip realtime metadata upsert (history only).")
    parser.add_argument("--force", action="store_true", help="Force re-download even if month already ingested.")
    return parser.parse_args()


def _db_get_city_id(conn, city_name: str) -> Optional[int]:
    return get_city_id_by_name(conn, city_name)


def _db_month_has_data(conn, network_id: str, year: int, month: int) -> bool:
    start = _month_start(year, month)
    end = _next_month_start(start)
    return has_station_readings_for_month(conn, network_id, start, end)


def _db_upsert_stations(conn, *, city_id: int, network_id: str, stations: List[Dict[str, Any]]) -> int:
    rows = []
    for st in stations:
        sid = str(st.get("id"))
        lat = st.get("latitude")
        lon = st.get("longitude")
        if not sid or lat is None or lon is None:
            continue

        merged_into = get_nearby_unmerged_station(conn, city_id, sid, lon, lat)

        ts = st.get("timestamp")
        seen = _parse_iso(ts) if isinstance(ts, str) else None
        extra = st.get("extra")
        rows.append(
            (
                city_id,
                network_id,
                sid,
                st.get("name"),
                float(lat),
                float(lon),
                float(lon),
                float(lat),
                json.dumps(extra, ensure_ascii=False) if extra is not None else None,
                seen,
                seen,
                merged_into
            )
        )

    return upsert_stations(conn, rows)


def _db_insert_readings(
    conn,
    *,
    city_id: int,
    network_id: str,
    batch: List[Tuple[str, dt.datetime, Optional[int], Optional[int], Optional[dict]]],
) -> int:
    if not batch:
        return 0
    rows = [
        (
            network_id,
            sid,
            observed_at,
            bikes,
            slots,
            city_id,
            json.dumps(extra, ensure_ascii=False) if extra is not None else None,
        )
        for (sid, observed_at, bikes, slots, extra) in batch
    ]
    return insert_station_readings(conn, rows)


def _ingest_parquet_month(
    conn,
    *,
    city_id: int,
    network_id: str,
    year: int,
    month: int,
    download_timeout_s: int,
) -> int:
    import urllib.request

    import pyarrow.parquet as pq

    yyyymm = f"{year}{month:02d}"
    parquet_name = f"{yyyymm}-{network_id}-stats.parquet"
    url = f"{CITYBIKES_DUMPS_BASE}/{year}/{parquet_name}"

    if not _head_ok(url, timeout_s=download_timeout_s):
        return 0

    cache_dir = Path(__file__).resolve().parents[1] / "cache" / "citybikes_history" / network_id
    cache_dir.mkdir(parents=True, exist_ok=True)
    local_path = cache_dir / parquet_name

    if not local_path.exists():
        print(f"⬇️  Downloading {parquet_name} …", flush=True)
        urllib.request.urlretrieve(url, local_path)  # noqa: S310
    else:
        print(f"📦 Using cached {parquet_name}", flush=True)

    pf = pq.ParquetFile(local_path)
    schema_cols = set(pf.schema_arrow.names)

    def pick(cands: List[str]) -> Optional[str]:
        for c in cands:
            if c in schema_cols:
                return c
        return None

    station_col = pick(["station_id", "id", "station", "station_uid", "uid"])
    time_col = pick(["timestamp", "time", "datetime", "observed_at", "last_updated", "updated_at"])
    
    # Identify all columns related to bikes and slots to ensure we sum them (e.g. ebikes + mechanical)
    possible_bike_cols = ["free_bikes", "available_bikes", "bikes", "num_bikes_available", "ebikes", "electric_bikes", "mechanical_bikes", "bikes_ebikes"]
    bike_cols_present = [c for c in possible_bike_cols if c in schema_cols]
    
    possible_slot_cols = ["empty_slots", "available_slots", "slots", "num_docks_available", "ebike_slots"]
    slot_cols_present = [c for c in possible_slot_cols if c in schema_cols]
    
    extra_col = pick(["extra"])
    name_col = pick(["name", "station_name", "title"])
    lat_col = pick(["latitude", "lat"])
    lon_col = pick(["longitude", "lon"])

    if station_col is None or time_col is None:
        raise RuntimeError(
            f"Unexpected parquet schema for {parquet_name}. Missing station/time columns. Columns: {sorted(schema_cols)}"
        )

    total_inserted = 0
    batch: List[Tuple[str, dt.datetime, Optional[int], Optional[int], Optional[dict]]] = []
    batch_size = 5000

    cols_to_read = list(set([c for c in [station_col, time_col, extra_col, name_col, lat_col, lon_col] if c] + bike_cols_present + slot_cols_present))
    for rg in range(pf.num_row_groups or 1):
        table = pf.read_row_group(rg, columns=cols_to_read)
        sids = table[station_col].to_pylist()
        times = table[time_col].to_pylist()
        
        # Sum all bike/slot columns present
        def get_sum(cols):
            if not cols: return [None] * len(sids)
            
            # Using a DataFrame for easier row-wise summation with null handling
            import pandas as pd
            sub_df = pd.DataFrame({c: table[c].to_pylist() for c in cols})
            
            # Sum rows, but if all original values were None, return None for that row
            # min_count=1 ensures that if all are NA, the result is NA (not 0)
            summed = sub_df.sum(axis=1, min_count=1)
            return [int(x) if pd.notnull(x) else None for x in summed]

        bikes = get_sum(bike_cols_present)
        slots = get_sum(slot_cols_present)
        extras = table[extra_col].to_pylist() if extra_col and extra_col in table.column_names else [None] * len(sids)
        names = table[name_col].to_pylist() if name_col and name_col in table.column_names else [None] * len(sids)
        lats = table[lat_col].to_pylist() if lat_col and lat_col in table.column_names else [None] * len(sids)
        lons = table[lon_col].to_pylist() if lon_col and lon_col in table.column_names else [None] * len(sids)

        batch_stations = {}
        for sid, t, b, s, ex, n, lat, lon in zip(sids, times, bikes, slots, extras, names, lats, lons):
            if sid is None or t is None:
                continue

            if isinstance(t, str):
                observed_at = _parse_iso(t)
            elif isinstance(t, dt.datetime):
                observed_at = t
            else:
                continue

            if observed_at.tzinfo is None:
                observed_at = observed_at.replace(tzinfo=dt.timezone.utc)
                
            if isinstance(ex, str):
                try:
                    ex = json.loads(ex)
                except json.JSONDecodeError:
                    ex = None

            batch.append(
                (
                    str(sid),
                    observed_at,
                    int(b) if b is not None else None,
                    int(s) if s is not None else None,
                    ex if isinstance(ex, dict) else None,
                )
            )
            
            if sid not in batch_stations and lat is not None and lon is not None:
                batch_stations[sid] = {
                    "id": sid,
                    "latitude": lat,
                    "longitude": lon,
                    "name": n,
                    "timestamp": observed_at.isoformat(),
                    "extra": ex if isinstance(ex, dict) else None,
                }
                
            if len(batch) >= batch_size:
                total_inserted += _db_insert_readings(conn, city_id=city_id, network_id=network_id, batch=batch)
                batch = []
                if batch_stations:
                    _db_upsert_stations(conn, city_id=city_id, network_id=network_id, stations=list(batch_stations.values()))
                    batch_stations = {}

        if batch:
            total_inserted += _db_insert_readings(conn, city_id=city_id, network_id=network_id, batch=batch)
        if batch_stations:
            _db_upsert_stations(conn, city_id=city_id, network_id=network_id, stations=list(batch_stations.values()))

    return total_inserted


def main() -> None:
    load_dotenv()
    args = parse_args()

    if not SPAIN_DATA_PATH.exists():
        raise RuntimeError(f"Missing {SPAIN_DATA_PATH}.")

    with open(SPAIN_DATA_PATH, "r", encoding="utf-8") as f:
        spain = json.load(f)

    conn = connect_db()
    try:
        for city_key, info in spain.items():
            if args.only_city and city_key != args.only_city:
                continue

            network_id = info.get("citybikes_network_id")
            if not network_id:
                continue

            city_name = info.get("name") or city_key
            city_id = _db_get_city_id(conn, city_name)
            if city_id is None:
                print(f"⏭️  Skipping {city_name}: not present in DB (run 01_load_cities.py first).")
                continue

            print(f"\n=== {city_name} (city_id={city_id}) — CityBikes network '{network_id}' ===")

            if args.no_history:
                continue

            pname = f"030_load_stations_{city_name}"
            upsert_ingestion_status(conn, pname, "RUNNING", city_id=city_id)
            try:
                # Load status to track ingested months
                status_obj = get_ingestion_status(conn, pname)
                details = status_obj.get("details", {}) if status_obj else {}
                ingested_months = details.get("months", [])
                
                now = dt.datetime.now(tz=dt.timezone.utc)
                for year, month in _iter_months(args.start, now):
                    yyyymm = f"{year}{month:02d}"
                    if yyyymm in ingested_months and _db_month_has_data(conn, network_id, year, month) and not args.force:
                        continue
                        
                    inserted = _ingest_parquet_month(
                        conn,
                        city_id=city_id,
                        network_id=network_id,
                        year=year,
                        month=month,
                        download_timeout_s=args.download_timeout,
                    )
                    if inserted > 0:
                        print(f"📈 Inserted {inserted:,} readings for {year}{month:02d}.", flush=True)
                    
                    if yyyymm not in ingested_months:
                        ingested_months.append(yyyymm)
                        
                details["months"] = ingested_months
                upsert_ingestion_status(conn, pname, "SUCCESS", city_id=city_id)
                print(f"✅ Upserted ingestion status for {city_name}.")
            except Exception as e:
                upsert_ingestion_status(conn, pname, "FAILED", city_id=city_id)
                print(f"❌ Error processing stations for {city_name}: {e}")
    finally:
        conn.commit()
        conn.close()


if __name__ == "__main__":
    main()

