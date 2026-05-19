"""
051_compute_safe_paths.py
Computes safest-path routes for all unrouted trips in the database.

Mirrors 050_compute_shortest_paths.py but uses route_cost as the edge weight
instead of raw length. route_cost(length, peligrosidad_score(...)) makes
cycleways and city-confirmed bike-lane roads cheaper than equally long
busy roads, so the algorithm finds the safest rather than shortest path.

For each city:
1. Find trips that have no routes row pointing to a 'safest' path.
2. Group by unique (origin_node, dest_node) to compute each path once.
3. Compute the safest path on the route_cost-weighted graph.
4. Upsert the path into paths (deduplicated via paths_safest_uq index).
5. Store ordered edge and node sequences in path_edges / path_nodes.
6. Link all trips sharing that O-D to the path via the routes join table.
7. Update edge_traffic aggregates for the city.
"""

import sys
import argparse
import os
from pathlib import Path
from tqdm import tqdm
from dotenv import load_dotenv
from concurrent.futures import ProcessPoolExecutor

sys.path.append(str(Path(__file__).resolve().parents[2]))

from backend.database.db_io import (
    connect_db,
    get_all_cities,
    get_edge_id_map,
    upsert_edge_traffic_for_city,
    upsert_ingestion_status,
    check_prerequisites,
    count_unsaferouted_trips,
    get_unsaferouted_trip_groups,
    get_or_create_safest_path,
    put_path_edges,
    put_path_nodes,
    bulk_link_trips_to_path,
    refresh_city_modes,
)
from backend.processing.city_ops import build_safe_graph
from backend.processing.route_strategy import safe_path

PROCESS_NAME = "051_compute_safe_paths"

worker_graph = None


def init_worker(graph):
    global worker_graph
    worker_graph = graph


def compute_path_worker(args):
    origin_node, dest_node = args
    try:
        return safe_path(worker_graph, origin_node, dest_node)
    except Exception:
        return None


def process_city(conn, city_id: int, city_name: str,
                 batch_size: int = 500, num_workers: int | None = None,
                 force: bool = False):
    if num_workers is None:
        num_workers = min(os.cpu_count() or 4, 16)

    print(f"\n🚀 Computing safe paths for {city_name} (city_id={city_id}) "
          f"with {num_workers} workers...")

    upsert_ingestion_status(conn, PROCESS_NAME, "RUNNING", city_id=city_id)
    try:
        if force:
            print(f"   ⚠️  Force mode: clearing all safest-path routes for {city_name}...")
            with conn.cursor() as cur:
                cur.execute(
                    """
                    DELETE FROM routes r
                    USING trips t, paths p
                    WHERE r.trip_id = t.id
                      AND r.path_id = p.id
                      AND t.city_id = %s
                      AND p.algorithm = 'safest'
                    """,
                    (city_id,),
                )
            conn.commit()

        pending = count_unsaferouted_trips(conn, city_id)
        print(f"   📥 {pending:,} trips without a safest-path route.")

        total_trips_processed = 0
        total_unique_paths = 0

        if pending == 0:
            print("   ✨ Nothing to compute.")
        else:
            print("   🌐 Building safe graph (route_cost weighted)...")
            graph = build_safe_graph(conn, city_id)

            print("   🗺️  Loading edge map...")
            edge_id_map = get_edge_id_map(conn, city_id)
            print(f"   📊 {len(edge_id_map):,} edges loaded.")

            print("   ⏳ Spawning worker pool...")
            with ProcessPoolExecutor(max_workers=num_workers,
                                     initializer=init_worker,
                                     initargs=(graph,)) as executor:
                print("   ✅ Pool ready.")
                while True:
                    groups = get_unsaferouted_trip_groups(conn, city_id, limit=batch_size)
                    if not groups:
                        break

                    tasks = [(g[0], g[1]) for g in groups]
                    results = list(executor.map(compute_path_worker, tasks))

                    pbar = tqdm(
                        zip(groups, results),
                        total=len(groups),
                        desc=f"   Linking (total: {total_trips_processed:,})",
                        unit="OD-pairs",
                    )
                    for (origin_node, dest_node, count, trip_ids), path in pbar:
                        if not path:
                            continue

                        total_unique_paths += 1

                        path_id = get_or_create_safest_path(
                            conn, city_id, int(origin_node), int(dest_node)
                        )

                        edge_seq = [
                            (edge_id_map[(u, v)], i)
                            for i, (u, v) in enumerate(zip(path[:-1], path[1:]))
                            if (u, v) in edge_id_map
                        ]
                        if edge_seq:
                            put_path_edges(conn, path_id, edge_seq)

                        put_path_nodes(conn, path_id, [int(n) for n in path])
                        bulk_link_trips_to_path(conn, city_id, trip_ids, path_id)
                        total_trips_processed += len(trip_ids)

                    conn.commit()

                    if len(groups) < batch_size:
                        break

        if total_trips_processed == 0:
            print("   ✅ Nothing to do.")
        else:
            savings = (1 - total_unique_paths / total_trips_processed) * 100
            print(f"   🔄 Updating edge traffic...")
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT DISTINCT t.generation_type, p.algorithm
                    FROM routes r
                    JOIN trips t ON t.id = r.trip_id
                    JOIN paths p ON p.id = r.path_id
                    WHERE t.city_id = %s AND p.algorithm = 'safest'
                    """,
                    (city_id,),
                )
                combinations = cur.fetchall()
            for gen_type, algo in combinations:
                upsert_edge_traffic_for_city(conn, city_id, city_name, gen_type, algo)
            conn.commit()
            print(f"   ✅ Done – {total_trips_processed:,} trips, "
                  f"{total_unique_paths:,} unique paths, {savings:.1f}% computation saved.")

        if total_trips_processed > 0:
            refresh_city_modes(conn, city_id)
        upsert_ingestion_status(conn, PROCESS_NAME, "SUCCESS", city_id=city_id)

    except Exception as e:
        conn.rollback()
        upsert_ingestion_status(conn, PROCESS_NAME, "FAILED", city_id=city_id)
        print(f"❌ Error for {city_name}: {e}")
        raise


def main():
    load_dotenv()
    parser = argparse.ArgumentParser(description="Compute safest paths for unrouted trips")
    parser.add_argument("--city", help="City name (optional – runs all cities)")
    parser.add_argument("--batch", type=int, default=1000,
                        help="O-D groups fetched per iteration")
    parser.add_argument("--workers", type=int, help="Worker processes (default: CPU count)")
    parser.add_argument("--force", action="store_true",
                        help="Delete existing safest-path routes rows and recompute from scratch")
    args = parser.parse_args()

    try:
        conn = connect_db()
    except Exception as e:
        print(f"❌ DB Connection failed: {e}")
        return

    cities = get_all_cities(conn)
    if args.city:
        target = [c for c in cities if c[1].lower() == args.city.lower()]
        if not target:
            print(f"❌ City '{args.city}' not found.")
            return
    else:
        target = cities

    for city_id, name, *_ in target:
        candidates = ["041_generate_station_trips", "040_load_madrid_trips"]
        has_trips = any(
            not check_prerequisites(conn, [p], city_id=city_id)
            for p in candidates
        )
        if not has_trips:
            print(f"⚠️  Skipping '{name}': no trip ingestion completed yet.")
            continue
        process_city(conn, city_id, name,
                     batch_size=args.batch, num_workers=args.workers, force=args.force)

    print("\n🏁 Safe-path computation finished.")
    conn.commit()
    conn.close()


if __name__ == "__main__":
    main()
