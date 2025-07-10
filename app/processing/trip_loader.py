import ast
from pathlib import Path
from typing import List
import re
import osmnx as ox
import networkx as nx
from .route_strategy import shortest_path
import json
import pandas as pd
from tqdm import tqdm
from app.database.network_io import put_routes, count_routes

PROJECT_ROOT = Path(__file__).resolve().parents[2]
LOG_PATH = PROJECT_ROOT / "logs" / "ingestion_log.json"
DATA_DIR = PROJECT_ROOT / "Data"

# Third-party
import osmnx as ox

# ---------------------------------------------------------------------------
# Local data helpers
# ---------------------------------------------------------------------------

_CITY_CACHE: dict[str, dict] | None = None

def _load_city_data() -> dict[str, dict]:
    """Lazy-load and cache the Spain city coordinate JSON."""

    global _CITY_CACHE  # noqa: PLW0603 – intentional module-level cache
    if _CITY_CACHE is None:
        json_path = PROJECT_ROOT / "Data" / "spain_data.json"
        with open(json_path) as fh:
            _CITY_CACHE = json.load(fh)
    return _CITY_CACHE

def load_graph(city_name: str, dist: int = 10_000) -> nx.MultiDiGraph:
    """Download the bike network around *city_name*.

    Latitude/longitude are pulled from ``Data/spain_data.json``.  If the city
    isn't found, a ``ValueError`` is raised.
    """

    city_data = _load_city_data().get(city_name)
    if city_data is None:
        raise ValueError(f"City '{city_name}' not found in spain_data.json")

    lat = city_data["latitude"]
    lon = city_data["longitude"]

    G_full = ox.graph_from_point(
        (lat, lon),
        dist=dist,
        network_type="bike",
    )
    # Get largest strongly connected component
        # strongly=True → good for directed routing, i.e. obeying one-way bike streets
        # strongly=False → e.g. you're ignoring bike rules
    G_largest = ox.truncate.largest_component(G_full, strongly=True)

    return G_largest


TRIP_CSV_PATTERN = re.compile(r"trips_(\d{2})_(\d{2})[^/]*\.csv")
def list_trip_csvs(city: str) -> List[Path]:
    """
    Returns a sorted list of trip CSV files from the directory.
    Matches files like 'trips_YYYY_MM*.csv' (with extra suffix allowed).
    """
    city_dir = DATA_DIR / city
    valid_files: list[tuple[Path, int, int]] = []

    if not city_dir.is_dir():
        raise FileNotFoundError(f"Data directory for city '{city}' not found: {city_dir}")

    for file in city_dir.glob("trips_*.csv"):
        match = TRIP_CSV_PATTERN.fullmatch(file.name)
        if match:
            year = int(match.group(1))
            month = int(match.group(2))
            valid_files.append((file, year, month))

    # Sort by year and month
    valid_files.sort(key=lambda x: (x[1], x[2]))

    return [file for file, _, _ in valid_files]


def get_csv_progress(city: str) -> tuple[int, int, list[str]]:
    """
    Returns (processed_count, total_count, unprocessed_files)
    """
    with open(LOG_PATH) as f:
        log: dict = json.load(f)

    city_log: dict = log.get(city, {})
    csv_files = list_trip_csvs(city)
    
    processed_files = []
    unprocessed_files = []
    
    for file in csv_files:
        fname = file.name
        status = city_log.get(fname, 0)
        if status == "done":
            processed_files.append(fname)
        else:
            unprocessed_files.append(fname)
    
    return len(processed_files), len(csv_files), unprocessed_files


