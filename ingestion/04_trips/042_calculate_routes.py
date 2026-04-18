"""
10_compute_routes_optimized.py
Optimized route calculation script (Phase 2).
Groups trips by origin-destination pairs to avoid redundant path computations.
"""

import sys
import argparse
import os
from pathlib import Path
from tqdm import tqdm
from dotenv import load_dotenv
from concurrent.futures import ProcessPoolExecutor
import networkx as nx
import osmnx as ox

sys.path.append(str(Path(__file__).resolve().parents[2]))
from backend.database.db_io import (
    connect_db, 
    get_all_cities, 
    get_unprocessed_route_groups, 
    get_edge_id_map, 
    put_route_edges_with_order,
    mark_routes_processed,
    upsert_edge_traffic_for_city,
    count_unprocessed_routes,
    upsert_ingestion_status,
    check_prerequisites
)
from backend.processing.city_ops import build_graph
from backend.processing.route_strategy import shortest_path

# Global graph for workers to avoid re-pickling
worker_graph = None

def init_worker(graph):
    global worker_graph
    worker_graph = graph

def compute_path_worker(args):
    """Worker function to compute a single path."""
    origin_node, dest_node, strategy = args
    try:
        if strategy != "shortest":
            return None
        return shortest_path(worker_graph, origin_node, dest_node)
    except Exception:
        return None



def process_city_routes(conn, city_id: int, city_name: str, batch_size: int = 500,
                        num_workers: int | None = None, max_distance: float = 150.0, force: bool = False):
    if num_workers is None:
        num_workers = min(os.cpu_count() or 4, 16)
        
    print(f"\n🚀 Processing optimized routes for {city_name} (ID: {city_id}) with {num_workers} workers...")
    
    pname = "042_calculate_routes"
    upsert_ingestion_status(conn, pname, "RUNNING", city_id=city_id)
    try:
        if force:
            print(f"   ⚠️  Force mode: Resetting processed flag for all routes in {city_name}...")
            with conn.cursor() as cur:
                # Only reset the processed flag, never clear origin/dest nodes
                cur.execute("UPDATE routes SET processed = FALSE WHERE city_id = %s AND strategy = 'shortest'", (city_id,))
            conn.commit()

        graph: nx.MultiDiGraph | None = None
        
        # Check current count of unprocessed routes (with nodes filled)
        pending = count_unprocessed_routes(conn, city_id)
        print(f"   📥 Found {pending:,} unprocessed routes with nodes.")
        
        total_trips_processed = 0
        total_unique_paths_computed = 0
        
        if pending == 0:
            print("   ✨ Nothing to process for routes.")
        else:
            if graph is None:
                print("   🌐 Building graph...")
                graph = build_graph(conn, city_id)
            
            print("   🗺️ Loading edge map...")
            edge_id_map = get_edge_id_map(conn, city_id)
            print(f"   📊 Loaded {len(edge_id_map):,} edges.")
            
            import sys as _sys, time as _time
            print("   ⏳ Spawning worker pool...", flush=True); _t0 = _time.time()
            with ProcessPoolExecutor(max_workers=num_workers, initializer=init_worker, initargs=(graph,)) as executor:
                print(f"   ✅ Worker pool ready in {_time.time()-_t0:.1f}s", flush=True)
                while True:
                    # Get groups of routes sharing same (origin, dest, strategy)
                    print("   ⏳ Fetching route groups from DB...", flush=True); _t1 = _time.time()
                    groups = get_unprocessed_route_groups(conn, city_id, limit=batch_size)
                    print(f"   ✅ Fetched {len(groups)} groups in {_time.time()-_t1:.1f}s", flush=True)
                    if not groups:
                        break
                        
                    # Prepare tasks for workers
                    tasks = [(g[0], g[1], g[2]) for g in groups]
                    
                    # Parallel computation of paths
                    results = list(executor.map(compute_path_worker, tasks))
                    
                    route_edges_batch = []
                    all_processed_route_ids = []
            
                    pbar = tqdm(zip(groups, results), total=len(groups), desc=f"   Processing batch (Total Trips: {total_trips_processed:,})", unit="pairs")
                    for (origin_node, dest_node, strategy, count, route_ids), path in pbar:
                        if path:
                            total_unique_paths_computed += 1
                            # Convert to edge IDs with order
                            edge_sequence = []
                            for i, (u, v) in enumerate(zip(path[:-1], path[1:])):
                                edge_id = edge_id_map.get((u, v))
                                if edge_id:
                                    edge_sequence.append((edge_id, i))
                            
                            # Assign this sequence to all route_ids in the group
                            for rid in route_ids:
                                for edge_id, order in edge_sequence:
                                    route_edges_batch.append((rid, edge_id, order))
                                all_processed_route_ids.append(rid)
                        else:
                            # Mark as processed if no path found (to avoid infinite loops)
                            all_processed_route_ids.extend(route_ids)
                    
                    # Save batch results
                    if route_edges_batch:
                        put_route_edges_with_order(conn, route_edges_batch)
                    
                    if all_processed_route_ids:
                        mark_routes_processed(conn, all_processed_route_ids)
                        total_trips_processed += len(all_processed_route_ids)
                        
                    if len(groups) < batch_size:
                        break

        savings = 0
        if total_trips_processed > 0:
            savings = (1 - (total_unique_paths_computed / total_trips_processed)) * 100
            
        print(f"   🔄 Updating edge traffic...")
        upsert_edge_traffic_for_city(conn, city_id, city_name)
            
        print(f"   ✅ Finished {city_name}.")
        print(f"   📊 Trips Processed: {total_trips_processed:,}")
        print(f"   🧠 Unique Paths Computed: {total_unique_paths_computed:,}")
        print(f"   📉 Computation Savings: {savings:.1f}%")

        upsert_ingestion_status(conn, pname, "SUCCESS", city_id=city_id)

    except Exception as e:
        conn.rollback()
        upsert_ingestion_status(conn, pname, "FAILED", city_id=city_id)
        print(f"❌ Error processing routes or traffic for {city_name}: {e}")

def main():
    load_dotenv()
    parser = argparse.ArgumentParser(description="Optimized Batch Route Computation")
    parser.add_argument("--city", help="City name (optional)")
    parser.add_argument("--batch", type=int, default=1000, help="Batch size for fetching route groups")
    parser.add_argument("--workers", type=int, help="Number of workers (default: CPU count)")
    parser.add_argument("--max-distance", "-d", type=float, default=150.0,
                        help="Max distance (m) to snap trip endpoints to nearest graph node")
    parser.add_argument("--force", action="store_true", help="Force re-computation of ALL routes (resets processed status)")
    args = parser.parse_args()

    try:
        conn = connect_db()
    except Exception as e:
        print(f"❌ DB Connection failed: {e}")
        return

    cities = get_all_cities(conn)
    
    target_cities = []
    if args.city:
        target_cities = [c for c in cities if c[1].lower() == args.city.lower()]
        if not target_cities:
            print(f"❌ City '{args.city}' not found.")
            return
    else:
        target_cities = cities

    for city_id, name, *_ in target_cities:
        missing = check_prerequisites(conn, ["041_generate_trips"], city_id=city_id)
        if missing:
            print(f"⚠️  Skipping '{name}': prerequisites not met: {missing}")
            continue

        process_city_routes(conn, city_id, name, batch_size=args.batch,
                            num_workers=args.workers, max_distance=args.max_distance, force=args.force)

    print("\n🏁 Phase 2 Route Computation Finished.")
    conn.commit()
    conn.close()

if __name__ == "__main__":
    main()
