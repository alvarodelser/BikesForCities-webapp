#!/usr/bin/env python3
"""Query the database to see what's loaded in all cities."""

from __future__ import annotations

from dotenv import load_dotenv
from backend.database.db_io import (
    connect_db, 
    get_all_cities, 
    count_nodes, 
    count_edges, 
    count_routes
)


def main() -> None:
    load_dotenv()
    
    print("🔍 Querying all city data from database...")
    print("=" * 80)
    
    # Connect to database
    try:
        conn = connect_db()
        print("✅ Connected to database successfully")
    except Exception as e:
        print(f"❌ Failed to connect to database: {e}")
        return
    
    # Get all cities
    try:
        cities = get_all_cities(conn)
        print(f"📊 Found {len(cities)} city(s) in database")
    except Exception as e:
        print(f"❌ Failed to get cities: {e}")
        conn.close()
        return
    
    if not cities:
        print("❌ No cities found in database")
        conn.close()
        return
    
    # Process each city
    total_nodes = 0
    total_edges = 0
    total_routes = 0
    
    for city_id, city_name, description in cities:
        print(f"\n🏙️  City: {city_name}")
        print(f"    ID: {city_id}")
        print(f"    Description: {description or 'None'}")
        print("    " + "-" * 50)
        
        try:
            # Count nodes, edges, and routes for this city
            node_count = count_nodes(conn, city_id)
            edge_count = count_edges(conn, city_id)
            route_count = count_routes(conn, city_id)
            
            print(f"    🔗 Nodes:  {node_count:,}")
            print(f"    🛣️  Edges:  {edge_count:,}")
            print(f"    🚴 Routes: {route_count:,}")
            
            # Add to totals
            total_nodes += node_count
            total_edges += edge_count
            total_routes += route_count
            
            # Check if this city meets sanity check requirements
            if node_count < 1000:
                print(f"    ⚠️  WARNING: Only {node_count:,} nodes (< 1,000)")
            if edge_count < 1000:
                print(f"    ⚠️  WARNING: Only {edge_count:,} edges (< 1,000)")
            
            if node_count > 0 and edge_count > 0:
                print(f"    ✅ City populated")
            elif node_count == 0 and edge_count == 0:
                print(f"    📭 City empty (no nodes/edges)")
            else:
                print(f"    ⚠️  City incomplete")
                
        except Exception as e:
            print(f"    ❌ Error querying city {city_name}: {e}")
    
    # Summary
    print("\n" + "=" * 80)
    print("📊 SUMMARY:")
    print(f"    Total cities: {len(cities)}")
    print(f"    Total nodes:    {total_nodes:,}")
    print(f"    Total edges:    {total_edges:,}")
    print(f"    Total routes:   {total_routes:,}")
    print("=" * 80)
    print("✅ Query completed")
    
    conn.close()


if __name__ == "__main__":
    main() 