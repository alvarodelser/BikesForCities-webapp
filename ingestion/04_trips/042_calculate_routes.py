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
    upsert_ingestion_status
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


def snap_nodes_for_city(
    conn,
    city_id: int,
    graph: nx.MultiDiGraph,
    max_distance: float = 150.0,
    batch_size: int = 5_000,
) -> int:
    """
    For all unprocessed routes where origin_node / dest_node are NULL,
    snap origin_lat/lon and dest_lat/lon to the nearest graph node.
    Rows that fall further than *max_distance* (metres) from any node are
    discarded (marked processed=TRUE with no edge data so they are ignored
    by downstream steps).
    Returns the number of rows updated.
    """
    updated_total = 0
    while True:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, origin_lat, origin_lon, dest_lat, dest_lon
                FROM routes
                WHERE city_id = %s
                  AND processed = FALSE
                  AND origin_node IS NULL
                  AND origin_lat IS NOT NULL
                LIMIT %s
                """,
                (city_id, batch_size),
            )
            rows = cur.fetchall()

        if not rows:
            break

        to_update: list[tuple] = []   # (origin_node, dest_node, route_id)
        to_discard: list[int] = []    # route_ids too far from graph

        for route_id, olat, olon, dlat, dlon in rows:
            try:
                on = ox.distance.nearest_nodes(graph, olon, olat)
                dn = ox.distance.nearest_nodes(graph, dlon, dlat)

                # Distance check
                og = (graph.nodes[on]["x"], graph.nodes[on]["y"])
                dg = (graph.nodes[dn]["x"], graph.nodes[dn]["y"])
                d1 = ox.distance.great_circle(olat, olon, og[1], og[0])
                d2 = ox.distance.great_circle(dlat, dlon, dg[1], dg[0])

                if d1 > max_distance or d2 > max_distance:
                    to_discard.append(route_id)
                else:
                    to_update.append((on, dn, route_id))
            except Exception:
                to_discard.append(route_id)

        if to_update:
            from psycopg2.extras import execute_values
            with conn.cursor() as cur:
                execute_values(
                    cur,
                    """
                    UPDATE routes AS r SET
                        origin_node = v.origin_node,
                        dest_node   = v.dest_node
                    FROM (VALUES %s) AS v(origin_node, dest_node, id)
                    WHERE r.id = v.id
                    """,
                    to_update,
                    template="(%s::bigint, %s::bigint, %s::int)",
                )

        if to_discard:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE routes SET processed = TRUE WHERE id = ANY(%s)",
                    (to_discard,),
                )

        conn.commit()
        updated_total += len(to_update) + len(to_discard)
        print(f"   📍 Snapped {len(to_update):,} routes, "
              f"discarded {len(to_discard):,} (too far)")

    return updated_total

def process_city_routes(conn, city_id: int, city_name: str, batch_size: int = 500,
                        num_workers: int | None = None, max_distance: float = 150.0):
    if num_workers is None:
        num_workers = os.cpu_count() or 4
        
    print(f"\n🚀 Processing optimized routes for {city_name} (ID: {city_id}) with {num_workers} workers...")
    
    upsert_ingestion_status(conn, city_id, "calculate madrid traffic details:shortest", "RUNNING")
    upsert_ingestion_status(conn, city_id, "compute est. traffic", "RUNNING")
    try:
        # Build graph (needed for both snapping and path computation)
        pending_snap_check: int
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) FROM routes WHERE city_id=%s AND processed=FALSE AND origin_node IS NULL",
                (city_id,)
            )
            pending_snap_check = cur.fetchone()[0]

        graph: nx.MultiDiGraph | None = None
        if pending_snap_check > 0:
            print(f"   📍 {pending_snap_check:,} routes need node snapping. Building graph...")
            graph = build_graph(conn, city_id)
            snapped = snap_nodes_for_city(conn, city_id, graph,
                                          max_distance=max_distance)
            print(f"   ✅ Snapping complete ({snapped:,} rows processed)")
        
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
            
            with ProcessPoolExecutor(max_workers=num_workers, initializer=init_worker, initargs=(graph,)) as executor:
                while True:
                    # Get groups of routes sharing same (origin, dest, strategy)
                    groups = get_unprocessed_route_groups(conn, city_id, limit=batch_size)
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

        upsert_ingestion_status(conn, city_id, "calculate madrid traffic details:shortest", "SUCCESS")
        upsert_ingestion_status(conn, city_id, "compute est. traffic", "SUCCESS")

    except Exception as e:
        upsert_ingestion_status(conn, city_id, "calculate madrid traffic details:shortest", "FAILED")
        upsert_ingestion_status(conn, city_id, "compute est. traffic", "FAILED")
        print(f"❌ Error processing routes or traffic for {city_name}: {e}")

def main():
    load_dotenv()
    parser = argparse.ArgumentParser(description="Optimized Batch Route Computation")
    parser.add_argument("--city", help="City name (optional)")
    parser.add_argument("--batch", type=int, default=1000, help="Batch size for fetching route groups")
    parser.add_argument("--workers", type=int, help="Number of workers (default: CPU count)")
    parser.add_argument("--max-distance", "-d", type=float, default=150.0,
                        help="Max distance (m) to snap trip endpoints to nearest graph node")
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
        process_city_routes(conn, city_id, name, batch_size=args.batch,
                            num_workers=args.workers, max_distance=args.max_distance)

    print("\n🏁 Phase 2 Route Computation Finished.")
    conn.close()

if __name__ == "__main__":
    main()
