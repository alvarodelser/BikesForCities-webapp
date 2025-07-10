"""
Visualization and plotting functions for database contents.
"""

from typing import List, Tuple, Optional
import networkx as nx
import matplotlib.pyplot as plt
import pandas as pd
from shapely import wkt
from shapely.geometry import Point, LineString, Polygon
from shapely.affinity import rotate
from shapely.ops import unary_union, polygonize
import numpy as np
import geopandas as gpd
import json
import warnings
from pyproj import Transformer

from matplotlib.patches import FancyArrowPatch, Circle
import matplotlib.lines as mlines
import matplotlib.patches as mpatches

from app.database.network_io import (
    get_all_networks, count_nodes, count_edges, count_routes,
    get_features, get_network_center
)
from .network_ops import build_graph

# Coordinate transformers (same as mappingmodule.py)
TO_WSG84 = Transformer.from_crs("EPSG:3857", "EPSG:4326", always_xy=True)
TO_WEBMERCATOR = Transformer.from_crs("EPSG:4326", "EPSG:3857", always_xy=True)



def plot_network_overview(conn, save_path: Optional[str] = None) -> None:
    """
    Plot a horizontal comparison overview of all networks in the database (nodes vs edges vs routes).
    
    Args:
        conn: Database connection
        save_path: If provided, save plot to this path instead of showing
    """
    networks = get_all_networks(conn)
    
    if not networks:
        print("❌ No networks found in database")
        return
    
    # Prepare data for plotting
    network_data = []
    for network_id, network_name, description in networks:
        nodes = count_nodes(conn, network_id)
        edges = count_edges(conn, network_id)
        routes = count_routes(conn, network_id)
        
        network_data.append({
            'name': network_name,
            'nodes': nodes,
            'edges': edges,
            'routes': routes,
            'network_id': network_id
        })
    
    df = pd.DataFrame(network_data)
    
    # Dynamic figure height based on number of networks
    num_networks = len(df)
    fig_height = max(4, num_networks * 0.8 + 2)  # Minimum 4, scale with networks
    figsize = (10, fig_height)
    
    # Create horizontal bar plot
    fig, ax = plt.subplots(figsize=figsize)
    
    y_pos = range(len(df))
    bar_height = 0.25
    
    # More appealing colors
    colors = ['#3498db', '#2ecc71', '#e74c3c']  # Blue, Green, Red
    
    bars1 = ax.barh([y - bar_height for y in y_pos], df['nodes'], bar_height, 
                    label='Nodes', alpha=0.8, color=colors[0])
    bars2 = ax.barh(y_pos, df['edges'], bar_height, 
                    label='Edges', alpha=0.8, color=colors[1])
    bars3 = ax.barh([y + bar_height for y in y_pos], df['routes'], bar_height, 
                    label='Routes', alpha=0.8, color=colors[2])
    
    ax.set_title('Network Completeness Comparison', fontsize=14, fontweight='bold', pad=20)
    ax.set_xlabel('Count')
    ax.set_yticks(y_pos)
    ax.set_yticklabels(df['name'])
    ax.legend(loc='lower right')
    ax.grid(axis='x', alpha=0.3)
    
    plt.tight_layout()
    
    if save_path:
        plt.savefig(save_path, dpi=300, bbox_inches='tight')
        print(f"📁 Plot saved to: {save_path}")
        plt.close()
    else:
        plt.show()


