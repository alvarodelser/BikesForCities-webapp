"""
Feature operations for OSM feature extraction and processing.
Unified file combining feature types and calculations.
"""

import numpy as np
import geopandas as gpd
from shapely.geometry import Polygon, Point
from shapely.affinity import rotate
from shapely.ops import unary_union, polygonize
import osmnx as ox
from osmnx._errors import InsufficientResponseError
import warnings
from pyproj import Transformer
import json

# Feature type definitions
FEATURE_TYPES = {
    'buildings': {'building': True},
    'waterways': {'natural': 'water'},
    'forest': {'landuse': 'forest', 'leisure': 'park'},
    'bike_paths': {'highway': 'cycleway'},
    'coastline': {'natural': 'coastline'},
    'land': {'landuse': True}
}

# Calculated features (computed from base features)
CALCULATED_FEATURES = {
    'bike_path_buildings': ['bike_paths', 'buildings'],  # Buildings within 150m of bike paths
    'sea': ['coastline', 'land']  # Sea areas from coastline and land
}

# Coordinate transformers (from mappingmodule.py)
TO_WSG84 = Transformer.from_crs("EPSG:3857", "EPSG:4326", always_xy=True)
TO_WEBMERCATOR = Transformer.from_crs("EPSG:4326", "EPSG:3857", always_xy=True)


def extract_features_from_point(lat: float, lon: float, feature_type: str, dist: int = 10000):
    """Extract features from OSM using point and distance (same pattern as network extraction)"""
    tags = FEATURE_TYPES.get(feature_type)
    if tags is None:
        return None
    
    try:
        # Use the same pattern as ox.graph_from_point()
        return ox.features_from_point((lat, lon), dist=dist, tags=tags)
    except InsufficientResponseError:
        return None
    except Exception as e:
        print(f"   ⚠️  Error extracting {feature_type}: {e}")
        return None


def get_boundary(lat, lon, angle, width, height):
    """Create boundary polygon (from mappingmodule.py lines 29-58) - for plotting use"""
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


def get_bike_path_buildings(bike_paths, buildings):
    """Buildings within 150m of bike paths (from mappingmodule.py lines 109-124)"""
    if bike_paths is None or buildings is None or bike_paths.empty or buildings.empty:
        return buildings.iloc[:0] if buildings is not None else gpd.GeoDataFrame(), buildings if buildings is not None else gpd.GeoDataFrame()
    
    bike_paths_metric = bike_paths.to_crs(epsg=3857)
    bike_paths_buffer = gpd.GeoDataFrame(
        geometry=bike_paths_metric.buffer(150), 
        crs='EPSG:3857'
    ).to_crs(epsg=4326)
    
    buildings_within_buffer = gpd.sjoin(
        buildings, bike_paths_buffer, how='inner', predicate='intersects'
    )
    
    is_near_bike_path = buildings.index.isin(buildings_within_buffer.index)
    buildings_in_buffer = buildings[is_near_bike_path]
    buildings_out_buffer = buildings[~is_near_bike_path]
    
    return buildings_in_buffer, buildings_out_buffer


def get_sea(boundary, coastline, land):
    """Sea areas from coastline and land (from mappingmodule.py lines 77-108)"""
    if coastline is None or land is None:
        return gpd.GeoDataFrame(geometry=[], crs='EPSG:4326')
    
    # Convert boundary to LineString
    boundary_line = boundary.boundary
    
    if not coastline.empty:
        coast_line = unary_union(coastline.geometry)
    else:
        coast_line = None
    
    if coast_line:
        combined_lines = unary_union([boundary_line, coast_line])
    else:
        combined_lines = boundary_line
    
    partitions = list(polygonize(combined_lines))
    sea = []
    
    # Suppress warning about area calculation based on degrees
    warnings.filterwarnings("ignore",
                            message="Geometry is in a geographic CRS. Results from 'area' are likely incorrect.")
    
    for partition in partitions:
        area = partition.area
        if land.empty:
            intersection = 0
        else:
            intersection = land.intersection(partition).area.sum()
        
        if area > 0:
            ratio = (intersection / area) * 100
        else:
            ratio = 0
        
        if ratio < 10:
            sea.append(partition)
    
    return gpd.GeoDataFrame(geometry=sea, crs='EPSG:4326')





def extract_features_for_network(network_id: int, center_lat: float, center_lon: float, radius: float) -> list[tuple]:
    """Extract all features within radius from center point using ox.features_from_point()"""
    
    print(f"▶️  Extracting OSM features within {radius/1000:.1f}km radius...")
    
    features_data = []
    extracted_features = {}
    
    # Extract base features using ox.features_from_point() (same pattern as network)
    for feature_type in FEATURE_TYPES.keys():
        print(f"   • Extracting {feature_type}...", end=" ")
        gdf = extract_features_from_point(center_lat, center_lon, feature_type, dist=int(radius))
        if gdf is not None and not gdf.empty:
            extracted_features[feature_type] = gdf
            print(f"✔ {len(gdf)} features")
        else:
            extracted_features[feature_type] = None
            print("✔ 0 features")
    
    # Calculate processed features
    print("   • Calculating processed features...")
    
    # bike_path_buildings: Buildings within 150m of bike paths
    if 'bike_paths' in extracted_features and 'buildings' in extracted_features:
        bike_paths = extracted_features['bike_paths']
        buildings = extracted_features['buildings']
        if bike_paths is not None and buildings is not None:
            buildings_in_buffer, buildings_out_buffer = get_bike_path_buildings(bike_paths, buildings)
            if not buildings_in_buffer.empty:
                extracted_features['bike_path_buildings'] = buildings_in_buffer
                print(f"     ✔ bike_path_buildings: {len(buildings_in_buffer)} features")
            # Update buildings to only include those outside buffer
            extracted_features['buildings'] = buildings_out_buffer
    
    # sea: Sea areas from coastline and land  
    if 'coastline' in extracted_features and 'land' in extracted_features:
        coastline = extracted_features['coastline']
        land = extracted_features['land']
        if coastline is not None and land is not None:
            # Create a rough boundary for sea calculation (use the extraction radius)
            center_point = Point(center_lon, center_lat)
            center_metric = gpd.GeoSeries([center_point], crs='EPSG:4326').to_crs('EPSG:3857')
            buffered_metric = center_metric.buffer(radius)
            boundary = buffered_metric.to_crs('EPSG:4326').iloc[0]
            
            sea = get_sea(boundary, coastline, land)
            if not sea.empty:
                extracted_features['sea'] = sea
                print(f"     ✔ sea: {len(sea)} features")
    
    # Convert all features to database format
    for feature_type, gdf in extracted_features.items():
        if gdf is not None and not gdf.empty:
            for idx, row in gdf.iterrows():
                # Skip points
                if row['geometry'].geom_type == 'Point':
                    continue
                
                # Extract tags as JSON
                tags = {}
                for col in gdf.columns:
                    if col != 'geometry':
                        val = row[col]
                        if val is not None and str(val) != 'nan':
                            tags[col] = val
                
                features_data.append((
                    feature_type,
                    row['geometry'].wkt,
                    json.dumps(tags) if tags else None
                ))
    
    return features_data 