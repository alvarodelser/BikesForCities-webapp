"""
050_load_madrid_accidents.py
Downloads and ingests Madrid traffic accidents data from Portal de Datos Abiertos.

Source: https://datos.madrid.es/dataset/300228-0-accidentes-trafico-detalle
Format: Annual CSV files.
- 2019+ schema: contains UTM ETRS89 zone 30N (EPSG:25830) coordinates.
- Each row in CSV is a person (driver, passenger, pedestrian).
- We deduplicate by accident_id (num_expediente) and aggregate stats.
"""

from __future__ import annotations

import argparse
import io
import json
import sys
from pathlib import Path
from typing import List, Optional

import pandas as pd
import requests
from dotenv import load_dotenv
from pyproj import Transformer
from tqdm import tqdm

sys.path.append(str(Path(__file__).resolve().parents[2]))

from backend.database.db_io import (
    connect_db,
    get_or_create_city,
    upsert_ingestion_status,
    get_ingestion_status,
)

# ---------------------------------------------------------------------------
# Accidents Dataset URLs (2019–2024 CSVs)
# ---------------------------------------------------------------------------

def _load_sources() -> dict[int, str]:
    PROJECT_ROOT = Path(__file__).resolve().parents[2]
    DATA_DIR = PROJECT_ROOT / "data" / "madrid_accidents"
    SOURCES_FILE = DATA_DIR / "sources.json"
    
    if SOURCES_FILE.exists():
        with open(SOURCES_FILE) as f:
            raw = json.load(f)
        return {int(k): v for k, v in raw.items()}
    
    defaults = {
        2019: "https://datos.madrid.es/dataset/300228-0-accidentes-trafico-detalle/resource/300228-11-accidentes-trafico-detalle-csv/download/300228-11-accidentes-trafico-detalle-csv.csv",
        2020: "https://datos.madrid.es/dataset/300228-0-accidentes-trafico-detalle/resource/300228-8-accidentes-trafico-detalle-csv/download/300228-8-accidentes-trafico-detalle-csv.csv",
        2021: "https://datos.madrid.es/dataset/300228-0-accidentes-trafico-detalle/resource/300228-33-accidentes-trafico-detalle-csv/download/300228-33-accidentes-trafico-detalle-csv.csv",
        2022: "https://datos.madrid.es/dataset/300228-0-accidentes-trafico-detalle/resource/300228-5-accidentes-trafico-detalle-csv/download/300228-5-accidentes-trafico-detalle-csv.csv",
        2023: "https://datos.madrid.es/dataset/300228-0-accidentes-trafico-detalle/resource/300228-3-accidentes-trafico-detalle-csv/download/300228-3-accidentes-trafico-detalle-csv.csv",
        2024: "https://datos.madrid.es/dataset/300228-0-accidentes-trafico-detalle/resource/300228-2-accidentes-trafico-detalle-csv/download/300228-2-accidentes-trafico-detalle-csv.csv",
        2025: "https://datos.madrid.es/dataset/300228-0-accidentes-trafico-detalle/resource/300228-1-accidentes-trafico-detalle-csv/download/300228-1-accidentes-trafico-detalle-csv.csv",
    }
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(SOURCES_FILE, "w") as f:
        json.dump({str(k): v for k, v in defaults.items()}, f, indent=2)
    return defaults

ACCIDENT_URLS: dict[int, str] = _load_sources()

# ETRS89 / UTM zone 30N (Madrid) -> WGS 4326
transformer = Transformer.from_crs("EPSG:25830", "EPSG:4326", always_xy=True)

def _download_csv(url: str, desc: str) -> bytes:
    print(f"  ⬇️  Downloading {desc}…")
    resp = requests.get(url, timeout=60)
    resp.raise_for_status()
    return resp.content

