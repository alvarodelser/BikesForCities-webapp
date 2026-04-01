"""
050_load_madrid_accidents.py
Downloads and ingests Madrid traffic accidents data from Portal de Datos Abiertos.

Source: https://datos.madrid.es/dataset/300228-0-accidentes-trafico-detalle
Format: Annual CSV files.
- 2019+ schema: contains UTM ETRS89 zone 30N (EPSG:25830) coordinates.
- Each row in CSV is a person (driver, passenger, pedestrian).
- We deduplicate by accident_id (num_expediente) and aggregate stats.

Aggregated Fields:
- total_involved: number of rows with same num_expediente
- injured: count of rows where lesividad is not 'Sin asistencia' or 'Ileso'
- killed: count of rows where lesividad contains 'Fallecido' or 'Muerto'
- cyclists_involved: count of rows where tipo_vehiculo contains 'Bicicleta'
- pedestrians_involved: count of rows where tipo_persona is 'Peatón'

Usage:
    python3 ingestion/05_accidents/050_load_madrid_accidents.py
    python3 ingestion/05_accidents/050_load_madrid_accidents.py --years 2023 2024
"""

from __future__ import annotations

import argparse
import io
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
)

# ---------------------------------------------------------------------------
# Accidents Dataset URLs (2019–2024 CSVs)
# ---------------------------------------------------------------------------

ACCIDENT_URLS: dict[int, str] = {
    2019: "https://datos.madrid.es/dataset/300228-0-accidentes-trafico-detalle/resource/300228-11-accidentes-trafico-detalle-csv/download/300228-11-accidentes-trafico-detalle-csv.csv",
    2020: "https://datos.madrid.es/dataset/300228-0-accidentes-trafico-detalle/resource/300228-8-accidentes-trafico-detalle-csv/download/300228-8-accidentes-trafico-detalle-csv.csv",
    2021: "https://datos.madrid.es/dataset/300228-0-accidentes-trafico-detalle/resource/300228-33-accidentes-trafico-detalle-csv/download/300228-33-accidentes-trafico-detalle-csv.csv",
    2022: "https://datos.madrid.es/dataset/300228-0-accidentes-trafico-detalle/resource/300228-5-accidentes-trafico-detalle-csv/download/300228-5-accidentes-trafico-detalle-csv.csv",
    2023: "https://datos.madrid.es/dataset/300228-0-accidentes-trafico-detalle/resource/300228-3-accidentes-trafico-detalle-csv/download/300228-3-accidentes-trafico-detalle-csv.csv",
    2024: "https://datos.madrid.es/dataset/300228-0-accidentes-trafico-detalle/resource/300228-2-accidentes-trafico-detalle-csv/download/300228-2-accidentes-trafico-detalle-csv.csv",
    2025: "https://datos.madrid.es/dataset/300228-0-accidentes-trafico-detalle/resource/300228-1-accidentes-trafico-detalle-csv/download/300228-1-accidentes-trafico-detalle-csv.csv",
}

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = PROJECT_ROOT / "data" / "Madrid" / "accidents"

# ETRS89 / UTM zone 30N (Madrid) -> WGS 4326
transformer = Transformer.from_crs("EPSG:25830", "EPSG:4326", always_xy=True)


# ---------------------------------------------------------------------------
# Download & Parse
# ---------------------------------------------------------------------------

def _download_csv(url: str, desc: str) -> bytes:
    print(f"  ⬇️  Downloading {desc}…")
    resp = requests.get(url, timeout=60)
    resp.raise_for_status()
    return resp.content


