# scripts/trip_ingestion.py
"""Ingest trip CSV files and save routes to the database."""

from __future__ import annotations

import argparse
from dotenv import load_dotenv
import networkx as nx

from app.database.network_io import (
    connect_db,
    get_or_create_network,
)
from app.processing.network_ops import build_graph
from app.processing.trip_loader import process_all_csvs, process_next_csv


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Ingest trip CSV files into the database")
    parser.add_argument(
        "--network",
        "-n",
        default="Madrid",
        help="City/network name stored in the 'networks' table",
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
        help="Max allowed distance (m) between trip endpoints and nearest network node",
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

    network_id = get_or_create_network(conn, args.network)
    print(f"Using network_id={network_id} ({args.network})")

    print("Reconstructing graph …")
    graph: nx.MultiDiGraph = build_graph(conn, network_id)
    
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
            network_id,
            args.network,
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
            network_id,
            args.network,
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
