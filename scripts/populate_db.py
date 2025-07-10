"""Populate the database with the street network of a given city.

This script downloads the bike network via OSMnx (or reconstructs it from cache),
extracts nodes/edges, and bulk-inserts them into the `nodes` and `edges` tables.
It prints clear progress messages so you can see what's happening.
"""

from __future__ import annotations

import time
from datetime import timedelta

from dotenv import load_dotenv

from app.processing import extract_edges, extract_nodes, load_graph
from app.processing.feature_ops import (
    extract_features_for_network,
    FEATURE_TYPES,
    CALCULATED_FEATURES
)
from app.database.network_io import (
    connect_db,
    get_or_create_network,
    get_edges,
    get_nodes,
    put_edges,
    put_nodes,
    put_features,
    count_features,
)


from pathlib import Path

_SPAIN_DATA_PATH = Path(__file__).resolve().parents[1] / "Data" / "spain_data.json"


def _load_cities() -> list[str]:
    import json

    with open(_SPAIN_DATA_PATH) as fh:
        data = json.load(fh)
    return sorted(data.keys())


DISTANCE = 15_000  # metres radius around city centre


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def prompt_city() -> str:
    """Ask the user which city to populate and return its name."""

    cities = _load_cities()

    try:
        import questionary  # type: ignore

        answer = questionary.select(
            "Which city do you want to populate?",
            choices=cities,
            default="Madrid",
        ).ask()
        return answer or "Madrid"
    except ModuleNotFoundError:
        print("(questionary not installed – defaulting to Madrid)")
        return "Madrid"





# ---------------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------------


def main() -> None:  # noqa: D401 – simple script entry-point
    start_total = time.perf_counter()

    city = prompt_city()
    
    # Load city data to get center coordinates
    import json
    with open(_SPAIN_DATA_PATH) as fh:
        cities_data = json.load(fh)
    
    city_data = cities_data.get(city)
    if not city_data:
        print(f"❌ City '{city}' not found in spain_data.json")
        return
    
    center_lat = city_data['latitude']
    center_lon = city_data['longitude']

    print(f"▶️  Downloading graph for '{city}' …", end=" ")
    start_dl = time.perf_counter()
    G = load_graph(city, dist=DISTANCE)
    dl_time = timedelta(seconds=time.perf_counter() - start_dl)
    print(f"done ({dl_time}) — {G.number_of_nodes():,} nodes / {G.number_of_edges():,} edges")

    print("▶️  Connecting to Postgres…")
    try:
        conn = connect_db()
    except Exception as exc:  # noqa: BLE001 – show any connection error
        print(f"❌ Could not connect to DB: {exc}")
        return

    # Store center point and radius in networks table
    network_id = get_or_create_network(conn, city, center_lat=center_lat, center_lon=center_lon, radius=DISTANCE)
    print(f"   ✔ network_id = {network_id} ({city}) - center: ({center_lat:.4f}, {center_lon:.4f}), radius: {DISTANCE/1000:.1f}km")

    # Existing counts before insertion
    pre_nodes = len(get_nodes(conn, network_id))
    pre_edges = len(get_edges(conn, network_id))

    # Extract and insert nodes
    nodes = extract_nodes(G, network_id)
    put_nodes(conn, nodes)

    # Extract and insert edges
    edges = extract_edges(G, network_id)
    put_edges(conn, edges)

    # Post-insertion counts
    post_nodes = len(get_nodes(conn, network_id))
    post_edges = len(get_edges(conn, network_id))

    added_nodes = post_nodes - pre_nodes
    added_edges = post_edges - pre_edges

    print(
        f"✅ Added {added_nodes:,} nodes and {added_edges:,} edges. "
        f"{city} network has {post_nodes:,} nodes / {post_edges:,} edges."
    )

    # Extract and store features
    start_features = time.perf_counter()
    features_data = extract_features_for_network(network_id, center_lat, center_lon, DISTANCE)
    features_time = timedelta(seconds=time.perf_counter() - start_features)
    
    if features_data:
        print(f"▶️  Storing {len(features_data):,} features in database...")
        put_features(conn, network_id, features_data)
        print(f"✅ Features stored successfully ({features_time})")
        
        # Print feature counts by type
        print("\n📊 Feature counts by type:")
        all_feature_types = list(FEATURE_TYPES.keys()) + list(CALCULATED_FEATURES.keys())
        for feature_type in all_feature_types:
            count = count_features(conn, network_id, feature_type)
            if count > 0:
                print(f"   • {feature_type}: {count:,}")

    conn.close()

    total_time = timedelta(seconds=time.perf_counter() - start_total)
    print(f"🏁 Finished in {total_time}.")


if __name__ == "__main__":
    main()