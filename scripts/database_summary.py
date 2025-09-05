#!/usr/bin/env python3
"""Query the database to see what's loaded in all networks."""

from __future__ import annotations

from dotenv import load_dotenv
from backend.database.network_io import (
    connect_db, 
    get_all_networks, 
    count_nodes, 
    count_edges, 
    count_routes
)


def main() -> None:
    load_dotenv()
    
    print("🔍 Querying all network data from database...")
    print("=" * 80)
    
    # Connect to database
    try:
        conn = connect_db()
        print("✅ Connected to database successfully")
    except Exception as e:
        print(f"❌ Failed to connect to database: {e}")
        return
    
    # Get all networks
    try:
        networks = get_all_networks(conn)
        print(f"📊 Found {len(networks)} network(s) in database")
    except Exception as e:
        print(f"❌ Failed to get networks: {e}")
        conn.close()
        return
    
    if not networks:
        print("❌ No networks found in database")
        conn.close()
        return
    
    # Process each network
    total_nodes = 0
    total_edges = 0
    total_routes = 0
    
    for network_id, network_name, description in networks:
        print(f"\n🏙️  Network: {network_name}")
        print(f"    ID: {network_id}")
        print(f"    Description: {description or 'None'}")
        print("    " + "-" * 50)
        
        try:
            # Count nodes, edges, and routes for this network
            node_count = count_nodes(conn, network_id)
            edge_count = count_edges(conn, network_id)
            route_count = count_routes(conn, network_id)
            
            print(f"    🔗 Nodes:  {node_count:,}")
            print(f"    🛣️  Edges:  {edge_count:,}")
            print(f"    🚴 Routes: {route_count:,}")
            
            # Add to totals
            total_nodes += node_count
            total_edges += edge_count
            total_routes += route_count
            
            # Check if this network meets sanity check requirements
            if node_count < 1000:
                print(f"    ⚠️  WARNING: Only {node_count:,} nodes (< 1,000)")
            if edge_count < 1000:
                print(f"    ⚠️  WARNING: Only {edge_count:,} edges (< 1,000)")
            
            if node_count > 0 and edge_count > 0:
                print(f"    ✅ Network populated")
            elif node_count == 0 and edge_count == 0:
                print(f"    📭 Network empty (no nodes/edges)")
            else:
                print(f"    ⚠️  Network incomplete")
                
        except Exception as e:
            print(f"    ❌ Error querying network {network_name}: {e}")
    
    # Summary
    print("\n" + "=" * 80)
    print("📊 SUMMARY:")
    print(f"    Total networks: {len(networks)}")
    print(f"    Total nodes:    {total_nodes:,}")
    print(f"    Total edges:    {total_edges:,}")
    print(f"    Total routes:   {total_routes:,}")
    print("=" * 80)
    print("✅ Query completed")
    
    conn.close()


if __name__ == "__main__":
    main() 