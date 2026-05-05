"""
02_load_osm.py
Loads OSM network and features for all cities currently in the database.
"""
import time
from datetime import timedelta
from pathlib import Path
import sys
import argparse
from dotenv import load_dotenv
import geopandas as gpd

# Add project root to python path
sys.path.append(str(Path(__file__).resolve().parents[2]))

from backend.processing import load_graph, extract_nodes, extract_edges
from backend.processing.feature_ops import extract_features_for_network, FEATURE_TYPES, CALCULATED_FEATURES
from backend.database.db_io import (
    connect_db, get_all_cities, get_city_center,
    get_nodes, get_edges, put_nodes, put_edges,
    put_features, count_features,
    get_ingestion_status, upsert_ingestion_status, check_prerequisites,
    refresh_city_modes
)
from datetime import datetime, timezone
import osmnx as ox
ox.settings.cache_folder = str(Path(__file__).resolve().parents[2] / "data" / "osm_cache")
ox.settings.use_cache = True


def compute_and_store_building_counts(conn, city_id: int, bike_paths_gdf, buildings_gdf):
    """Compute building_count for each cycleway edge using in-memory GeoDataFrames.

    For each cycleway edge: count buildings within 150m buffer and
    UPDATE edges table with building_count. Avoids expensive runtime
    spatial joins on every API request.
    """
    if bike_paths_gdf is None or buildings_gdf is None:
        return

    # Create 150m buffer around bike paths
    bike_paths_metric = bike_paths_gdf.to_crs(epsg=3857)
    bike_paths_buffer = gpd.GeoDataFrame(
        geometry=bike_paths_metric.buffer(150),
        crs='EPSG:3857'
    ).to_crs(epsg=4326)

    # Spatial join to find buildings in buffer
    buildings_in_buffer = gpd.sjoin(
        buildings_gdf, bike_paths_buffer, how='inner', predicate='intersects'
    )

    # Count buildings per edge (assuming bike_paths_gdf has an 'id' column for edges)
    if not buildings_in_buffer.empty:
        # Group by edge and count
        edge_building_counts = buildings_in_buffer.groupby(level=0).size()

        # Update edges in database with counts
        with conn.cursor() as cur:
            for edge_id, count in edge_building_counts.items():
                cur.execute(
                    "UPDATE edges SET building_count = %s WHERE id = %s AND city_id = %s",
                    (int(count), edge_id, city_id),
                )

def main():
    parser = argparse.ArgumentParser(description="Load OSM network and features")
    parser.add_argument("--force", action="store_true", help="Force re-download even if downloaded within 365 days")
    parser.add_argument("--city", type=str, help="Filter by city name (case-insensitive)")
    args = parser.parse_args()

    load_dotenv()
    
    start_total = time.perf_counter()
    try:
        conn = connect_db()
    except Exception as exc:  # noqa: BLE001
        print(f"❌ Could not connect to DB: {exc}")
        return
    
    cities = get_all_cities(conn)
    if not cities:
        print("❌ No cities found in database. Run 01_load_cities.py first.")
        conn.commit()
        conn.close()
        return
        
    print(f"📊 Found {len(cities)} cities to process.")
        
    for city_row in cities:
        city_id, city_name, *rest = city_row
        
        if args.city and args.city.lower() not in city_name.lower():
            continue
            
        print(f"\n==============================================")
        print(f"🗺  Processing OSM Data for {city_name} (ID: {city_id})")
        print(f"==============================================")
        
        center = get_city_center(conn, city_id)
        if not center:
            print(f"❌ Missing geographic data for {city_name}, skipping.")
            continue

        missing = check_prerequisites(conn, ["010_load_cities"], city_id=city_id)
        if missing:
            print(f"⚠️  Skipping '{city_name}': prerequisites not met: {missing}")
            continue

        pname = "020_load_osm"
        status = get_ingestion_status(conn, pname, city_id=city_id)
        if status and status.get("status") == "SUCCESS" and not args.force:
            updated_at = status.get("updated_at")
            if updated_at:
                now = datetime.now(tz=timezone.utc)
                diff = now - updated_at
                if diff.days <= 365:
                    print(f"⏭️  Skipping {city_name}: OSM data already ingested within the last 12 months ({updated_at.strftime('%Y-%m-%d')}). Use --force to override.")
                    continue
            
        center_lat, center_lon, radius = center
        
        upsert_ingestion_status(conn, pname, "RUNNING", city_id=city_id)
        try:
            print(f"▶️  Downloading graph for '{city_name}' …", end=" ", flush=True)
            start_dl = time.perf_counter()
            G = load_graph(city_name, dist=radius, lat=center_lat, lon=center_lon)
            dl_time = timedelta(seconds=time.perf_counter() - start_dl)
            print(f"done ({dl_time}) — {G.number_of_nodes():,} nodes / {G.number_of_edges():,} edges")
            
            # Existing counts
            pre_nodes = len(get_nodes(conn, city_id))
            pre_edges = len(get_edges(conn, city_id))
            
            # Try inserting nodes and edges
            put_nodes(conn, extract_nodes(G, city_id))
            put_edges(conn, extract_edges(G, city_id))
            
            added_nodes = len(get_nodes(conn, city_id)) - pre_nodes
            added_edges = len(get_edges(conn, city_id)) - pre_edges
            print(f"✅ Added {added_nodes:,} nodes and {added_edges:,} edges.")
            
            print(f"▶️  Extracting features for '{city_name}' …")
            start_features = time.perf_counter()
            features_data, extracted_features = extract_features_for_network(city_id, center_lat, center_lon, radius)
            features_time = timedelta(seconds=time.perf_counter() - start_features)

            if features_data:
                print(f"▶️  Storing {len(features_data):,} features...")
                put_features(conn, city_id, features_data)
                print(f"✅ Features stored successfully ({features_time})")

                # Compute building_count for edges using in-memory bike_path_buildings
                print(f"▶️  Computing building_count for edges...")
                start_building_count = time.perf_counter()
                bike_paths = extracted_features.get('bike_paths')
                buildings = extracted_features.get('buildings')
                compute_and_store_building_counts(conn, city_id, bike_paths, buildings)
                building_count_time = timedelta(seconds=time.perf_counter() - start_building_count)
                print(f"✅ Building counts computed ({building_count_time})")

                # Print feature counts by type
                all_feature_types = list(FEATURE_TYPES.keys()) + list(CALCULATED_FEATURES.keys())
                for feature_type in all_feature_types:
                    count = count_features(conn, city_id, feature_type)
                    if count > 0:
                        print(f"   • {feature_type}: {count:,}")


            refresh_city_modes(conn, city_id)
            print(f"✅ Finished updating {city_name} and its modes")
            upsert_ingestion_status(conn, pname, "SUCCESS", city_id=city_id)
        except Exception as e:
            upsert_ingestion_status(conn, pname, "FAILED", city_id=city_id)
            print(f"❌ Error processing OSM Data for {city_name}: {e}")
                    
    conn.commit()
    conn.close()
    
    total_time = timedelta(seconds=time.perf_counter() - start_total)
    print(f"\n🏁 Finished processing all cities in {total_time}.")

if __name__ == "__main__":
    main()