def process_accidents_year(conn, city_id: int, year: int, force: bool = False) -> int:
    url = ACCIDENT_URLS.get(year)
    if not url: return 0

    out_file = DATA_DIR / f"accidents_{year}.csv"
    if out_file.exists() and not force:
        print(f"   ⏭️  Accidents for {year} already downloaded.")
        raw = out_file.read_bytes()
    else:
        raw = _download_csv(url, f"Accidents {year}")
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        out_file.write_bytes(raw)

    # Try common separators
    for sep in (";", ","):
        try:
            df = pd.read_csv(io.BytesIO(raw), sep=sep, encoding="utf-8-sig")
            if "num_expediente" in df.columns: break
        except Exception:
            continue
    
    if "num_expediente" not in df.columns:
        print(f"   ❌ Failed to parse CSV for {year}: Missing 'num_expediente'. Columns: {list(df.columns)}")
        return 0

    print(f"   📊 Found {len(df):,} person-records. Aggregating by accident...")

    df.columns = [c.lower().strip().replace(" ", "_") for c in df.columns]

    # Handle schema variations between years
    col_mapping = {
        "localizacion": "calle",
        "estado_meteorológico": "estado_meteorologico",
        "estado_metereológico": "estado_meteorologico",
    }
    df.rename(columns=col_mapping, inplace=True)
    
    # Ensure missing columns exist with None
    for required_col in ["calle", "estado_meteorologico", "numero", "distrito", "tipo_accidente"]:
        if required_col not in df.columns:
            df[required_col] = None
    def _transform(row):
        try:
            x = float(str(row["coordenada_x_utm"]).replace(",", "."))
            y = float(str(row["coordenada_y_utm"]).replace(",", "."))
            if x > 0 and y > 0:
                lon, lat = transformer.transform(x, y)
                return pd.Series([lat, lon])
        except Exception:
            pass
        return pd.Series([None, None])

    # Pre-calculate coordinates for unique accidents only to save time
    coords_map = {}
    unique_ids = df["num_expediente"].unique()
    
    # Custom counts
    df["is_injured"] = ~df["lesividad"].fillna("").astype(str).str.lower().isin(["sin asistencia", "ileso", "", "desconocido"])
    df["is_killed"] = df["lesividad"].fillna("").astype(str).str.lower().str.contains("fallecido|muerto")
    df["is_cyclist"] = df["tipo_vehiculo"].fillna("").astype(str).str.lower().str.contains("bici")
    df["is_pedestrian"] = df["tipo_persona"].fillna("").astype(str).str.lower().str.contains("peato")

    grouped = df.groupby("num_expediente").agg(
        fecha=("fecha", "first"),
        hora=("hora", "first"),
        calle=("calle", "first"),
        numero=("numero", "first"),
        distrito=("distrito", "first"),
        tipo_accidente=("tipo_accidente", "first"),
        estado_meteorologico=("estado_meteorologico", "first"),
        coordenada_x_utm=("coordenada_x_utm", "first"),
        coordenada_y_utm=("coordenada_y_utm", "first"),
        is_injured=("is_injured", "sum"),
        is_killed=("is_killed", "sum"),
        is_cyclist=("is_cyclist", "sum"),
        is_pedestrian=("is_pedestrian", "sum"),
        total_involved=("num_expediente", "count")
    ).reset_index()

    # Convert dates
    grouped["accident_date"] = pd.to_datetime(grouped["fecha"], dayfirst=True, errors="coerce").dt.date
    
    rows_to_insert = []
    print(f"   📍 Converting UTM coordinates...")
    for _, row in tqdm(grouped.iterrows(), total=len(grouped), desc=f"Transforming {year}"):
        try:
            x_str = str(row["coordenada_x_utm"]).replace(",", ".")
            y_str = str(row["coordenada_y_utm"]).replace(",", ".")
            if x_str == 'nan' or y_str == 'nan':
                lat, lon = None, None
            else:
                x, y = float(x_str), float(y_str)
                lon, lat = transformer.transform(x, y)
        except Exception:
            lat, lon = None, None

        rows_to_insert.append((
            city_id,
            str(row["num_expediente"]),
            row["accident_date"],
            row["hora"],
            row["calle"],
            row["numero"],
            row["distrito"],
            row["tipo_accidente"],
            row["estado_meteorologico"],
            lat,
            lon,
            int(row["total_involved"]),
            int(row["is_injured"]),
            int(row["is_killed"]),
            int(row["is_cyclist"]),
            int(row["is_pedestrian"]),
            year
        ))

    print(f"   🔌 Ingesting {len(rows_to_insert):,} accidents into DB...")
    with conn.cursor() as cur:
        from psycopg2.extras import execute_values
        execute_values(cur, """
            INSERT INTO accidents (
                city_id, accident_id, accident_date, accident_time, street, street_number,
                district, accident_type, weather, lat, lon, total_involved, injured,
                killed, cyclists_involved, pedestrians_involved, year, geom
            )
            VALUES %s
            ON CONFLICT (city_id, accident_id) DO UPDATE SET
                accident_date = EXCLUDED.accident_date,
                accident_time = EXCLUDED.accident_time,
                street = EXCLUDED.street,
                street_number = EXCLUDED.street_number,
                district = EXCLUDED.district,
                accident_type = EXCLUDED.accident_type,
                weather = EXCLUDED.weather,
                lat = EXCLUDED.lat,
                lon = EXCLUDED.lon,
                total_involved = EXCLUDED.total_involved,
                injured = EXCLUDED.injured,
                killed = EXCLUDED.killed,
                cyclists_involved = EXCLUDED.cyclists_involved,
                pedestrians_involved = EXCLUDED.pedestrians_involved,
                geom = ST_SetSRID(ST_MakePoint(EXCLUDED.lon, EXCLUDED.lat), 4326)
            WHERE EXCLUDED.lat IS NOT NULL
        """, [(*r, None) for r in rows_to_insert]) # Placeholder for geom (filled by ST_SetSRID in DO UPDATE for new rows too if we use a better query)
    
        # Update geom for new rows correctly
        cur.execute("""
            UPDATE accidents SET geom = ST_SetSRID(ST_MakePoint(lon, lat), 4326)
            WHERE city_id = %s AND year = %s AND geom IS NULL AND lat IS NOT NULL
        """, (city_id, year))
    
    conn.commit()
    return len(rows_to_insert)


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
    
    data_type = "madrid accidents"
    upsert_ingestion_status(conn, city_id, data_type, "RUNNING")
    
    try:
        years = args.years or sorted(ACCIDENT_URLS.keys())
        total = 0
        for year in years:
            print(f"\n🚜 Processing accidents for year {year}...")
            n = process_accidents_year(conn, city_id, year, force=args.force)
            total += n
        
        upsert_ingestion_status(conn, city_id, data_type, "SUCCESS", details={"total_accidents": total, "years": years})
        print(f"\n🏁 Finished! {total:,} accidents ingested for Madrid.")
        
    except Exception as exc:
        upsert_ingestion_status(conn, city_id, data_type, "FAILED")
        print(f"❌ Error: {exc}")
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    main()
