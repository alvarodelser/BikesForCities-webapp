"""
020_load_osm.py
Loads OSM network and features for all cities currently in the database.

After graph + feature ingestion, computes and stores:
  - edge.component_id     — connected-component rank (0 = GCC)
  - edge.building_count   — bike_path_buildings within 150 m
  - city_metrics GCC fields — gcc_fraction, gcc_km, total_kilometers, n_components
  - features.component_id — building coverage component rank
"""
import time
from datetime import timedelta, datetime, timezone
from pathlib import Path
import sys
import argparse
from dotenv import load_dotenv

import networkx as nx
import pandas as pd
import geopandas as gpd
from shapely.geometry import LineString

sys.path.append(str(Path(__file__).resolve().parents[2]))

from backend.processing import load_graph, extract_nodes, extract_edges
from backend.processing.feature_ops import extract_features_for_network, get_study_area_polygon, FEATURE_TYPES, CALCULATED_FEATURES
from backend.database.db_io import (
    connect_db, get_all_cities, get_city_center,
    get_nodes, get_edges, put_nodes, put_edges,
    put_features, count_features,
    get_ingestion_status, upsert_ingestion_status, check_prerequisites,
    refresh_city_modes,
)

import osmnx as ox
ox.settings.cache_folder = str(Path(__file__).resolve().parents[2] / "data" / "osm_cache")
ox.settings.use_cache = True


# ── Ingestion-time computations ───────────────────────────────────────────────

