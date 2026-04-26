"""
API routes for Bikes for Cities application.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional, List, Dict, Any, Literal
import logging
import json
from shapely import wkt
from shapely.geometry import mapping

from .models import (
    CityListResponse, CityDetailResponse, CityStatsResponse,
    PaginatedNodesResponse, PaginatedEdgesResponse, PaginatedTripsResponse,
    PaginatedFeaturesResponse, GeoJSONResponse, GeoJSONFeatureCollection,
    NodeResponse, EdgeResponse, TripResponse, FeatureResponse,
    CityResponse, NetworkStats, GeoJSONFeature, ErrorResponse,
    StationResponse, StationListResponse,
    TrafficResponse, TrafficCount, TrafficStats, TrafficMode, TrafficModesResponse,
    EdgeRoutesResponse
)
from .dependencies import (
    get_db_connection, calculate_pagination, parse_bbox,
    validate_network_exists, build_bbox_condition, check_database_health
)
from backend.database.db_io import (
    get_all_cities, get_city_center, count_nodes, count_edges,
    count_trips, count_features, get_nodes, get_edges, get_features,
    get_stations, get_edge_traffic, get_traffic_stats, get_traffic_modes,
    get_city_details, get_city_bounds,
    get_paginated_nodes, get_paginated_edges, get_paginated_trips,
    get_paginated_features, get_paginated_stations,
    get_station_hourly_availability, get_station_reachability,
    get_edge_route_traces, get_edge_route_od,
    get_accidents_geojson,
)

logger = logging.getLogger(__name__)
router = APIRouter()


# City endpoints
@router.get("/cities", response_model=CityListResponse)
async def list_networks(conn=Depends(get_db_connection)):
    """Get all cities."""
    try:
        networks_data = get_all_cities(conn)
        
        cities = []
        for row in networks_data:
            (city_id, name, description, wikidata_id, center_lat, center_lon, radius, angle,
             population, budget, coverage, cycling_network, 
             min_lat, max_lat, min_lon, max_lon,
             infra, traffic, accidents, topo, inter, stations, forum,
             mayor, mayor_party, service_name, stations_count, monthly_trips, bicycles_count) = row
            
            bounds = None
            if min_lat is not None and max_lat is not None and min_lon is not None and max_lon is not None:
                bounds = {
                    "min_lat": min_lat,
                    "max_lat": max_lat,
                    "min_lon": min_lon,
                    "max_lon": max_lon
                }

            available_modes = {
                "infrastructure": bool(infra),
                "traffic": bool(traffic),
                "accidents": bool(accidents),
                "terrain": bool(topo),
                "intersections": bool(inter),
                "stations": bool(stations),
                "forum": bool(forum)
            }

            cities.append(CityResponse(
                id=city_id,
                name=name,
                description=description,
                center_lat=center_lat,
                center_lon=center_lon,
                radius=radius,
                population=population,
                budget=budget,
                coverage=coverage,
                cycling_network=cycling_network,
                mayor=mayor,
                mayor_party=mayor_party,
                service_name=service_name,
                stations_count=int(stations_count) if stations_count is not None else None,
                monthly_trips=int(monthly_trips) if monthly_trips is not None else None,
                bicycles_count=int(bicycles_count) if bicycles_count is not None else None,
                bounds=bounds,
                available_modes=available_modes
            ))
        
        return CityListResponse(
            data=cities,
            count=len(cities),
            message="Cities retrieved successfully"
        )
    except Exception as e:
        logger.error(f"Error listing cities: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve cities")


@router.get("/cities/{city_id}", response_model=CityDetailResponse)
async def get_city(city_id: int, conn=Depends(get_db_connection)):
    """Get city details."""
    try:
        validate_network_exists(conn, city_id)
        
        city_dict = get_city_details(conn, city_id)
        if not city_dict:
            raise HTTPException(status_code=404, detail="City not found")
        
        bounds_dict = get_city_bounds(conn, city_id)

        available_modes = {
            "infrastructure": bool(city_dict.get("infrastructure")),
            "traffic": bool(city_dict.get("traffic")),
            "accidents": bool(city_dict.get("accidents")),
            "terrain": bool(city_dict.get("topography")),
            "intersections": bool(city_dict.get("intersections")),
            "stations": bool(city_dict.get("stations")),
            "forum": bool(city_dict.get("forum"))
        }

        city = CityResponse(
            id=city_dict["id"],
            name=city_dict["name"],
            description=city_dict.get("description"),
            center_lat=city_dict["center_lat"],
            center_lon=city_dict["center_lon"],
            radius=city_dict["radius"],
            population=city_dict.get("population"),
            budget=city_dict.get("budget"),
            coverage=city_dict.get("coverage"),
            cycling_network=city_dict.get("cycling_network"),
            mayor=city_dict.get("mayor"),
            mayor_party=city_dict.get("mayor_party"),
            service_name=city_dict.get("service_name"),
            stations_count=city_dict.get("stations_count"),
            monthly_trips=city_dict.get("monthly_trips"),
            bicycles_count=city_dict.get("bicycles_count"),
            bounds=bounds_dict,
            available_modes=available_modes
        )
        
        return CityDetailResponse(
            data=city,
            message="City retrieved successfully"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting city {city_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve city")


@router.get("/cities/{city_id}/stats", response_model=CityStatsResponse)
async def get_network_stats(city_id: int, conn=Depends(get_db_connection)):
    """Get city statistics."""
    try:
        validate_network_exists(conn, city_id)
        
        city_dict = get_city_details(conn, city_id)
        
        nodes_count = count_nodes(conn, city_id)
        edges_count = count_edges(conn, city_id)
        trips_count = count_trips(conn, city_id)
        features_count = count_features(conn, city_id)

        bounds = get_city_bounds(conn, city_id)

        stats = NetworkStats(
            city_id=city_id,
            city_name=city_dict["name"] if city_dict else "Unknown",
            nodes_count=nodes_count,
            edges_count=edges_count,
            trips_count=trips_count,
            features_count=features_count,
            bounds=bounds
        )
        
        return CityStatsResponse(
            data=stats,
            message="City statistics retrieved successfully"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting city stats {city_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve city statistics")


# Node endpoints
@router.get("/cities/{city_id}/nodes", response_model=PaginatedNodesResponse)
async def get_network_nodes(
    city_id: int,
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(100, ge=1, le=1000, description="Items per page"),
    bbox: Optional[str] = Query(None, description="Bounding box filter (min_lon,min_lat,max_lon,max_lat)"),
    conn=Depends(get_db_connection)
):
    """Get city nodes with pagination and optional bounding box filtering."""
    try:
        validate_network_exists(conn, city_id)
        bbox_coords = parse_bbox(bbox) if bbox else None
        
        offset = (page - 1) * per_page
        nodes_data, total = get_paginated_nodes(
            conn, city_id, bbox=bbox_coords, limit=per_page, offset=offset
        )
        
        _, _, total_pages = calculate_pagination(page, per_page, total)
        
        nodes = [NodeResponse(**row) for row in nodes_data]
        
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
        logger.error(f"Error getting nodes for city {city_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve nodes")


# Edge endpoints
@router.get("/cities/{city_id}/edges", response_model=PaginatedEdgesResponse)
async def get_network_edges(
    city_id: int,
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(100, ge=1, le=1000, description="Items per page"),
    highway: Optional[str] = Query(None, description="Filter by highway type"),
    bbox: Optional[str] = Query(None, description="Bounding box filter (min_lon,min_lat,max_lon,max_lat)"),
    conn=Depends(get_db_connection)
):
    """Get city edges with pagination and filtering."""
    try:
        validate_network_exists(conn, city_id)
        bbox_coords = parse_bbox(bbox) if bbox else None
        
        offset = (page - 1) * per_page
        edges_data, total = get_paginated_edges(
            conn, city_id, highway=highway, bbox=bbox_coords, limit=per_page, offset=offset
        )
        
        _, _, total_pages = calculate_pagination(page, per_page, total)
        
        edges = [EdgeResponse(**row) for row in edges_data]
        
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
        logger.error(f"Error getting edges for city {city_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve edges")


# Trip endpoints
@router.get("/cities/{city_id}/trips", response_model=PaginatedTripsResponse)
@router.get("/cities/{city_id}/routes", response_model=PaginatedTripsResponse)  # backward compat
async def get_network_trips(
    city_id: int,
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(100, ge=1, le=1000, description="Items per page"),
    generation_type: Optional[str] = Query(
        None,
        description="Filter by generation type: real | station_based | buildings_population",
    ),
    min_duration: Optional[float] = Query(None, ge=0, description="Minimum trip duration in minutes"),
    max_duration: Optional[float] = Query(None, ge=0, description="Maximum trip duration in minutes"),
    conn=Depends(get_db_connection)
):
    """Get city trips (demand records) with pagination and filtering."""
    try:
        validate_network_exists(conn, city_id)

        offset = (page - 1) * per_page
        trips_data, total = get_paginated_trips(
            conn, city_id,
            generation_type=generation_type,
            min_duration=min_duration,
            max_duration=max_duration,
            limit=per_page,
            offset=offset,
        )

        _, _, total_pages = calculate_pagination(page, per_page, total)

        trips = [TripResponse(**row) for row in trips_data]

        return PaginatedTripsResponse(
            data=trips,
            page=page,
            per_page=per_page,
            total=total,
            pages=total_pages,
            message="Trips retrieved successfully"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting trips for city {city_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve trips")


# Feature endpoints
@router.get("/cities/{city_id}/features", response_model=PaginatedFeaturesResponse)
async def get_network_features(
    city_id: int,
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(100, ge=1, le=1000, description="Items per page"),
    feature_type: Optional[str] = Query(None, description="Filter by feature type"),
    bbox: Optional[str] = Query(None, description="Bounding box filter (min_lon,min_lat,max_lon,max_lat)"),
    conn=Depends(get_db_connection)
):
    """Get city features with pagination and filtering."""
    try:
        validate_network_exists(conn, city_id)
        bbox_coords = parse_bbox(bbox) if bbox else None
        
        offset = (page - 1) * per_page
        features_data, total = get_paginated_features(
            conn, city_id, feature_type=feature_type, bbox=bbox_coords, limit=per_page, offset=offset
        )
        
        _, _, total_pages = calculate_pagination(page, per_page, total)
        
        features = [
            FeatureResponse(
                id=row["id"],
                feature_type=row["feature_type"],
                geometry=row["geometry"],
                tags=row["tags"]
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
        logger.error(f"Error getting features for city {city_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve features")


# GeoJSON endpoints
@router.get("/cities/{city_id}/edges/geojson", response_model=GeoJSONResponse)
async def get_network_edges_geojson(
    city_id: int,
    highway: Optional[str] = Query(None, description="Filter by highway type"),
    bbox: Optional[str] = Query(None, description="Bounding box filter (min_lon,min_lat,max_lon,max_lat)"),
    limit: int = Query(5000, ge=1, le=50000, description="Maximum number of edges"),
    conn=Depends(get_db_connection)
):
    """Get city edges as GeoJSON."""
    try:
        validate_network_exists(conn, city_id)

        bbox_coords = parse_bbox(bbox) if bbox else None

        edges_data, _ = get_paginated_edges(
            conn, city_id, highway=highway, bbox=bbox_coords, limit=limit, offset=0
        )

        # Convert to GeoJSON
        geojson_features = []
        for edge in edges_data:
            try:
                geom = wkt.loads(edge["geometry"])
                geojson_geom = mapping(geom)

                properties = {
                    "highway": edge["highway"],
                    "name": edge["name"],
                    "length": edge["length"],
                    "oneway": edge["oneway"]
                }

                geojson_features.append(GeoJSONFeature(
                    geometry=geojson_geom,
                    properties=properties
                ))
            except Exception as e:
                logger.warning(f"Failed to convert edge to GeoJSON: {e}")
                continue

        feature_collection = GeoJSONFeatureCollection(
            features=geojson_features
        )

        return GeoJSONResponse(
            data=feature_collection,
            message=f"Retrieved {len(geojson_features)} edges as GeoJSON"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting GeoJSON edges for city {city_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve GeoJSON edges")


@router.get("/cities/{city_id}/features/geojson", response_model=GeoJSONResponse)
async def get_network_features_geojson(
    city_id: int,
    feature_type: Optional[str] = Query(None, description="Filter by feature type"),
    bbox: Optional[str] = Query(None, description="Bounding box filter (min_lon,min_lat,max_lon,max_lat)"),
    limit: int = Query(1000, ge=1, le=500000, description="Maximum number of features"),
    conn=Depends(get_db_connection)
):
    """Get city features as GeoJSON."""
    try:
        validate_network_exists(conn, city_id)
        
        bbox_coords = parse_bbox(bbox) if bbox else None
        
        features_data, _ = get_paginated_features(
            conn, city_id, feature_type=feature_type, bbox=bbox_coords, limit=limit, offset=0
        )
        
        # Convert to GeoJSON
        geojson_features = []
        for feature in features_data:
            try:
                # Parse geometry
                geom = wkt.loads(feature["geometry"])
                geojson_geom = mapping(geom)
                
                # Parse tags (PostgreSQL JSONB is already a dict)
                properties: Dict[str, Any] = {}
                if feature["tags"]:
                    properties.update(feature["tags"])
                properties["feature_type"] = feature["feature_type"]
                
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
        logger.error(f"Error getting GeoJSON features for city {city_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve GeoJSON features")


# Station endpoints
@router.get("/cities/{city_id}/stations", response_model=StationListResponse)
async def get_city_stations(city_id: int, conn=Depends(get_db_connection)):
    """Get all stations for a city."""
    try:
        stations_data, _ = get_paginated_stations(conn, city_id, limit=10000, offset=0)
        
        stations = [StationResponse(**row) for row in stations_data]
        
        return StationListResponse(
            data=stations,
            count=len(stations),
            message="Stations retrieved successfully"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting stations for city {city_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve stations")


@router.get("/cities/{city_id}/stations/{station_id}/hourly-availability")
async def get_station_hourly_availability_api(
    city_id: int, station_id: str, 
    period: str = Query("all", description="Filtering period: all, week, weekend"),
    conn=Depends(get_db_connection)
):
    """Get the average bike availability per hour of the day for a specific station."""
    try:
        validate_network_exists(conn, city_id)
        data = get_station_hourly_availability(conn, city_id, station_id, day_mode=period)
        return {
            "data": [{"hour_of_day": int(r["hour_of_day"]), "avg_bikes": float(r["avg_bikes"])} for r in data],
            "message": "Hourly availability retrieved successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting hourly availability for station {station_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve hourly availability")


@router.get("/cities/{city_id}/stations/{station_id}/reach")
async def get_station_reach(
    city_id: int, station_id: str,
    max_distance: float = Query(1000.0, ge=100, le=5000, description="Max reachability distance in metres"),
    conn=Depends(get_db_connection),
):
    """Compute a reachability tree from the station's closest graph node.

    Returns edges as GeoJSON, a reach polygon, geodesic circle, and coverage %.
    """
    try:
        validate_network_exists(conn, city_id)

        stations_data, _ = get_paginated_stations(conn, city_id, limit=10000, offset=0)
        station = next((s for s in stations_data if str(s["station_id"]) == str(station_id)), None)
        if station is None:
            raise HTTPException(status_code=404, detail=f"Station {station_id} not found")

        result = get_station_reachability(
            conn, city_id, float(station["lat"]), float(station["lon"]),
            max_distance=max_distance,
        )

        features = [
            {
                "type": "Feature",
                "geometry": e["geojson_geom"],
                "properties": {
                    "dist_start": round(e["dist_start"], 1),
                    "dist_end": round(e["dist_end"], 1),
                },
            }
            for e in result["edges"]
        ]

        circle_feature = None
        if result["circle_geojson"]:
            circle_feature = {
                "type": "Feature",
                "geometry": result["circle_geojson"],
                "properties": {},
            }

        polygon_feature = None
        if result["polygon_geojson"]:
            polygon_feature = {
                "type": "Feature",
                "geometry": result["polygon_geojson"],
                "properties": {},
            }

        return {
            "data": {
                "edges": {
                    "type": "FeatureCollection",
                    "features": features,
                },
                "circle": circle_feature,
                "polygon": polygon_feature,
                "coverage": result["coverage"],
            },
            "message": f"Reachability tree with {len(features)} edges",
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error computing reachability for station {station_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to compute reachability")


# Traffic endpoints
@router.get("/cities/{city_id}/traffic/modes", response_model=TrafficModesResponse)
async def get_city_traffic_modes(
    city_id: int,
    conn=Depends(get_db_connection)
):
    """Return available (generation_type, algorithm) combinations for a city, sorted best-first."""
    try:
        validate_network_exists(conn, city_id)
        rows = get_traffic_modes(conn, city_id)
        return TrafficModesResponse(
            data=[TrafficMode(generation_type=r[0], algorithm=r[1], edge_count=r[2]) for r in rows],
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting traffic modes for city {city_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve traffic modes")


@router.get("/cities/{city_id}/traffic", response_model=TrafficResponse)
async def get_city_traffic(
    city_id: int,
    generation_type: Optional[str] = Query(None, description="Filter: real | station_based | buildings_population"),
    algorithm: Optional[str] = Query(None, description="Filter: map_matched | safest | shortest | grouped"),
    month: Optional[str] = Query(None, description="Month YYYY-MM (defaults to latest for combination)"),
    conn=Depends(get_db_connection)
):
    """Get trip counts per road segment. Defaults to best available (generation, algorithm) combination."""
    try:
        validate_network_exists(conn, city_id)

        from datetime import date as date_type
        month_date: Optional[date_type] = None
        if month:
            try:
                month_date = date_type.fromisoformat(month + "-01")
            except ValueError:
                raise HTTPException(status_code=422, detail="Invalid month format. Use YYYY-MM.")

        rows, resolved_gen, resolved_algo, resolved_month = get_edge_traffic(
            conn, city_id,
            generation_type=generation_type,
            algorithm=algorithm,
            month=month_date,
        )

        stats = None
        if resolved_gen and resolved_algo and resolved_month:
            raw = get_traffic_stats(conn, city_id, resolved_gen, resolved_algo, resolved_month)
            if raw:
                stats = TrafficStats(**raw)

        return TrafficResponse(
            data=[TrafficCount(edge_id=r[0], trip_count=r[1], month=r[2]) for r in rows],
            count=len(rows),
            generation_type=resolved_gen,
            algorithm=resolved_algo,
            month=resolved_month,
            stats=stats,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting traffic for city {city_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve traffic data")


@router.get("/cities/{city_id}/edges/{edge_id}/routes", response_model=EdgeRoutesResponse)
async def get_edge_routes(
    city_id: int,
    edge_id: int,
    mode: Literal["traces", "heatmap"] = Query("traces", description="Visualisation mode: traces or heatmap"),
    limit: int = Query(500, ge=1, le=1000, description="Max routes to return"),
    conn=Depends(get_db_connection),
):
    """Return routes passing through a specific edge as GeoJSON.

    mode=traces  → FeatureCollection of LineString geometries (one per route).
    mode=heatmap → FeatureCollection of Point geometries (origin + dest per route).
    """
    try:
        validate_network_exists(conn, city_id)

        # Verify the edge belongs to this city
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id FROM edges WHERE id = %s AND city_id = %s",
                (edge_id, city_id),
            )
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Edge not found in this city")

        if mode == "heatmap":
            rows = get_edge_route_od(conn, city_id, edge_id, limit=limit)
            features = []
            for row in rows:
                features.append({
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [row["origin_lon"], row["origin_lat"]]},
                    "properties": {"kind": "origin"},
                })
                features.append({
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [row["dest_lon"], row["dest_lat"]]},
                    "properties": {"kind": "destination"},
                })
            count = len(rows)
        else:
            geom_strings = get_edge_route_traces(conn, city_id, edge_id, limit=limit)
            features = [
                {"type": "Feature", "geometry": json.loads(g), "properties": {}}
                for g in geom_strings
            ]
            count = len(features)

        feature_collection = {
            "type": "FeatureCollection",
            "features": features,
        }

        return EdgeRoutesResponse(
            data=feature_collection,
            count=count,
            message=f"{count} routes found for edge {edge_id}",
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting routes for edge {edge_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve edge routes")


# Accidents endpoint
@router.get("/cities/{city_id}/accidents")
async def get_city_accidents(
    city_id: int,
    cyclists_only: bool = Query(True, description="Filter to cyclist-involved accidents only"),
    conn=Depends(get_db_connection),
):
    """Get accident data as GeoJSON for a city.

    Returns a GeoJSON FeatureCollection of Point features.
    Each feature has severity ('fatal', 'serious', 'minor', 'uninjured') and metadata.
    """
    try:
        validate_network_exists(conn, city_id)
        geojson = get_accidents_geojson(conn, city_id, cyclists_only=cyclists_only)
        return {
            "data": geojson,
            "count": len(geojson["features"]),
            "message": f"Retrieved {len(geojson['features'])} accidents",
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting accidents for city {city_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve accident data")


# Status endpoint
@router.get("/status")
async def get_system_status(conn=Depends(get_db_connection)):
    """System status: city stats + ingestion pipeline overview."""
    try:
        import datetime
        cities_data = get_all_cities(conn)

        # Feature counts by type per city in one query
        with conn.cursor() as cur:
            cur.execute("SELECT city_id, feature_type, COUNT(*) FROM features GROUP BY city_id, feature_type")
            feature_map: dict = {}
            for cid, ft, cnt in cur.fetchall():
                feature_map.setdefault(cid, {})[ft] = int(cnt)

        city_stats = []
        for row in cities_data:
            city_id, name = row[0], row[1]
            city_stats.append({
                "id": city_id,
                "name": name,
                "nodes": count_nodes(conn, city_id),
                "edges": count_edges(conn, city_id),
                "routes": count_routes(conn, city_id),
                "stations_count": int(row[26]) if row[26] is not None else 0,
                "monthly_trips": int(row[27]) if row[27] is not None else 0,
                "available_modes": {
                    "infrastructure": bool(row[16]),
                    "traffic": bool(row[17]),
                    "accidents": bool(row[18]),
                    "terrain": bool(row[19]),
                    "intersections": bool(row[20]),
                    "stations": bool(row[21]),
                    "forum": bool(row[22]),
                },
                "features": feature_map.get(city_id, {}),
            })

        with conn.cursor() as cur:
            cur.execute("""
                SELECT c.name, i.process_name, i.status, i.updated_at
                FROM ingestion_status i
                JOIN cities c ON c.id = i.city_id
                WHERE i.time_period IS NULL
                ORDER BY c.name, i.process_name
            """)
            ingestion_rows = [
                {"city": r[0], "process_name": r[1], "status": r[2],
                 "updated_at": r[3].isoformat() if r[3] else None}
                for r in cur.fetchall()
            ]

        with conn.cursor() as cur:
            cur.execute("""
                SELECT c.name, i.process_name, i.status, i.time_period, i.updated_at
                FROM ingestion_status i
                JOIN cities c ON c.id = i.city_id
                WHERE i.time_period IS NOT NULL
                ORDER BY c.name, i.process_name, i.time_period
            """)
            time_period_rows = [
                {"city": r[0], "process_name": r[1], "status": r[2],
                 "time_period": r[3], "updated_at": r[4].isoformat() if r[4] else None}
                for r in cur.fetchall()
            ]

        return {
            "data": {
                "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                "cities": city_stats,
                "ingestion": ingestion_rows,
                "ingestion_time_periods": time_period_rows,
            }
        }
    except Exception as e:
        logger.error(f"Error getting system status: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve system status")


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