def plot_network_graph(conn, network_id: int, figsize: Tuple[int, int] = (12, 12), 
                      sample_size: Optional[int] = None, highway_filter: Optional[str] = None,
                      plot_nodes: bool = True, save_path: Optional[str] = None) -> None:
    """
    Plot the network graph structure with optional filtering and node display control.
    
    Args:
        conn: Database connection
        network_id: ID of the network to plot
        figsize: Figure size (width, height)
        sample_size: If provided, randomly sample this many nodes for plotting
        highway_filter: If provided, only show edges with this highway type (e.g., 'cycleway')
        plot_nodes: Whether to plot nodes or not
        save_path: If provided, save plot to this path instead of showing
    """
    print(f"🔄 Building graph for network ID {network_id}...")
    graph = build_graph(conn, network_id)
    
    if graph.number_of_nodes() == 0:
        print("❌ No nodes found in graph")
        return
    
    # Filter by highway type if specified
    if highway_filter:
        print(f"🔍 Filtering for highway type: {highway_filter}")
        filtered_edges = []
        for u, v, k, data in graph.edges(keys=True, data=True):
            if data.get('highway') == highway_filter:
                filtered_edges.append((u, v, k))
        
        if not filtered_edges:
            print(f"❌ No edges found with highway type '{highway_filter}'")
            return
        
        # Create subgraph with only filtered edges
        graph = graph.edge_subgraph(filtered_edges).copy()
        print(f"🔍 Filtered to {len(filtered_edges):,} edges connecting {graph.number_of_nodes():,} nodes")
    
    # Sample graph if requested
    if sample_size and graph.number_of_nodes() > sample_size:
        print(f"📊 Sampling {sample_size:,} nodes from {graph.number_of_nodes():,} total nodes")
        nodes_to_keep = list(graph.nodes())[:sample_size]
        graph = graph.subgraph(nodes_to_keep).copy()
    
    # Extract positions
    pos = {node: (data['x'], data['y']) for node, data in graph.nodes(data=True)}
    
    # Create plot
    plt.figure(figsize=figsize)
    
    # Draw nodes if requested
    if plot_nodes:
        node_color = 'green' if highway_filter == 'cycleway' else 'cyan'
        node_size = 1 
        node_alpha = 0.6
        
        nx.draw_networkx_nodes(graph, pos, node_size=node_size, node_color=node_color, 
                              alpha=node_alpha)
        
    # Draw edges 
    edge_color = 'darkgreen' if highway_filter == 'cycleway' else 'blue'
    edge_alpha = 1
    edge_width = 0.7
    
    nx.draw_networkx_edges(graph, pos, width=edge_width, edge_color=edge_color, 
                          alpha=edge_alpha, arrows=False)
    

    
    # Create title
    filter_text = f" ({highway_filter} only)" if highway_filter else ""
    plt.title(f'Network Graph (ID: {network_id}){filter_text}\n'
              f'{graph.number_of_nodes():,} nodes, {graph.number_of_edges():,} edges')
    plt.axis('equal')
    plt.axis('off')
    plt.tight_layout()
    
    if save_path:
        plt.savefig(save_path, dpi=300, bbox_inches='tight')
        print(f"📁 Plot saved to: {save_path}")
        plt.close()
    else:
        plt.show()


def plot_highway_distribution(conn, network_id: int, figsize: Tuple[int, int] = (12, 8), save_path: Optional[str] = None) -> None:
    """
    Plot the distribution of highway types in the network (top 15 categories).
    
    Args:
        conn: Database connection
        network_id: ID of the network to analyze
        figsize: Figure size (width, height)
        save_path: If provided, save plot to this path instead of showing
    """
    # Get highway type distribution
    with conn.cursor() as cur:
        cur.execute("""
            SELECT highway, COUNT(*) as count
            FROM edges 
            WHERE network_id = %s 
            GROUP BY highway 
            ORDER BY count DESC
            LIMIT 15
        """, (network_id,))
        highway_data = cur.fetchall()
    
    if not highway_data:
        print("❌ No highway data found")
        return
    
    # Prepare data
    highways = [row[0] if row[0] else 'Unknown' for row in highway_data]
    counts = [row[1] for row in highway_data]
    
    # Create single bar plot
    plt.figure(figsize=figsize)
    
    # More appealing colors with gradient
    colors = plt.cm.Set3(range(len(highways)))  # Use colormap for variety
    
    bars = plt.bar(range(len(highways)), counts, alpha=0.8, color=colors, 
                   edgecolor='white', linewidth=0.5)
    
    plt.title(f'Highway Type Distribution - Top 15 (Network ID: {network_id})', 
              fontsize=14, fontweight='bold', pad=20)
    plt.xlabel('Highway Type', fontsize=12)
    plt.ylabel('Number of Edges', fontsize=12)
    plt.xticks(range(len(highways)), highways, rotation=45, ha='right')
    plt.grid(axis='y', alpha=0.3)
    
    # Add value labels on bars
    for i, bar in enumerate(bars):
        height = bar.get_height()
        plt.text(bar.get_x() + bar.get_width()/2., height + height*0.01,
                f'{int(height):,}', ha='center', va='bottom', fontsize=9)
    
    plt.tight_layout()
    
    if save_path:
        plt.savefig(save_path, dpi=300, bbox_inches='tight')
        print(f"📁 Plot saved to: {save_path}")
        plt.close()
    else:
        plt.show()