def compute_edge_stats(conn, city_id: int, G: nx.MultiDiGraph, bike_path_buildings_gdf, study_area=None):
    """Compute component_id and building_count for every cycleway edge and persist.

    Uses the in-memory OSM graph (G) and the bike_path_buildings GeoDataFrame
    so no expensive runtime spatial queries are needed later.

    If study_area (a Shapely Polygon in EPSG:4326) is given, GCC stats and
    building counts are computed only for edges/buildings within that rectangle.
    Edges outside it still receive component_id=-1 and building_count=0.

    Steps:
      1. Build edge GeoDataFrame from all cycleway edges.
      2. Filter to study area (if provided).
      3. Rank connected components by total km within study area (0 = GCC).
      4. Spatial join edge buffers × study-area buildings to count buildings/edge.
      5. Bulk UPDATE edges table.
      6. Store GCC stats into city_modes.
    """
    # ── Step 1: collect all cycleway edges from graph ─────────────────────────
    cycleway_edges = [
        (u, v, k, data)
        for u, v, k, data in G.edges(keys=True, data=True)
        if "cycleway" in str(data.get("highway", ""))
    ]
    if not cycleway_edges:
        print("   ⚠ No cycleway edges found — skipping edge stats computation")
        return

    # Build GeoDataFrame in 4326 (required for study_area intersection test)
    edge_records = []
    for u, v, k, data in cycleway_edges:
        geom = data.get("geometry")
        if not geom:
            geom = LineString([(G.nodes[u]["x"], G.nodes[u]["y"]), (G.nodes[v]["x"], G.nodes[v]["y"])])
        edge_records.append({"u": u, "v": v, "k": k, "geometry": geom})

    all_edges_gdf = gpd.GeoDataFrame(edge_records, crs="EPSG:4326")

    # ── Step 2: restrict to study area ───────────────────────────────────────
    if study_area is not None:
        in_study = all_edges_gdf.geometry.intersects(study_area)
        study_edges_gdf = all_edges_gdf[in_study].copy()
    else:
        study_edges_gdf = all_edges_gdf

    # ── Step 3: connected components within study area ────────────────────────
    UG = nx.Graph()
    for _, row in study_edges_gdf.iterrows():
        u, v, k = row["u"], row["v"], row["k"]
        w = float(G[u][v][k].get("length") or 0)
        if UG.has_edge(u, v):
            UG[u][v]["weight"] = max(UG[u][v]["weight"], w)
        else:
            UG.add_edge(u, v, weight=w)

    if not UG.edges():
        print("   ⚠ No cycleway edges in study area — skipping edge stats")
        return

    components = sorted(
        nx.connected_components(UG),
        key=lambda nodes: sum(UG[u][v]["weight"] for u, v in UG.subgraph(nodes).edges()),
        reverse=True,
    )
    node_to_comp = {node: comp_id for comp_id, nodes in enumerate(components) for node in nodes}

    total_km = sum(d["weight"] for _, _, d in UG.edges(data=True)) / 1000.0
    gcc_nodes = components[0] if components else set()
    gcc_km = sum(UG[u][v]["weight"] for u, v in UG.subgraph(gcc_nodes).edges()) / 1000.0

    # ── Step 4: building_count via GeoDataFrame spatial join ──────────────────
    study_edges_metric = study_edges_gdf.to_crs(epsg=3857)
    study_edges_metric["buffer"] = study_edges_metric.geometry.buffer(150)

    edge_building_counts: dict[tuple, int] = {}
    if bike_path_buildings_gdf is not None and not bike_path_buildings_gdf.empty:
        bldgs = bike_path_buildings_gdf
        if study_area is not None:
            bldgs_mask = bldgs.geometry.intersects(study_area)
            bldgs = bldgs[bldgs_mask]
        if not bldgs.empty:
            buffers_gdf = gpd.GeoDataFrame(
                study_edges_gdf[["u", "v", "k"]].reset_index(drop=True),
                geometry=study_edges_metric["buffer"].values,
                crs="EPSG:3857",
            )
            buildings_metric = bldgs.to_crs(epsg=3857)
            joined = gpd.sjoin(buildings_metric, buffers_gdf, how="inner", predicate="intersects")
            counts = joined.groupby(["u", "v", "k"]).size()
            edge_building_counts = {(u, v, k): int(c) for (u, v, k), c in counts.items()}

    # ── Step 5: fetch DB edge IDs and bulk UPDATE ─────────────────────────────
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id, u, v, k FROM edges WHERE city_id = %s AND highway LIKE '%%cycleway%%'",
            (city_id,),
        )
        db_edges = {(row[1], row[2], row[3]): row[0] for row in cur.fetchall()}

    updates = [
        (
            node_to_comp.get(u, -1),
            edge_building_counts.get((u, v, k), 0),
            db_id,
        )
        for (u, v, k), db_id in db_edges.items()
    ]

    with conn.cursor() as cur:
        cur.executemany(
            "UPDATE edges SET component_id = %s, building_count = %s WHERE id = %s",
            updates,
        )

    print(f"   • Updated {len(updates):,} cycleway edges with component_id + building_count")

    # ── Step 6: persist GCC stats into city_metrics ──────────────────────────
    gcc_fraction = gcc_km / total_km if total_km > 0 else None
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO city_metrics
                (city_id, metric_month, gcc_fraction, gcc_km, total_kilometers, n_components, updated_at)
            VALUES (%s, NOW(), %s, %s, %s, %s, NOW())
            ON CONFLICT (city_id, metric_month) DO UPDATE SET
                gcc_fraction     = EXCLUDED.gcc_fraction,
                gcc_km           = EXCLUDED.gcc_km,
                total_kilometers = EXCLUDED.total_kilometers,
                n_components     = EXCLUDED.n_components,
                updated_at       = NOW()
            """,
            (city_id, gcc_fraction, round(gcc_km, 3), round(total_km, 3), len(components)),
        )
    print(f"   • GCC stats: {len(components)} components, {total_km:.1f} km total, "
          f"{gcc_km:.1f} km GCC ({100*gcc_km/total_km:.1f}%)" if total_km > 0 else "")


def compute_building_component_ids(conn, city_id: int, bike_paths_gdf, bike_path_buildings_gdf, study_area=None):
    """Assign component_id to each bike_path_buildings feature using in-memory spatial ops.

    Buffers bike_path features by 150 m (restricted to study_area if provided),
    unions them into connectivity regions, ranks by area (0 = largest), then
    spatial-joins ALL buildings to those regions.
    Buildings outside the study area get component_id = -1 naturally since they
    won't intersect any in-study-area buffer region.
    Stores result in features.component_id.
    """
    if bike_paths_gdf is None or bike_paths_gdf.empty:
        return
    if bike_path_buildings_gdf is None or bike_path_buildings_gdf.empty:
        return

    # Restrict bike paths to study area (defines which connectivity regions exist)
    if study_area is not None and not bike_paths_gdf.empty:
        mask = bike_paths_gdf.geometry.intersects(study_area)
        bike_paths_gdf = bike_paths_gdf[mask]
        if bike_paths_gdf.empty:
            print("   ⚠ No bike paths in study area — skipping building component_ids")
            return

    # Buffer bike paths and dissolve into connectivity regions
    paths_metric = bike_paths_gdf.to_crs(epsg=3857)
    buffered = paths_metric.buffer(150)
    from shapely.ops import unary_union
    from shapely.geometry import MultiPolygon
    import geopandas as gpd

    union = unary_union(buffered)
    if union.is_empty:
        return

    polys = list(union.geoms) if union.geom_type == "MultiPolygon" else [union]
    polys_sorted = sorted(polys, key=lambda p: p.area, reverse=True)

    regions_gdf = gpd.GeoDataFrame(
        {"component_id": range(len(polys_sorted))},
        geometry=polys_sorted,
        crs="EPSG:3857",
    )

    buildings_metric = bike_path_buildings_gdf.to_crs(epsg=3857)
    joined = gpd.sjoin(buildings_metric, regions_gdf, how="left", predicate="intersects")
    # Take minimum component_id if a building touches multiple regions
    comp_by_orig_idx = joined.groupby(joined.index)["component_id"].min()

    # Fetch DB feature IDs for bike_path_buildings in this city (in insertion order)
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id FROM features WHERE city_id = %s AND feature_type = 'bike_path_buildings' ORDER BY id",
            (city_id,),
        )
        db_ids = [row[0] for row in cur.fetchall()]

    if len(db_ids) != len(bike_path_buildings_gdf):
        print(f"   ⚠ Building count mismatch (db={len(db_ids)}, gdf={len(bike_path_buildings_gdf)})")
        print(f"      DB building IDs: {db_ids[:10]}..." if len(db_ids) > 10 else f"      DB building IDs: {db_ids}")
        print(f"      GDF indices: {list(bike_path_buildings_gdf.index[:10])}..." if len(bike_path_buildings_gdf) > 10 else f"      GDF indices: {list(bike_path_buildings_gdf.index)}")
        # Proceed with partial assignment: assign component_ids for indices that exist in GDF
        print(f"      Proceeding with partial assignment for {len(bike_path_buildings_gdf)} buildings...")

    updates = []
    for idx, db_id in zip(bike_path_buildings_gdf.index, db_ids[:len(bike_path_buildings_gdf)]):
        val = comp_by_orig_idx.get(idx, -1)
        comp_id = int(val) if (val != -1 and pd.notna(val)) else -1
        updates.append((comp_id, db_id))

    with conn.cursor() as cur:
        cur.executemany(
            "UPDATE features SET component_id = %s WHERE id = %s",
            updates,
        )
    print(f"   • Assigned component_id to {len(updates):,} bike_path_buildings")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Load OSM network and features")
    parser.add_argument("--force", action="store_true", help="Force re-download even if downloaded within 365 days")
    parser.add_argument("--city", type=str, help="Filter by city name (case-insensitive)")
    args = parser.parse_args()

    load_dotenv()

    start_total = time.perf_counter()
    try:
        conn = connect_db()
    except Exception as exc:
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
                diff = datetime.now(tz=timezone.utc) - updated_at
                if diff.days <= 365:
                    print(f"⏭️  Skipping {city_name}: OSM data ingested {updated_at.strftime('%Y-%m-%d')}. Use --force to override.")
                    continue

        center_lat, center_lon, radius = center

        study_area = get_study_area_polygon(center_lat, center_lon)

        upsert_ingestion_status(conn, pname, "RUNNING", city_id=city_id)
        try:
            # ── Graph ─────────────────────────────────────────────────────────
            print(f"▶️  Downloading graph for '{city_name}' …", end=" ", flush=True)
            start_dl = time.perf_counter()
            G = load_graph(city_name, dist=radius, lat=center_lat, lon=center_lon)
            dl_time = timedelta(seconds=time.perf_counter() - start_dl)
            print(f"done ({dl_time}) — {G.number_of_nodes():,} nodes / {G.number_of_edges():,} edges")

            pre_nodes = len(get_nodes(conn, city_id))
            pre_edges = len(get_edges(conn, city_id))
            put_nodes(conn, extract_nodes(G, city_id))
            put_edges(conn, extract_edges(G, city_id))
            added_nodes = len(get_nodes(conn, city_id)) - pre_nodes
            added_edges = len(get_edges(conn, city_id)) - pre_edges
            print(f"✅ Added {added_nodes:,} nodes and {added_edges:,} edges.")

            # Store pre-computed bounds in cities table (replaces MIN/MAX subquery at query time)
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE cities
                    SET bounds_min_lat = (SELECT MIN(lat) FROM nodes WHERE city_id = %s),
                        bounds_max_lat = (SELECT MAX(lat) FROM nodes WHERE city_id = %s),
                        bounds_min_lon = (SELECT MIN(lon) FROM nodes WHERE city_id = %s),
                        bounds_max_lon = (SELECT MAX(lon) FROM nodes WHERE city_id = %s)
                    WHERE id = %s
                    """,
                    (city_id, city_id, city_id, city_id, city_id),
                )
            print(f"✅ Stored geographic bounds for {city_name}.")

            # ── Features ──────────────────────────────────────────────────────
            print(f"▶️  Extracting features for '{city_name}' …")
            start_features = time.perf_counter()
            features_data, extracted_features = extract_features_for_network(city_id, center_lat, center_lon, radius)
            features_time = timedelta(seconds=time.perf_counter() - start_features)

            if features_data:
                print(f"▶️  Storing {len(features_data):,} features… ({features_time})")
                put_features(conn, city_id, features_data)

                all_feature_types = list(FEATURE_TYPES.keys()) + list(CALCULATED_FEATURES.keys())
                for ft in all_feature_types:
                    c = count_features(conn, city_id, ft)
                    if c > 0:
                        print(f"   • {ft}: {c:,}")

                # ── Pre-compute edge stats (component_id, building_count, GCC) ──
                print(f"▶️  Computing edge stats (component_id, building_count, GCC)…")
                start_stats = time.perf_counter()
                compute_edge_stats(
                    conn, city_id, G,
                    bike_path_buildings_gdf=extracted_features.get("bike_path_buildings"),
                    study_area=study_area,
                )
                print(f"✅ Edge stats done ({timedelta(seconds=time.perf_counter() - start_stats)})")

                # ── Pre-compute building coverage component_ids ────────────────
                print(f"▶️  Computing building coverage component_ids…")
                start_bcomp = time.perf_counter()
                compute_building_component_ids(
                    conn, city_id,
                    bike_paths_gdf=extracted_features.get("bike_paths"),
                    bike_path_buildings_gdf=extracted_features.get("bike_path_buildings"),
                    study_area=study_area,
                )
                print(f"✅ Building component_ids done ({timedelta(seconds=time.perf_counter() - start_bcomp)})")

            refresh_city_modes(conn, city_id)
            print(f"✅ Finished {city_name}")
            upsert_ingestion_status(conn, pname, "SUCCESS", city_id=city_id)

        except Exception as e:
            upsert_ingestion_status(conn, pname, "FAILED", city_id=city_id)
            print(f"❌ Error processing {city_name}: {e}")
            import traceback; traceback.print_exc()

    conn.commit()
    conn.close()

    total_time = timedelta(seconds=time.perf_counter() - start_total)
    print(f"\n🏁 Finished all cities in {total_time}.")


if __name__ == "__main__":
    main()