def load_next_csv(city: str) -> tuple[pd.DataFrame, str, int] | None:
    """
    Finds the next CSV to process, loads it, and returns:
    (DataFrame, filename, start_row_index)
    Returns None if all files are done.
    """
    with open(LOG_PATH) as f:
        log: dict = json.load(f)

    city_log: dict = log.get(city, {})
    csv_files = list_trip_csvs(city)
    
    for file in csv_files:
        fname = file.name
        status = city_log.get(fname, 0)
        if status == "done":
            continue
        else:
            start_idx = int(status)
            print(f"📂 Loading {fname} (starting from row {start_idx})...")
            
            # Load and clean data
            df_raw = pd.read_csv(file, sep =';', usecols=['geolocation_unlock', 'geolocation_lock', 'idTrip', 'idBike', 'trip_minutes'])
            rows_loaded = len(df_raw)
            
            df = df_raw.dropna(subset=['geolocation_unlock', 'geolocation_lock', 'idTrip'])
            df = df[df['geolocation_unlock'] != df['geolocation_lock']]
            rows_after_cleanup = len(df)
            
            print(f"   📊 Loaded {rows_loaded:,} rows, {rows_after_cleanup:,} valid trips ({rows_loaded - rows_after_cleanup:,} filtered out)")
            
            df['geolocation_unlock'] = df['geolocation_unlock'].apply(lambda x: ast.literal_eval(x)['coordinates'])
            df['geolocation_lock'] = df['geolocation_lock'].apply(lambda x: ast.literal_eval(x)['coordinates'])

            return df, fname, start_idx
            
    return None  # All done


def save_checkpoint(city: str, fname: str, status: str):
    with open(LOG_PATH, "r") as f:
        log: dict = json.load(f)

    city_log = log.setdefault(city, {})
    city_log[fname] = status

    with open(LOG_PATH, "w") as f:
        json.dump(log, f, indent=2)
    
    # Only print checkpoint completion, not intermediate saves
    if status == "done":
        print(f"   ✅ Checkpoint saved: {fname} completed")



ROUTE_ALGORITHMS = {
    "shortest": shortest_path
}

def process_all_csvs(
    graph: nx.MultiDiGraph,
    conn,
    network_id: int,
    city: str,
    strategy: str = "shortest",
    max_distance: float = 150.0,
    batch_size: int = 100,
):
    """
    Process all unprocessed CSV files using the provided graph.
    """
    # Check existing trips in database before processing
    existing_routes = count_routes(conn, network_id)
    print(f"📊 Current routes in database: {existing_routes:,}")
    
    # Get file progress overview
    processed_count, total_count, unprocessed_files = get_csv_progress(city)
    print(f"📁 Found {total_count} CSV files for {city}")
    print(f"   ✅ {processed_count} already processed")
    print(f"   🔄 {len(unprocessed_files)} remaining to process")
    
    if len(unprocessed_files) == 0:
        print(f"🎉 All CSV files already processed for {city}")
        return None
    
    # Process each file
    files_processed_this_session = 0
    for file_num, _ in enumerate(unprocessed_files, 1):
        print(f"\n{'='*60}")
        print(f"📂 Processing file {file_num}/{len(unprocessed_files)} (overall: {processed_count + file_num}/{total_count})")
        
        result = process_single_csv(graph, conn, network_id, city, strategy, max_distance, batch_size)
        if result is None:
            break
        files_processed_this_session += 1
        
        # Update progress
        processed_count += 1
    
    print(f"\n{'='*60}")
    print(f"🎯 Session complete! Processed {files_processed_this_session} files")
    print(f"📊 Overall progress: {processed_count}/{total_count} files complete")
    
    return files_processed_this_session


# Backward compatibility
def process_next_csv(
    graph: nx.MultiDiGraph,
    conn,
    network_id: int,
    city: str,
    strategy: str = "shortest",
    max_distance: float = 150.0,
    batch_size: int = 100,
):
    """
    Process the next unprocessed CSV file (backward compatibility).
    Use process_all_csvs() for processing all files.
    """
    return process_single_csv(graph, conn, network_id, city, strategy, max_distance, batch_size)


