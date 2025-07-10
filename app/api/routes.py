"""
API routes for Bikes for Cities application.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional, List, Dict, Any
import logging
import json
from shapely import wkt
from shapely.geometry import mapping

from .models import (
    NetworkListResponse, NetworkDetailResponse, NetworkStatsResponse,
    PaginatedNodesResponse, PaginatedEdgesResponse, PaginatedRoutesResponse,
    PaginatedFeaturesResponse, GeoJSONResponse, GeoJSONFeatureCollection,
    NodeResponse, EdgeResponse, RouteResponse, FeatureResponse,
    NetworkResponse, NetworkStats, GeoJSONFeature, ErrorResponse
)
from .dependencies import (
    get_db_connection, calculate_pagination, parse_bbox,
    validate_network_exists, build_bbox_condition, check_database_health
)
from app.database.network_io import (
    get_all_networks, get_network_center, count_nodes, count_edges,
    count_routes, count_features, get_nodes, get_edges, get_features
)

logger = logging.getLogger(__name__)
router = APIRouter()


# Network endpoints
@router.get("/networks", response_model=NetworkListResponse)
async def list_networks(conn=Depends(get_db_connection)):
    """Get all networks."""
    try:
        networks_data = get_all_networks(conn)
        
        networks = []
        for network_id, name, description in networks_data:
            networks.append(NetworkResponse(
                id=network_id,
                name=name,
                description=description
            ))
        
        return NetworkListResponse(
            data=networks,
            count=len(networks),
            message="Networks retrieved successfully"
        )
    except Exception as e:
        logger.error(f"Error listing networks: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve networks")


@router.get("/networks/{network_id}", response_model=NetworkDetailResponse)
async def get_network(network_id: int, conn=Depends(get_db_connection)):
    """Get network details."""
    try:
        validate_network_exists(conn, network_id)
        
        # Get network info
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, name, description, center_lat, center_lon, radius
                FROM networks WHERE id = %s
            """, (network_id,))
            result = cur.fetchone()
            
            if not result:
                raise HTTPException(status_code=404, detail="Network not found")
            
            network = NetworkResponse(
                id=result[0],
                name=result[1],
                description=result[2],
                center_lat=result[3],
                center_lon=result[4],
                radius=result[5]
            )
            
            return NetworkDetailResponse(
                data=network,
                message="Network retrieved successfully"
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting network {network_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve network")


@router.get("/networks/{network_id}/stats", response_model=NetworkStatsResponse)
async def get_network_stats(network_id: int, conn=Depends(get_db_connection)):
    """Get network statistics."""
    try:
        validate_network_exists(conn, network_id)
        
        # Get network name
        with conn.cursor() as cur:
            cur.execute("SELECT name FROM networks WHERE id = %s", (network_id,))
            network_name = cur.fetchone()[0]
        
        # Get counts
        nodes_count = count_nodes(conn, network_id)
        edges_count = count_edges(conn, network_id)
        routes_count = count_routes(conn, network_id)
        features_count = count_features(conn, network_id)
        
        # Get bounds
        bounds = None
        with conn.cursor() as cur:
            cur.execute("""
                SELECT 
                    MIN(lat) as min_lat, MAX(lat) as max_lat,
                    MIN(lon) as min_lon, MAX(lon) as max_lon
                FROM nodes 
                WHERE network_id = %s
            """, (network_id,))
            bounds_result = cur.fetchone()
            
            if bounds_result and all(b is not None for b in bounds_result):
                bounds = {
                    "min_lat": bounds_result[0],
                    "max_lat": bounds_result[1],
                    "min_lon": bounds_result[2],
                    "max_lon": bounds_result[3]
                }
        
        stats = NetworkStats(
            network_id=network_id,
            network_name=network_name,
            nodes_count=nodes_count,
            edges_count=edges_count,
            routes_count=routes_count,
            features_count=features_count,
            bounds=bounds
        )
        
        return NetworkStatsResponse(
            data=stats,
            message="Network statistics retrieved successfully"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting network stats {network_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve network statistics")


# Node endpoints
@router.get("/networks/{network_id}/nodes", response_model=PaginatedNodesResponse)
async def get_network_nodes(
    network_id: int,
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(100, ge=1, le=1000, description="Items per page"),
    bbox: Optional[str] = Query(None, description="Bounding box filter (min_lon,min_lat,max_lon,max_lat)"),
    conn=Depends(get_db_connection)
):
    """Get network nodes with pagination and optional bounding box filtering."""
    try:
        validate_network_exists(conn, network_id)
        
        # Parse bounding box
        bbox_coords = parse_bbox(bbox) if bbox else None
        
        # Build query
        conditions = ["network_id = %s"]
        params = [network_id]
        
        if bbox_coords:
            bbox_condition, bbox_params = build_bbox_condition(bbox_coords, "geom")
            conditions.append(bbox_condition)
            params.extend(bbox_params)
        
        where_clause = " AND ".join(conditions)
        
        # Get total count
        with conn.cursor() as cur:
            count_query = f"SELECT COUNT(*) FROM nodes WHERE {where_clause}"
            cur.execute(count_query, params)
            total = cur.fetchone()[0]
        
        # Calculate pagination
        offset, limit, total_pages = calculate_pagination(page, per_page, total)
        
        # Get nodes
        with conn.cursor() as cur:
            query = f"""
                SELECT id, lat, lon, street_count
                FROM nodes
                WHERE {where_clause}
                ORDER BY id
                LIMIT %s OFFSET %s
            """
            cur.execute(query, params + [limit, offset])
            nodes_data = cur.fetchall()
        
        nodes = [
            NodeResponse(
                id=row[0],
                lat=row[1],
                lon=row[2],
                street_count=row[3]
            )
            for row in nodes_data
        ]
        
        return PaginatedNodesResponse(
            data=nodes,
            page=page,
            per_page=per_page,
            total=total,
            pages=total_pages,
            message="Nodes retrieved successfully"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting nodes for network {network_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve nodes")


# Edge endpoints
@router.get("/networks/{network_id}/edges", response_model=PaginatedEdgesResponse)
async def get_network_edges(
    network_id: int,
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(100, ge=1, le=1000, description="Items per page"),
    highway: Optional[str] = Query(None, description="Filter by highway type"),
    bbox: Optional[str] = Query(None, description="Bounding box filter (min_lon,min_lat,max_lon,max_lat)"),
    conn=Depends(get_db_connection)
):
    """Get network edges with pagination and filtering."""
    try:
        validate_network_exists(conn, network_id)
        
        # Parse bounding box
        bbox_coords = parse_bbox(bbox) if bbox else None
        
        # Build query
        conditions = ["network_id = %s"]
        params = [network_id]
        
        if highway:
            conditions.append("highway = %s")
            params.append(highway)
        
        if bbox_coords:
            bbox_condition, bbox_params = build_bbox_condition(bbox_coords, "geom")
            conditions.append(bbox_condition)
            params.extend(bbox_params)
        
        where_clause = " AND ".join(conditions)
        
        # Get total count
        with conn.cursor() as cur:
            count_query = f"SELECT COUNT(*) FROM edges WHERE {where_clause}"
            cur.execute(count_query, params)
            total = cur.fetchone()[0]
        
        # Calculate pagination
        offset, limit, total_pages = calculate_pagination(page, per_page, total)
        
        # Get edges
        with conn.cursor() as cur:
            query = f"""
                SELECT 
                    id, osmid, u, v, k, ST_AsText(geom),
                    highway, name, length, width,
                    maxspeed, lanes, oneway, tunnel, bridge
                FROM edges
                WHERE {where_clause}
                ORDER BY id
                LIMIT %s OFFSET %s
            """
            cur.execute(query, params + [limit, offset])
            edges_data = cur.fetchall()
        
        edges = [
            EdgeResponse(
                id=row[0],
                osmid=row[1],
                u=row[2],
                v=row[3],
                k=row[4],
                geometry=row[5],
                highway=row[6],
                name=row[7],
                length=row[8],
                width=row[9],
                maxspeed=row[10],
                lanes=row[11],
                oneway=row[12],
                tunnel=row[13],
                bridge=row[14]
            )
            for row in edges_data
        ]
        
        return PaginatedEdgesResponse(
            data=edges,
            page=page,
            per_page=per_page,
            total=total,
            pages=total_pages,
            message="Edges retrieved successfully"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting edges for network {network_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve edges")


# Route endpoints
@router.get("/networks/{network_id}/routes", response_model=PaginatedRoutesResponse)
async def get_network_routes(
    network_id: int,
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(100, ge=1, le=1000, description="Items per page"),
    strategy: Optional[str] = Query(None, description="Filter by routing strategy"),
    min_duration: Optional[float] = Query(None, ge=0, description="Minimum trip duration in minutes"),
    max_duration: Optional[float] = Query(None, ge=0, description="Maximum trip duration in minutes"),
    conn=Depends(get_db_connection)
):
    """Get network routes with pagination and filtering."""
    try:
        validate_network_exists(conn, network_id)
        
        # Build query
        conditions = ["network_id = %s"]
        params = [network_id]
        
        if strategy:
            conditions.append("strategy = %s")
            params.append(strategy)
        
        if min_duration is not None:
            conditions.append("trip_minutes >= %s")
            params.append(min_duration)
        
        if max_duration is not None:
            conditions.append("trip_minutes <= %s")
            params.append(max_duration)
        
        where_clause = " AND ".join(conditions)
        
        # Get total count
        with conn.cursor() as cur:
            count_query = f"SELECT COUNT(*) FROM routes WHERE {where_clause}"
            cur.execute(count_query, params)
            total = cur.fetchone()[0]
        
        # Calculate pagination
        offset, limit, total_pages = calculate_pagination(page, per_page, total)
        
        # Get routes
        with conn.cursor() as cur:
            query = f"""
                SELECT 
                    id, id_trip, origin_node, dest_node, strategy,
                    trip_minutes, datetime_unlock, id_bike, created_at
                FROM routes
                WHERE {where_clause}
                ORDER BY id
                LIMIT %s OFFSET %s
            """
            cur.execute(query, params + [limit, offset])
            routes_data = cur.fetchall()
        
        routes = [
            RouteResponse(
                id=row[0],
                id_trip=row[1],
                origin_node=row[2],
                dest_node=row[3],
                strategy=row[4],
                trip_minutes=row[5],
                datetime_unlock=row[6],
                id_bike=row[7],
                created_at=row[8]
            )
            for row in routes_data
        ]
        
        return PaginatedRoutesResponse(
            data=routes,
            page=page,
            per_page=per_page,
            total=total,
            pages=total_pages,
            message="Routes retrieved successfully"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting routes for network {network_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve routes")


# Feature endpoints
@router.get("/networks/{network_id}/features", response_model=PaginatedFeaturesResponse)
async def get_network_features(
    network_id: int,
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(100, ge=1, le=1000, description="Items per page"),
    feature_type: Optional[str] = Query(None, description="Filter by feature type"),
    bbox: Optional[str] = Query(None, description="Bounding box filter (min_lon,min_lat,max_lon,max_lat)"),
    conn=Depends(get_db_connection)
):
    """Get network features with pagination and filtering."""
    try:
        validate_network_exists(conn, network_id)
        
        # Parse bounding box
        bbox_coords = parse_bbox(bbox) if bbox else None
        
        # Build query
        conditions = ["network_id = %s"]
        params = [network_id]
        
        if feature_type:
            conditions.append("feature_type = %s")
            params.append(feature_type)
        
        if bbox_coords:
            bbox_condition, bbox_params = build_bbox_condition(bbox_coords, "geometry")
            conditions.append(bbox_condition)
            params.extend(bbox_params)
        
        where_clause = " AND ".join(conditions)
        
        # Get total count
        with conn.cursor() as cur:
            count_query = f"SELECT COUNT(*) FROM features WHERE {where_clause}"
            cur.execute(count_query, params)
            total = cur.fetchone()[0]
        
        # Calculate pagination
        offset, limit, total_pages = calculate_pagination(page, per_page, total)
        
        # Get features
        with conn.cursor() as cur:
            query = f"""
                SELECT id, feature_type, ST_AsText(geometry), tags
                FROM features
                WHERE {where_clause}
                ORDER BY id
                LIMIT %s OFFSET %s
            """
            cur.execute(query, params + [limit, offset])
            features_data = cur.fetchall()
        
        features = [
            FeatureResponse(
                id=row[0],
                feature_type=row[1],
                geometry=row[2],
                tags=row[3]  # PostgreSQL JSONB is already converted to dict by psycopg2
            )
            for row in features_data
        ]
        
        return PaginatedFeaturesResponse(
            data=features,
            page=page,
            per_page=per_page,
            total=total,
            pages=total_pages,
            message="Features retrieved successfully"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting features for network {network_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve features")


# GeoJSON endpoints
@router.get("/networks/{network_id}/features/geojson", response_model=GeoJSONResponse)
async def get_network_features_geojson(
    network_id: int,
    feature_type: Optional[str] = Query(None, description="Filter by feature type"),
    bbox: Optional[str] = Query(None, description="Bounding box filter (min_lon,min_lat,max_lon,max_lat)"),
    limit: int = Query(1000, ge=1, le=5000, description="Maximum number of features"),
    conn=Depends(get_db_connection)
):
    """Get network features as GeoJSON."""
    try:
        validate_network_exists(conn, network_id)
        
        # Parse bounding box
        bbox_coords = parse_bbox(bbox) if bbox else None
        
        # Build query
        conditions = ["network_id = %s"]
        params = [network_id]
        
        if feature_type:
            conditions.append("feature_type = %s")
            params.append(feature_type)
        
        if bbox_coords:
            bbox_condition, bbox_params = build_bbox_condition(bbox_coords, "geometry")
            conditions.append(bbox_condition)
            params.extend(bbox_params)
        
        where_clause = " AND ".join(conditions)
        
        # Get features
        with conn.cursor() as cur:
            query = f"""
                SELECT feature_type, ST_AsText(geometry), tags
                FROM features
                WHERE {where_clause}
                ORDER BY id
                LIMIT %s
            """
            cur.execute(query, params + [limit])
            features_data = cur.fetchall()
        
        # Convert to GeoJSON
        geojson_features = []
        for feature_type, geometry_wkt, tags in features_data:
            try:
                # Parse geometry
                geom = wkt.loads(geometry_wkt)
                geojson_geom = mapping(geom)
                
                # Parse tags (PostgreSQL JSONB is already a dict)
                properties = tags if tags else {}
                properties["feature_type"] = feature_type
                
                geojson_features.append(GeoJSONFeature(
                    geometry=geojson_geom,
                    properties=properties
                ))
            except Exception as e:
                logger.warning(f"Failed to convert feature to GeoJSON: {e}")
                continue
        
        feature_collection = GeoJSONFeatureCollection(
            features=geojson_features
        )
        
        return GeoJSONResponse(
            data=feature_collection,
            message=f"Retrieved {len(geojson_features)} features as GeoJSON"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting GeoJSON features for network {network_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve GeoJSON features")


# Health check with database validation
@router.get("/health/detailed")
async def detailed_health_check(conn=Depends(get_db_connection)):
    """Detailed health check including database connectivity."""
    try:
        db_healthy = check_database_health(conn)
        
        return {
            "status": "healthy" if db_healthy else "unhealthy",
            "database_connected": db_healthy,
            "timestamp": "2024-01-01T00:00:00Z"  # This would be dynamic
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            "status": "unhealthy",
            "database_connected": False,
            "error": str(e)
        } 