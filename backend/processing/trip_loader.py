import ast
from pathlib import Path
from typing import List, Union, Callable
import re
import osmnx as ox
import networkx as nx
from .route_strategy import shortest_path
import json
import pandas as pd
from tqdm import tqdm
from backend.database.db_io import count_trips, get_edge_id_map
from backend.database.db_io.trips import put_trips

PROJECT_ROOT = Path(__file__).resolve().parents[2]
LOG_PATH = PROJECT_ROOT / "logs" / "ingestion_log.json"
DATA_DIR = PROJECT_ROOT / "data"

# Third-party
import osmnx as ox

# ---------------------------------------------------------------------------
# Local data helpers
# ---------------------------------------------------------------------------

_CITY_CACHE: Union[dict[str, dict], None] = None

def _load_city_data() -> dict[str, dict]:
    """Lazy-load and cache the Spain city coordinate JSON."""

    global _CITY_CACHE  # noqa: PLW0603 – intentional module-level cache
    if _CITY_CACHE is None:
        json_path = PROJECT_ROOT / "data" / "spain_data.json"
        with open(json_path) as fh:
            _CITY_CACHE = json.load(fh)
    return _CITY_CACHE

def load_graph(
    city_name: str,
    dist: int = 10_000,
    lat: float = None,
    lon: float = None,
) -> nx.MultiDiGraph:
    """Download the bike network around *city_name*.

    If *lat*/*lon* are provided they are used directly; otherwise they are
    looked up from ``data/spain_data.json`` by *city_name* key.
    """

    if lat is None or lon is None:
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
    # Keep only the largest strongly connected component
    G_largest = ox.truncate.largest_component(G_full, strongly=True)

    # Consolidate nearby intersection nodes (e.g. roundabouts, wide crossings)
    # into single representative nodes. Must project to metric CRS first so the
    # tolerance (metres) is meaningful, then project back to EPSG:4326.
    G_projected = ox.project_graph(G_largest)
    G_consolidated = ox.consolidate_intersections(
        G_projected, tolerance=10, rebuild_graph=True, dead_ends=False
    )
    # consolidate_intersections can introduce disconnected components in a directed
    # graph; re-apply largest SCC so all stored nodes are mutually reachable.
    G_consolidated = ox.truncate.largest_component(G_consolidated, strongly=True)
    return ox.project_graph(G_consolidated, to_crs="EPSG:4326")


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


def get_csv_progress(city: str, progress_dict: dict | None = None) -> tuple[int, int, list[str]]:
    """
    Returns (processed_count, total_count, unprocessed_files).
    Progress is binary: a file is either 'done' or pending.
    """
    if progress_dict is not None:
        city_log = progress_dict
    else:
        if not LOG_PATH.exists():
            with open(LOG_PATH, "w") as f:
                json.dump({}, f)
        
        with open(LOG_PATH) as f:
            log: dict = json.load(f)
        city_log = log.get(city, {})

    csv_files = list_trip_csvs(city)
    
    processed_files = []
    unprocessed_files = []
    
    for file in csv_files:
        fname = file.name
        if city_log.get(fname) == "done":
            processed_files.append(fname)
        else:
            unprocessed_files.append(fname)
    
    return len(processed_files), len(csv_files), unprocessed_files


def load_next_csv(city: str, progress_dict: dict | None = None) -> Union[tuple[pd.DataFrame, str], None]:
    """
    Finds the next unprocessed CSV, loads it, and returns (DataFrame, filename).
    Returns None if all files are done.
    """
    if progress_dict is not None:
        city_log = progress_dict
    else:
        with open(LOG_PATH) as f:
            log: dict = json.load(f)
        city_log = log.get(city, {})

    csv_files = list_trip_csvs(city)
    
    for file in csv_files:
        fname = file.name
        if city_log.get(fname) == "done":
            continue

        print(f"📂 Loading {fname}...")
        
        # Load and clean data
        df_raw = pd.read_csv(file, sep=';', usecols=['geolocation_unlock', 'geolocation_lock', 'idTrip', 'idBike', 'trip_minutes', 'unlock_date', 'lock_date'])
        rows_loaded = len(df_raw)
        
        df = df_raw.dropna(subset=['geolocation_unlock', 'geolocation_lock', 'idTrip', 'unlock_date', 'lock_date'])
        df = df[df['geolocation_unlock'] != df['geolocation_lock']]
        rows_after_cleanup = len(df)
        
        print(f"   📊 Loaded {rows_loaded:,} rows, {rows_after_cleanup:,} valid trips ({rows_loaded - rows_after_cleanup:,} filtered out)")
        
        df['geolocation_unlock'] = df['geolocation_unlock'].apply(lambda x: ast.literal_eval(x)['coordinates'])
        df['geolocation_lock'] = df['geolocation_lock'].apply(lambda x: ast.literal_eval(x)['coordinates'])

        return df, fname
            
    return None  # All done


def save_checkpoint(city: str, fname: str, on_checkpoint: Callable | None = None):
    """
    Marks a file as done. If on_checkpoint provided, calls it (e.g. for DB updates).
    Otherwise falls back to local JSON log.
    """
    if on_checkpoint:
        on_checkpoint(city, fname, "done")
    else:
        # Fallback to JSON
        if not LOG_PATH.exists():
            with open(LOG_PATH, "w") as f:
                json.dump({}, f)
                
        with open(LOG_PATH, "r") as f:
            log: dict = json.load(f)

        log.setdefault(city, {})[fname] = "done"

        with open(LOG_PATH, "w") as f:
            json.dump(log, f, indent=2)
    
    print(f"   ✅ Checkpoint saved: {fname} completed")