def process_single_csv(
    graph: nx.MultiDiGraph,
    conn,
    network_id: int,
    city: str,
    strategy: str = "shortest",
    max_distance: float = 150.0,
    batch_size: int = 100,
):
    """
    Process a single CSV file using the provided graph.
    """
    checkpoint = load_next_csv(city)
    if checkpoint is None:
        return None

    df, fname, start_idx = checkpoint
    total_rows = len(df)
    remaining_rows = total_rows - start_idx
    
    print(f"🚴 Processing {fname}: {remaining_rows:,} trips remaining (rows {start_idx:,} to {total_rows:,})")
    print(f"   Strategy: {strategy}, Max distance: {max_distance}m, Batch size: {batch_size}")
    
    routes_batch = []
    routes_processed = 0
    routes_saved = 0
    routes_skipped_distance = 0
    routes_skipped_no_path = 0
    
    # Create progress bar
    pbar = tqdm(
        range(start_idx, total_rows), 
        desc=f"Processing {fname}", 
        unit="trips",
        initial=0,
        total=remaining_rows
    )
    
    for idx in pbar:
        row = df.iloc[idx]
        startpoint = (row['geolocation_unlock'])
        endpoint = (row['geolocation_lock'])

        # Get nearest nodes
        startnode = ox.distance.nearest_nodes(graph, *startpoint)
        endnode = ox.distance.nearest_nodes(graph, *endpoint)
        start_geom = (graph.nodes[startnode]['x'], graph.nodes[startnode]['y'])
        end_geom = (graph.nodes[endnode]['x'], graph.nodes[endnode]['y'])

        d1 = ox.distance.great_circle(*startpoint, *start_geom)
        d2 = ox.distance.great_circle(*endpoint, *end_geom)

        # Handle trips that are too far from network
        if d1 > max_distance:
            print(f"❌ ERROR: Origin too far from network (distance={d1:.1f}m) at row {idx}, trip {row['idTrip']} - SKIPPING")
            routes_skipped_distance += 1
            continue
        if d2 > max_distance:
            print(f"❌ ERROR: Destination too far from network (distance={d2:.1f}m) at row {idx}, trip {row['idTrip']} - SKIPPING")
            routes_skipped_distance += 1
            continue

        # Handle trips with no path
        try:
            route = ROUTE_ALGORITHMS[strategy](graph, startnode, endnode)
        except nx.NetworkXNoPath:
            print(f"❌ ERROR: No path between nodes {startnode} and {endnode} at row {idx}, trip {row['idTrip']} - SKIPPING")
            routes_skipped_no_path += 1
            continue

        route_tuple = (
            network_id,
            row["idTrip"],
            startnode,
            endnode,
            strategy,
            float(row["trip_minutes"]),
            None,  # datetime_unlock not available in current CSV subset
            int(row["idBike"]),
        )

        routes_batch.append(route_tuple)
        routes_processed += 1

        # Flush batch and update progress bar
        if len(routes_batch) >= batch_size:
            put_routes(conn, routes_batch)
            routes_saved += len(routes_batch)
            routes_batch.clear()
            
            # Update progress bar description with stats
            pbar.set_postfix({
                'saved': f"{routes_saved:,}",
                'batch': f"{len(routes_batch)}"
            })

        # Update checkpoint (less frequently for performance)
        if idx % 50 == 0 or idx == total_rows - 1:
            status = "done" if idx == total_rows - 1 else str(idx + 1)
            save_checkpoint(city, fname, status)

    # Insert remaining routes
    if routes_batch:
        put_routes(conn, routes_batch)
        routes_saved += len(routes_batch)

    # Close progress bar
    pbar.close()
    
    print(f"✅ Finished processing {fname}")
    print(f"   📊 Total routes processed: {routes_processed:,}")
    print(f"   💾 Total routes saved to database: {routes_saved:,}")
    if routes_skipped_distance > 0:
        print(f"   ⚠️  Skipped (too far): {routes_skipped_distance:,}")
    if routes_skipped_no_path > 0:
        print(f"   ⚠️  Skipped (no path): {routes_skipped_no_path:,}")
    
    total_attempts = routes_processed + routes_skipped_distance + routes_skipped_no_path
    success_rate = (routes_processed / total_attempts * 100) if total_attempts > 0 else 0
    print(f"   📈 Success rate: {success_rate:.1f}% ({routes_processed:,}/{total_attempts:,})")