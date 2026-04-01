#!/usr/bin/env python3
"""
Script to plot and visualize database contents.
"""

from __future__ import annotations
import argparse
import sys
from pathlib import Path

# Add project root to Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

# Import matplotlib and check backend before other imports
import matplotlib
print(f"🎨 Matplotlib backend: {matplotlib.get_backend()}")

from dotenv import load_dotenv
from backend.database.db_io import connect_db, get_or_create_city
from backend.processing.visualization import (
    plot_network_overview,
    plot_network_graph,
    plot_cycleway_network,
    plot_highway_distribution,
    print_network_stats
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Plot and visualize database contents")
    parser.add_argument(
        "--city",
        "-n",
        default="Madrid",
        help="City name to analyze (default: Madrid)",
    )
    parser.add_argument(
        "--plot-type",
        "-p",
        choices=["overview", "graph", "cycleway", "highways", "stats", "all"],
        default="stats",
        help="Type of plot to generate (default: stats)",
    )
    parser.add_argument(
        "--sample-size",
        "-s",
        type=int,
        help="For graph plots, sample this many nodes (useful for large cities)",
    )
    parser.add_argument(
        "--figsize",
        nargs=2,
        type=int,
        default=[12, 8],
        help="Figure size as width height (default: 12 8)",
    )
    parser.add_argument(
        "--save-plots",
        action="store_true",
        help="Save plots to files instead of displaying them",
    )
    parser.add_argument(
        "--output-dir",
        default="plots",
        help="Directory to save plots (default: plots)",
    )
    return parser.parse_args()


def main() -> None:
    load_dotenv()
    args = parse_args()

    # Create output directory if saving plots
    if args.save_plots:
        output_dir = Path(args.output_dir)
        output_dir.mkdir(exist_ok=True)
        print(f"📁 Plots will be saved to: {output_dir.absolute()}")

    print("🔗 Connecting to database...")
    try:
        conn = connect_db()
        print("✅ Connected successfully")
    except Exception as e:
        print(f"❌ Failed to connect to database: {e}")
        return

    # Get city ID if specific city requested
    if args.plot_type in ["graph", "cycleway", "highways"] or (args.plot_type == "stats" and args.city != "all"):
        try:
            city_id = get_or_create_city(conn, args.city)
            print(f"📍 Using city: {args.city} (ID: {city_id})")
        except Exception as e:
            print(f"❌ Failed to get city '{args.city}': {e}")
            conn.close()
            return
    else:
        city_id = None

    figsize = tuple(args.figsize)

    try:
        if args.plot_type == "overview" or args.plot_type == "all":
            print("📊 Generating city overview plot...")
            plot_network_overview(conn, figsize=figsize, save_path=output_dir / "network_overview.png" if args.save_plots else None)

        if args.plot_type == "graph" or args.plot_type == "all":
            print(f"🗺️  Generating city graph plot for {args.city}...")
            plot_network_graph(conn, city_id, figsize=figsize, sample_size=args.sample_size, 
                             save_path=output_dir / f"network_graph_{args.city}.png" if args.save_plots else None)

        if args.plot_type == "cycleway" or args.plot_type == "all":
            print(f"🚴 Generating cycleway city plot for {args.city}...")
            plot_cycleway_network(conn, city_id, figsize=figsize,
                                save_path=output_dir / f"cycleway_network_{args.city}.png" if args.save_plots else None)

        if args.plot_type == "highways" or args.plot_type == "all":
            print(f"🛣️  Generating highway distribution plot for {args.city}...")
            plot_highway_distribution(conn, city_id, figsize=figsize,
                                    save_path=output_dir / f"highway_distribution_{args.city}.png" if args.save_plots else None)

        if args.plot_type == "stats" or args.plot_type == "all":
            print("📈 Generating city statistics...")
            if args.city.lower() == "all":
                print_network_stats(conn)
            else:
                print_network_stats(conn, city_id)

        if args.save_plots:
            print(f"✅ Plots saved to {output_dir.absolute()}")
        else:
            print("✅ Visualization complete!")
            print("💡 If plots didn't appear, try using --save-plots flag to save them to files")

    except Exception as e:
        print(f"❌ Error during visualization: {e}")
        import traceback
        traceback.print_exc()

    finally:
        conn.close()


if __name__ == "__main__":
    main() 