ROUTE_ALGORITHMS = {
    "shortest": shortest_path
}

def process_all_csvs(
    graph: nx.MultiDiGraph,
    conn,
    city_id: int,
    city: str,
    strategy: str = "shortest",
    max_distance: float = 150.0,
    batch_size: int = 100,
    progress_dict: dict | None = None,
    on_checkpoint: Callable | None = None,
):
    """
    Process all unprocessed CSV files using the provided graph.
    """
    # Check existing trips in database before processing
    existing_routes = count_trips(conn, city_id)
    print(f"📊 Current trips in database: {existing_routes:,}")
    
    # Get file progress overview
    processed_count, total_count, unprocessed_files = get_csv_progress(city, progress_dict=progress_dict)
    print(f"📁 Found {total_count} CSV files for {city}")
    print(f"   ✅ {processed_count} already processed")
    print(f"   🔄 {len(unprocessed_files)} remaining to process")
    
    if len(unprocessed_files) == 0:
        print(f"🎉 All CSV files already processed for {city}")
        return 0
    
    # Process each file
    files_processed_this_session = 0
    for file_num, _ in enumerate(unprocessed_files, 1):
        print(f"\n{'='*60}")
        print(f"📂 Processing file {file_num}/{len(unprocessed_files)} (overall: {processed_count + file_num}/{total_count})")
        
        result = process_single_csv(
            graph, conn, city_id, city, strategy, max_distance, batch_size,
            progress_dict=progress_dict, on_checkpoint=on_checkpoint
        )
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
    city_id: int,
    city: str,
    strategy: str = "shortest",
    max_distance: float = 150.0,
    batch_size: int = 100,
    progress_dict: dict | None = None,
    on_checkpoint: Callable | None = None,
):
    """
    Process the next unprocessed CSV file (backward compatibility).
    Use process_all_csvs() for processing all files.
    """
    return process_single_csv(
        graph, conn, city_id, city, strategy, max_distance, batch_size,
        progress_dict=progress_dict, on_checkpoint=on_checkpoint
    )


def process_single_csv(
    graph: nx.MultiDiGraph,
    conn,
    city_id: int,
    city: str,
    strategy: str = "shortest",
    max_distance: float = 150.0,
    batch_size: int = 100,
    progress_dict: dict | None = None,
    on_checkpoint: Callable | None = None,
):
    """
    Process a single CSV file using the provided graph.
    Checkpointing is per-file (binary done/pending) — no row-level resumption.
    """
    result = load_next_csv(city, progress_dict=progress_dict)
    if result is None:
        return None

    df, fname = result
    total_rows = len(df)
    
    print(f"🚴 Processing {fname}: {total_rows:,} trips")
    print(f"   Strategy: {strategy}, Max distance: {max_distance}m, Batch size: {batch_size}")
    
    routes_batch = []
    routes_processed = 0
    routes_saved = 0
    routes_skipped_distance = 0
    
    pbar = tqdm(range(total_rows), desc=f"Processing {fname}", unit="trips")
    
    for idx in pbar:
        row = df.iloc[idx]
        startpoint = row['geolocation_unlock']
        endpoint = row['geolocation_lock']

        try:
            startnode = ox.distance.nearest_nodes(graph, *startpoint)
            endnode = ox.distance.nearest_nodes(graph, *endpoint)
            start_geom = (graph.nodes[startnode]['x'], graph.nodes[startnode]['y'])
            end_geom = (graph.nodes[endnode]['x'], graph.nodes[endnode]['y'])

            d1 = ox.distance.great_circle(*startpoint, *start_geom)
            d2 = ox.distance.great_circle(*endpoint, *end_geom)

            if d1 > max_distance or d2 > max_distance:
                routes_skipped_distance += 1
                continue
        except Exception:
            continue

        routes_batch.append((
            city_id,
            row["idTrip"],
            startnode,
            endnode,
            float(row["trip_minutes"]),
            row["unlock_date"],
            int(row["idBike"]),
            row["lock_date"],
            'real',
        ))
        routes_processed += 1

        if len(routes_batch) >= batch_size:
            put_trips(conn, routes_batch)
            routes_saved += len(routes_batch)
            routes_batch.clear()
            pbar.set_postfix({'saved': f"{routes_saved:,}"})

    # Flush remaining
    if routes_batch:
        put_trips(conn, routes_batch)
        routes_saved += len(routes_batch)

    pbar.close()

    # Mark file as done only after successful completion
    save_checkpoint(city, fname, on_checkpoint=on_checkpoint)
    if progress_dict is not None:
        progress_dict[fname] = "done"
    
    print(f"✅ Finished processing {fname}")
    print(f"   📊 Routes processed: {routes_processed:,}, saved: {routes_saved:,}")
    if routes_skipped_distance > 0:
        print(f"   ⚠️  Skipped (too far): {routes_skipped_distance:,}")
    total_attempts = routes_processed + routes_skipped_distance
    if total_attempts > 0:
        print(f"   📈 Success rate: {routes_processed / total_attempts * 100:.1f}%")