def process_accidents_year(conn, city_id: int, year: int, force: bool = False) -> int:
    url = ACCIDENT_URLS.get(year)
    if not url: return 0

    PROJECT_ROOT = Path(__file__).resolve().parents[2]
    DATA_DIR = PROJECT_ROOT / "data" / "madrid_accidents"
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    out_file = DATA_DIR / f"accidents_{year}.csv"
    
    if out_file.exists():
        print(f"   📦 Using cached {out_file.name}")
        raw = out_file.read_bytes()
    else:
        raw = _download_csv(url, f"Accidents {year}")
        out_file.write_bytes(raw)
        print(f"   💾 Saved to {out_file.name}")

    for sep in (";", ","):
        try:
            df = pd.read_csv(io.BytesIO(raw), sep=sep, encoding="utf-8-sig")
            if "num_expediente" in df.columns: break
        except Exception:
            continue
    
    if "num_expediente" not in df.columns:
        print(f"   ❌ Failed to parse CSV for {year}")
        return 0

    df.columns = [c.lower().strip().replace(" ", "_") for c in df.columns]

    # Handle schema variations
    col_mapping = {
        "localizacion": "calle",
        "estado_meteorológico": "weather",
        "estado_metereológico": "weather",
        "tipo_accidente": "accident_type",
    }
    df.rename(columns=col_mapping, inplace=True)
    
    # Custom counts and flags
    df["is_injured"] = ~df["lesividad"].fillna("").astype(str).str.lower().isin(["sin asistencia", "ileso", "", "desconocido"])
    df["is_killed"] = df["lesividad"].fillna("").astype(str).str.lower().str.contains("fallecido|muerto")
    df["is_cyclist"] = df["tipo_vehiculo"].fillna("").astype(str).str.lower().str.contains("bici")
    df["is_pedestrian"] = df["tipo_persona"].fillna("").astype(str).str.lower().str.contains("peato")

    def _to_bool(val):
        if pd.isna(val): return None
        s = str(val).strip().upper()
        return s == 'S' or s == '1' or s == 'TRUE'

    # Aggregation for main table
    grouped = df.groupby("num_expediente").agg(
        fecha=("fecha", "first"),
        hora=("hora", "first"),
        calle=("calle", "first"),
        numero=("numero", "first"),
        distrito=("distrito", "first"),
        accident_type=("accident_type", "first"),
        weather=("weather", "first"),
        coordenada_x_utm=("coordenada_x_utm", "first"),
        coordenada_y_utm=("coordenada_y_utm", "first"),
        is_injured=("is_injured", "sum"),
        is_killed=("is_killed", "sum"),
        is_cyclist=("is_cyclist", "sum"),
        is_pedestrian=("is_pedestrian", "sum"),
        total_involved=("num_expediente", "count")
    ).reset_index()

    accidents_to_insert = []
    print(f"   📍 Processing {len(grouped):,} accidents...")
    for _, row in tqdm(grouped.iterrows(), total=len(grouped), desc=f"Transforming {year}"):
        try:
            dt_str = f"{row['fecha']} {row['hora']}"
            timestamp = pd.to_datetime(dt_str, dayfirst=True, errors="coerce")
            
            x_str = str(row["coordenada_x_utm"]).replace(",", ".")
            y_str = str(row["coordenada_y_utm"]).replace(",", ".")
            if x_str == 'nan' or y_str == 'nan':
                lon, lat = None, None
            else:
                x, y = float(x_str), float(y_str)
                lon, lat = transformer.transform(x, y)
        except Exception:
            timestamp, lat, lon = None, None, None

        accidents_to_insert.append((
            city_id,
            str(row["num_expediente"]),
            timestamp,
            row["calle"],
            row["numero"],
            row["distrito"],
            row["accident_type"],
            row["weather"],
            f"SRID=4326;POINT({lon} {lat})" if lat and lon else None,
            int(row["total_involved"]),
            int(row["is_injured"]),
            int(row["is_killed"]),
            int(row["is_cyclist"]),
            int(row["is_pedestrian"])
        ))

    print(f"   🔌 Ingesting into DB...")
    with conn.cursor() as cur:
        from psycopg2.extras import execute_values
        
        # 1. Upsert accidents
        execute_values(cur, """
            INSERT INTO accidents (
                city_id, accident_id, timestamp, street, street_number,
                district, accident_type, weather, geom, total_involved, injured,
                killed, cyclists_involved, pedestrians_involved
            )
            VALUES %s
            ON CONFLICT (city_id, accident_id) DO UPDATE SET
                timestamp = EXCLUDED.timestamp,
                street = EXCLUDED.street,
                street_number = EXCLUDED.street_number,
                district = EXCLUDED.district,
                accident_type = EXCLUDED.accident_type,
                weather = EXCLUDED.weather,
                geom = EXCLUDED.geom,
                total_involved = EXCLUDED.total_involved,
                injured = EXCLUDED.injured,
                killed = EXCLUDED.killed,
                cyclists_involved = EXCLUDED.cyclists_involved,
                pedestrians_involved = EXCLUDED.pedestrians_involved
        """, accidents_to_insert)

        # 2. Link to closest edge
        print("   🔗 Linking to nearest edges...")
        cur.execute("""
            UPDATE accidents 
            SET closest_edge_id = (
                SELECT e.id 
                FROM edges e 
                WHERE e.city_id = accidents.city_id 
                ORDER BY e.geom <-> accidents.geom 
                LIMIT 1
            )
            WHERE city_id = %s AND geom IS NOT NULL AND closest_edge_id IS NULL
        """, (city_id,))

        # 3. Ingest participants
        print("   👥 Ingesting participants...")
        cur.execute("SELECT id, accident_id FROM accidents WHERE city_id = %s", (city_id,))
        id_map = {acc_id: db_id for db_id, acc_id in cur.fetchall()}

        participants_to_insert = []
        for _, p in df.iterrows():
            acc_id = str(p["num_expediente"])
            if acc_id in id_map:
                participants_to_insert.append((
                    id_map[acc_id],
                    p.get("tipo_persona"),
                    p.get("rango_edad"),
                    p.get("sexo"),
                    p.get("tipo_vehiculo"),
                    p.get("lesividad"),
                    p.get("cod_lesividad") if pd.notna(p.get("cod_lesividad")) else None,
                    _to_bool(p.get("positiva_alcohol")),
                    _to_bool(p.get("positiva_droga")),
                    p.get("accident_type")
                ))
        
        unique_accidents_in_batch = [str(r[1]) for r in accidents_to_insert]
        cur.execute("""
            DELETE FROM accident_participants 
            WHERE accident_db_id IN (
                SELECT id FROM accidents WHERE city_id = %s AND accident_id = ANY(%s)
            )
        """, (city_id, unique_accidents_in_batch))

        execute_values(cur, """
            INSERT INTO accident_participants (
                accident_db_id, person_type, age_range, sex, vehicle_type, 
                injury_status, injury_code, alcohol_positive, drugs_positive, accident_type
            )
            VALUES %s
        """, participants_to_insert)

    conn.commit()
    return len(accidents_to_insert)