def print_network_stats(conn, network_id: Optional[int] = None) -> None:
    """
    Print detailed statistics about networks.
    
    Args:
        conn: Database connection
        network_id: If provided, show stats for specific network. Otherwise show all.
    """
    if network_id:
        networks = [(network_id, "Specified Network", None)]
    else:
        networks = get_all_networks(conn)
    
    print("=" * 80)
    print("NETWORK STATISTICS")
    print("=" * 80)
    
    for net_id, net_name, description in networks:
        print(f"\n🏙️  {net_name} (ID: {net_id})")
        if description:
            print(f"   Description: {description}")
        
        # Basic counts
        nodes = count_nodes(conn, net_id)
        edges = count_edges(conn, net_id)
        routes = count_routes(conn, net_id)
        
        print(f"   📊 Nodes: {nodes:,}")
        print(f"   📊 Edges: {edges:,}")
        print(f"   📊 Routes: {routes:,}")
        
        # Geographic bounds
        with conn.cursor() as cur:
            cur.execute("""
                SELECT 
                    MIN(lat) as min_lat, MAX(lat) as max_lat,
                    MIN(lon) as min_lon, MAX(lon) as max_lon
                FROM nodes 
                WHERE network_id = %s
            """, (net_id,))
            bounds = cur.fetchone()
            
            if bounds and all(b is not None for b in bounds):
                print(f"   🌍 Bounds: {bounds[0]:.6f}°N to {bounds[1]:.6f}°N, "
                      f"{bounds[2]:.6f}°E to {bounds[3]:.6f}°E")
        
        # Route statistics
        if routes > 0:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT 
                        AVG(trip_minutes) as avg_duration,
                        MIN(trip_minutes) as min_duration,
                        MAX(trip_minutes) as max_duration,
                        COUNT(DISTINCT id_bike) as unique_bikes
                    FROM routes 
                    WHERE network_id = %s
                """, (net_id,))
                route_stats = cur.fetchone()
                
                if route_stats:
                    print(f"   🚴 Avg trip duration: {route_stats[0]:.1f} minutes")
                    print(f"   🚴 Trip duration range: {route_stats[1]:.1f} - {route_stats[2]:.1f} minutes")
                    print(f"   🚴 Unique bikes: {route_stats[3]:,}")
    
    print("\n" + "=" * 80)


# =============================================================================
# FEATURE PLOTTING FUNCTIONS (migrated from mappingmodule.py)
# =============================================================================

def get_boundary(lat, lon, angle, width, height):
    """Create boundary polygon (from mappingmodule.py lines 29-58)"""
    # Calculate unrotated corners on mercator
    x, y = TO_WEBMERCATOR.transform(lon, lat)
    min_x = x - (width / 2)
    max_x = x + (width / 2)
    min_y = y - (height / 2)
    max_y = y + (height / 2)
    
    # Create a shapely polygon from these corner points
    polygon = Polygon([
        (min_x, min_y),
        (min_x, max_y),
        (max_x, max_y),
        (max_x, min_y)
    ])
    
    # Rotate the polygon around its center
    rotated_polygon = rotate(polygon, angle, origin=(x, y), use_radians=False)
    
    # Retransform to wsg84
    reprojected_coords = [TO_WSG84.transform(lon, lat) for lon, lat in rotated_polygon.exterior.coords]
    return Polygon(reprojected_coords)


def add_compass_rose(ax, angle, length=200, offset=400):
    """Add compass rose to plot (from mappingmodule.py lines 124-142)"""
    # Place the north arrow in the top right corner
    max_x = ax.get_xlim()[1]
    max_y = ax.get_ylim()[1]
    arrow_x = max_x - offset
    arrow_y = max_y - offset
    
    # Rotate the north arrow direction by the angle
    end_x = arrow_x + length * np.cos(np.radians(90 - angle))
    end_y = arrow_y + length * np.sin(np.radians(90 - angle))
    
    circle = Circle((arrow_x, arrow_y), 1.1 * length, color='#b1a6a3', zorder=1)
    ax.add_patch(circle)
    
    # Draw the north arrow
    arrow = FancyArrowPatch((arrow_x, arrow_y), (end_x, end_y), 
                           color='#AF4749', arrowstyle='-|>', mutation_scale=15, lw=2, zorder=2)
    ax.add_patch(arrow)
    ax.text(end_x, end_y, 'N', color='#AF4749', fontsize=8, ha='center', va='center', weight='bold', zorder=3)
    return ax


def add_annotation(ax, text, x_factor, y_factor, width, height, bg_color):
    """Add annotation to plot (from mappingmodule.py lines 142-154)"""
    ax.annotate(
        text,
        xy=(x_factor * width, y_factor * height),
        xytext=(10, -30),
        textcoords='offset points',
        bbox=dict(boxstyle="round,pad=0.3", edgecolor=bg_color, facecolor='white'),
        fontsize=20,
        color=bg_color
    )


def load_features_from_db(conn, network_id: int, boundary: Polygon) -> dict:
    """Load features from database and filter by boundary"""
    print(f"🔄 Loading features from database for network {network_id}...")
    
    # Get all features from database
    features_data = get_features(conn, network_id)
    
    # Convert to GeoDataFrame and filter by boundary
    features_dict = {}
    
    for feature_id, feature_type, geometry_wkt, tags in features_data:
        geom = wkt.loads(geometry_wkt)
        
        # Check if feature intersects with boundary
        if boundary.intersects(geom):
            if feature_type not in features_dict:
                features_dict[feature_type] = []
            
            features_dict[feature_type].append({
                'geometry': geom,
                'tags': tags if isinstance(tags, dict) else (json.loads(tags) if tags else {})
            })
    
    # Convert to GeoDataFrames
    result = {}
    for feature_type, feature_list in features_dict.items():
        if feature_list:
            geometries = [f['geometry'] for f in feature_list]
            result[feature_type] = gpd.GeoDataFrame(geometry=geometries, crs='EPSG:4326')
            print(f"   ✔ {feature_type}: {len(geometries)} features")
        else:
            result[feature_type] = gpd.GeoDataFrame(geometry=[], crs='EPSG:4326')
            print(f"   ✔ {feature_type}: 0 features")
    
    return result


def plot_features_map(ax, center, boundary, angle, features, settings):
    """Plot features map (adapted from mappingmodule.py plot_map function)"""
    center = TO_WEBMERCATOR.transform(*center)
    boundary_gdf = gpd.GeoDataFrame(geometry=[boundary], crs='EPSG:4326').to_crs(epsg=3857)
    bounds = boundary_gdf.rotate(-angle, origin=Point(center), use_radians=False).bounds

    # Plot each feature layer
    for layer in features.keys():
        if layer in settings.get('layers', {}):
            layer_settings = settings['layers'][layer]
            geometry = features[layer]
            color = layer_settings.get('color', '#000000')
            linewidth = layer_settings.get('linewidth', 0)
            alpha = layer_settings.get('alpha', 1)
            
            if geometry is not None and not geometry.empty:
                (geometry
                 .to_crs(epsg=3857)
                 .rotate(-angle, origin=Point(center), use_radians=False)
                 .translate(xoff=-bounds['minx'].values[0], yoff=-bounds['miny'].values[0])
                 .plot(ax=ax, color=color, linewidth=linewidth, alpha=alpha)
                 )

    # Apply plot settings
    ax.set_title(settings['title'])
    ax.set_facecolor(settings.get('background', '#000000'))
    ax.set_aspect('equal')
    ax.set_xlabel('Meters (X)')
    ax.set_ylabel('Meters (Y)')

    # Use actual transformed boundary bounds instead of original width/height
    plot_width = bounds['maxx'].values[0] - bounds['minx'].values[0]
    plot_height = bounds['maxy'].values[0] - bounds['miny'].values[0]
    
    ax.set_xlim(left=0, right=plot_width)
    ax.set_ylim(bottom=0, top=plot_height)

    step = 1000
    ax.set_xticks(np.arange(0, plot_width + step, step))
    ax.set_yticks(np.arange(0, plot_height + step, step))

    add_compass_rose(ax, angle)

    # Add legend
    legend = []
    if settings.get('legend', {}).get('bike_lanes'):
        legend.append(mlines.Line2D([], [], color='#00cac3', marker='o', linestyle='-', label='Carril Bici'))
    if settings.get('legend', {}).get('coverage'):
        legend.append(mpatches.Patch(color='#027A76', label='Edificios a 150m de un carril bici'))
    if legend:
        ax.legend(handles=legend, loc='upper left', fontsize=20)

    # Add annotations using actual plot dimensions
    total_length = settings.get('annotations', {}).get('total_length', {}).get('value', None)
    if total_length is not None:
        add_annotation(ax, f'Total: {total_length:.2f} km', 3.7/10, 299/300, 
                      plot_width, plot_height, '#00cac3')

    coverage = settings.get('annotations', {}).get('coverage', {}).get('value', None)
    if coverage is not None:
        add_annotation(ax, f'Cobertura: {coverage:.2f} %', 3.7/10, 292/300, 
                      plot_width, plot_height, '#027A76')


def generate_features_map(conn, network_id: int, center_lat: float, center_lon: float, 
                         angle: float, width: int, height: int, features_config: dict, 
                         settings: dict, save_path: Optional[str] = None):
    """Generate features map from database (adapted from mappingmodule.py generate_map function)"""
    
    # Get network center if not provided
    if center_lat is None or center_lon is None:
        network_center = get_network_center(conn, network_id)
        if network_center:
            center_lat, center_lon, _ = network_center
        else:
            raise ValueError(f"No center coordinates found for network {network_id}")
    
    center = (center_lat, center_lon)
    boundary = get_boundary(center_lat, center_lon, angle, width, height)
    
    print(f"🎨 Generating features map for network {network_id}...")
    print(f"   Center: ({center_lat:.6f}, {center_lon:.6f})")
    print(f"   Boundary: {width}m x {height}m at {angle}° rotation")
    
    # Load features from database
    features = load_features_from_db(conn, network_id, boundary)
    
    # Calculate annotations if requested
    if settings.get('annotations', {}).get('total_length', {}).get('plot') and 'bike_paths' in features:
        if not features['bike_paths'].empty:
            settings['annotations']['total_length']['value'] = features['bike_paths'].to_crs(epsg=3857).length.sum() / 1000
        else:
            settings['annotations']['total_length']['value'] = 0
    
    if settings.get('annotations', {}).get('coverage', {}).get('plot') and 'bike_path_buildings' in features:
        buildings_in_buffer = len(features.get('bike_path_buildings', []))
        buildings_out_buffer = len(features.get('buildings', []))
        total_buildings = buildings_in_buffer + buildings_out_buffer
        if total_buildings > 0:
            settings['annotations']['coverage']['value'] = buildings_in_buffer / total_buildings * 100
        else:
            settings['annotations']['coverage']['value'] = 0
    
    # Apply features configuration to settings
    settings['layers'] = features_config
    
    # Create plot with better size for notebook display
    fig, ax = plt.subplots(figsize=(12, 9))  # Fixed size for notebook display
    
    plot_features_map(ax=ax, center=center, boundary=boundary, angle=angle, 
                     features=features, settings=settings)
    
    plt.tight_layout()
    
    if save_path:
        plt.savefig(save_path, dpi=300, bbox_inches='tight')
        print(f"📁 Map saved to: {save_path}")
        plt.close()
    else:
        plt.show()
        return fig, ax  # Return figure and axis for notebook use


def plot_features_overview(conn, network_id: int, save_path: Optional[str] = None):
    """Plot overview of all features for a network"""
    
    print(f"🔄 Generating features overview for network {network_id}...")
    
    # Get feature counts by type
    feature_counts = {}
    features_data = get_features(conn, network_id)
    
    for _, feature_type, _, _ in features_data:
        feature_counts[feature_type] = feature_counts.get(feature_type, 0) + 1
    
    if not feature_counts:
        print("❌ No features found in database")
        return
    
    # Create bar plot
    fig, ax = plt.subplots(figsize=(12, 8))
    
    feature_types = list(feature_counts.keys())
    counts = list(feature_counts.values())
    
    colors = plt.cm.Set3(range(len(feature_types)))
    bars = ax.bar(feature_types, counts, color=colors, alpha=0.8, edgecolor='white', linewidth=0.5)
    
    ax.set_title(f'Feature Distribution (Network ID: {network_id})', fontsize=14, fontweight='bold', pad=20)
    ax.set_xlabel('Feature Type', fontsize=12)
    ax.set_ylabel('Number of Features', fontsize=12)
    ax.grid(axis='y', alpha=0.3)
    
    # Add value labels on bars
    for bar, count in zip(bars, counts):
        height = bar.get_height()
        ax.text(bar.get_x() + bar.get_width()/2., height + height*0.01,
                f'{count:,}', ha='center', va='bottom', fontsize=10)
    
    plt.xticks(rotation=45, ha='right')
    plt.tight_layout()
    
    if save_path:
        plt.savefig(save_path, dpi=300, bbox_inches='tight')
        print(f"📁 Plot saved to: {save_path}")
        plt.close()
    else:
        plt.show()
        return fig, ax  # Return figure and axis for notebook use