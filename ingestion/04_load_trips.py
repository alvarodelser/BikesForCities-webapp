# scripts/trip_ingestion.py
"""Ingest trip CSV files and save routes to the database."""

from __future__ import annotations

import argparse
from dotenv import load_dotenv
import networkx as nx

from backend.database.city_io import (
    connect_db,
    get_or_create_city,
)
from backend.processing.city_ops import build_graph
from backend.processing.trip_loader import process_all_csvs, process_next_csv


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Ingest trip CSV files into the database")
    parser.add_argument(
        "--city",
        "-n",
        default="Madrid",
        help="City/city name stored in the 'cities' table",
    )
    parser.add_argument(
        "--strategy",
        "-s",
        default="shortest",
        choices=["shortest"],
        help="Routing strategy to use",
    )
    parser.add_argument(
        "--max-distance",
        "-d",
        type=float,
        default=150.0,
        help="Max allowed distance (m) between trip endpoints and nearest city node",
    )
    parser.add_argument(
        "--single-file",
        action="store_true",
        help="Process only one CSV file instead of all files (useful for testing)",
    )
    return parser.parse_args()


def main() -> None:
    load_dotenv()
    args = parse_args()

    print("Connecting to database …")
    conn = connect_db()

    city_id = get_or_create_city(conn, args.city)
    print(f"Using city_id={city_id} ({args.city})")

    print("Reconstructing graph …")
    graph: nx.MultiDiGraph = build_graph(conn, city_id)
    
    # Sanity check: ensure graph has sufficient nodes and edges
    num_nodes = graph.number_of_nodes()
    num_edges = graph.number_of_edges()
    print(f"Graph loaded with {num_nodes:,} nodes and {num_edges:,} edges")
    
    if num_nodes < 1000:
        print(f"❌ ERROR: Graph has only {num_nodes:,} nodes (expected at least 1,000)")
        conn.close()
        exit(1)
    
    if num_edges < 1000:
        print(f"❌ ERROR: Graph has only {num_edges:,} edges (expected at least 1,000)")
        conn.close()
        exit(1)
    print("✅ Graph sanity check passed")

    # Process CSV files
    if args.single_file:
        print("🔧 Processing single file mode...")
        result = process_next_csv(
            graph,
            conn,
            city_id,
            args.city,
            strategy=args.strategy,
            max_distance=args.max_distance,
        )
        if result is None:
            print("✅ No files to process - all CSV files already ingested.")
        else:
            print("✅ Single file processing finished.")
    else:
        print("🔄 Processing all unprocessed CSV files...")
        files_processed = process_all_csvs(
            graph,
            conn,
            city_id,
            args.city,
            strategy=args.strategy,
            max_distance=args.max_distance,
        )

        if files_processed is None or files_processed == 0:
            print("✅ No new files to process - all CSV files already ingested.")
        else:
            print(f"✅ Trip ingestion finished - processed {files_processed} files.")
    
    conn.close()


if __name__ == "__main__":
    main()