def parse_args():
    parser = argparse.ArgumentParser(description="Madrid Traffic Accidents Loader")
    parser.add_argument("--years", nargs="+", type=int, choices=sorted(ACCIDENT_URLS.keys()), help="Years to process")
    parser.add_argument("--force", action="store_true", help="Force re-ingestion")
    return parser.parse_args()

def main():
    load_dotenv()
    args = parse_args()
    conn = connect_db()
    city_id = get_or_create_city(conn, "Madrid")
    
    PROCESS_NAME = "050_load_madrid_accidents"
    upsert_ingestion_status(conn, PROCESS_NAME, "RUNNING", city_id=city_id)

    try:
        years = args.years or sorted(ACCIDENT_URLS.keys())
        total = 0
        for year in years:
            year_str = str(year)
            year_status = get_ingestion_status(conn, PROCESS_NAME, city_id=city_id, time_period=year_str)
            if year_status and year_status.get("status") == "SUCCESS" and not args.force:
                print(f"\n🚜 Skipping year {year}: already processed. Use --force to override.")
                continue

            upsert_ingestion_status(conn, PROCESS_NAME, "RUNNING", city_id=city_id, time_period=year_str)
            print(f"\n🚜 Processing accidents for year {year}...")
            n = process_accidents_year(conn, city_id, year, force=args.force)
            total += n
            upsert_ingestion_status(conn, PROCESS_NAME, "SUCCESS", city_id=city_id, time_period=year_str)

        upsert_ingestion_status(conn, PROCESS_NAME, "SUCCESS", city_id=city_id)
        print(f"\n🏁 Finished! {total:,} accidents ingested for Madrid.")
        
    except Exception as exc:
        upsert_ingestion_status(conn, PROCESS_NAME, "FAILED", city_id=city_id)
        print(f"❌ Error: {exc}")
        raise
    finally:
        conn.commit()
        conn.close()

if __name__ == "__main__":
    main()
