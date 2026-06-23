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
    PaginatedNodesResponse, PaginatedEdgesResponse, EdgeSearchResponse, PaginatedTripsResponse,
    PaginatedFeaturesResponse, GeoJSONResponse, GeoJSONFeatureCollection,
    NodeResponse, EdgeResponse, TripResponse, FeatureResponse,
    CityResponse, NetworkStats, GeoJSONFeature, ErrorResponse,
    StationResponse, StationListResponse,
    TrafficResponse, TrafficResolveResponse, TrafficCount, TrafficStats, TrafficMode, TrafficModesResponse,
    TrafficEvolutionPoint, TrafficEvolutionResponse,
    EdgeRoutesResponse,
    InfraStatsResponse, InfraComponentsResponse, EdgeBuildingCoverageResponse,
    StationBuildingCoverageResponse,
    TrafficInfraCoverage, RouteHistogramResponse, RouteHistogramSeries, HistogramSeries,
    StationMonthlyResponse, StationMonthlyPoint,
    CityBudgetsResponse, BudgetYear, BudgetCategory,
    MayorsTimelineResponse, MayorRecord, ElectionResult, CouncilorRecord,
    MayorTermResponse, BudgetCategoryResponse, CityContextResponse,
)
from .dependencies import (
    get_db_connection, calculate_pagination, parse_bbox,
    validate_network_exists, build_bbox_condition, check_database_health
)
from backend.database.db_io import (
    get_all_cities, get_city_center, count_nodes, count_edges,
    count_trips, count_features, get_nodes, get_edges, get_features, get_od_hex_flows,
    get_stations, get_edge_traffic, get_traffic_stats, get_traffic_modes, get_max_traffic_edge,
    get_city_details, get_city_bounds, search_cities_by_name,
    get_paginated_nodes, get_paginated_edges, search_edges_by_name, get_paginated_trips,
    get_paginated_features, get_paginated_stations,
    get_station_hourly_availability, get_city_median_max_hourly_bikes, get_station_hourly_demand, get_station_reachability,
    get_edge_route_traces, get_edge_route_od, count_edge_routes,
    get_accidents_geojson, get_accidents_summary, get_accident_detail, get_vehicle_pair_severity,
    get_gcc_coverage, get_cycling_components_geojson, get_building_coverage_components_geojson,
    get_edge_building_coverage, get_infra_budget, get_building_coverage_fraction,
    get_traffic_infra_coverage, get_route_histogram,
    get_station_monthly_agg,
    get_avg_station_building_count, get_city_station_coverage,
    get_city_budgets, get_historical_mayors, get_city_elections_data,
    get_city_councilors_data,
    get_best_traffic_mode, get_latest_traffic_month, resolve_traffic_params,
    get_traffic_evolution,
)

logger = logging.getLogger(__name__)
router = APIRouter()


# City endpoints
@router.get("/cities", response_model=CityListResponse)
def list_networks(conn=Depends(get_db_connection)):
    """Get all cities."""
    try:
        networks_data = get_all_cities(conn)

        cities = []
        for row in networks_data:
            (city_id, name, alt_name, slug, description, wikidata_id,
             center_lat, center_lon, radius,
             population, budget, coverage, cycling_network,
             min_lat, max_lat, min_lon, max_lon,
             infra, traffic, traffic_combos, accidents, stations, transparency_submodes,
             mayor, mayor_party, service_name, stations_count, monthly_trips, bicycles_count, station_coverage) = row

            bounds = None
            if min_lat is not None and max_lat is not None and min_lon is not None and max_lon is not None:
                bounds = {
                    "min_lat": min_lat,
                    "max_lat": max_lat,
                    "min_lon": min_lon,
                    "max_lon": max_lon
                }

            t_submodes = transparency_submodes or []
            available_modes = {
                "infrastructure": bool(infra),
                "traffic": bool(traffic),
                "traffic_combinations": traffic_combos or [],
                "accidents": bool(accidents),
                "stations": bool(stations),
                "transparency": len(t_submodes) > 0,
                "transparency_submodes": t_submodes,
            }

            city_obj = CityResponse(
                id=city_id,
                name=name,
                alt_name=alt_name,
                slug=slug,
                description=description,
                center_lat=center_lat,
                center_lon=center_lon,
                radius=radius,
                population=population,
                budget=budget,
                mayor=mayor,
                mayor_party=mayor_party,
                service_name=service_name,
                stations_count=int(stations_count) if stations_count is not None else None,
                monthly_trips=int(monthly_trips) if monthly_trips is not None else None,
                bicycles_count=int(bicycles_count) if bicycles_count is not None else None,
                bounds=bounds,
                available_modes=available_modes,
                station_coverage=station_coverage,
                coverage=coverage,
                cycling_network=cycling_network
            )
            cities.append(city_obj)

        return CityListResponse(
            data=cities,
            count=len(cities),
            message="Cities retrieved successfully"
        )
    except Exception as e:
        logger.error(f"Error listing cities: {e}")
        raise HTTPException(status_code=500, detail="Error al obtener las ciudades")


@router.get("/cities/search", response_model=CityListResponse)
def search_cities(
    q: str = Query(..., min_length=1, description="City name to search for"),
    conn=Depends(get_db_connection)
):
    """Search cities by name using fuzzy matching."""
    try:
        cities_data = search_cities_by_name(conn, q)
        cities = [CityResponse(
            id=row["id"], name=row["name"], alt_name=row.get("alt_name"),
            slug=row["slug"], description=row.get("description"),
            center_lat=row.get("center_lat"), center_lon=row.get("center_lon"),
            radius=row.get("radius"),
        ) for row in cities_data]
        return CityListResponse(data=cities, message=f"Found {len(cities)} city/cities matching '{q}'")
    except Exception as e:
        logger.error(f"Error searching cities for '{q}': {e}")
        raise HTTPException(status_code=500, detail="Error al buscar ciudades")


@router.get("/cities/{city_id}", response_model=CityDetailResponse)
def get_city(city_id: int, conn=Depends(get_db_connection)):
    """Get city details."""
    try:
        validate_network_exists(conn, city_id)
        
        city_dict = get_city_details(conn, city_id)
        if not city_dict:
            raise HTTPException(status_code=404, detail="Ciudad no encontrada")
        
        bounds_dict = get_city_bounds(conn, city_id)

        t_submodes = city_dict.get("transparency_submodes") or []
        available_modes = {
            "infrastructure": bool(city_dict.get("infrastructure")),
            "traffic": bool(city_dict.get("traffic")),
            "traffic_combinations": city_dict.get("traffic_combinations") or [],
            "accidents": bool(city_dict.get("accidents")),
            "stations": bool(city_dict.get("stations")),
            "transparency": len(t_submodes) > 0,
            "transparency_submodes": t_submodes,
        }

        city = CityResponse(
            id=city_dict["id"],
            name=city_dict["name"],
            alt_name=city_dict.get("alt_name"),
            slug=city_dict["slug"],
            description=city_dict.get("description"),
            center_lat=city_dict["center_lat"],
            center_lon=city_dict["center_lon"],
            radius=city_dict["radius"],
            population=city_dict.get("population"),
            budget=city_dict.get("budget"),
            mayor=city_dict.get("mayor"),
            mayor_party=city_dict.get("mayor_party"),
            service_name=city_dict.get("service_name"),
            stations_count=int(city_dict.get("stations_count")) if city_dict.get("stations_count") is not None else None,
            monthly_trips=int(city_dict.get("monthly_trips")) if city_dict.get("monthly_trips") is not None else None,
            bicycles_count=int(city_dict.get("bicycles_count")) if city_dict.get("bicycles_count") is not None else None,
            bounds=bounds_dict,
            available_modes=available_modes,
            station_coverage=city_dict.get("station_coverage"),
            coverage=city_dict.get("coverage"),
            cycling_network=city_dict.get("cycling_network")
        )
        return CityDetailResponse(
            data=city,
            message="City retrieved successfully"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting city {city_id}: {e}")
        raise HTTPException(status_code=500, detail="Error al obtener la ciudad")


@router.get("/cities/{city_id}/stats", response_model=CityStatsResponse)
def get_network_stats(city_id: int, conn=Depends(get_db_connection)):
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
        raise HTTPException(status_code=500, detail="Error al obtener las estadísticas de la ciudad")


# Node endpoints
@router.get("/cities/{city_id}/nodes", response_model=PaginatedNodesResponse)
def get_network_nodes(
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
        raise HTTPException(status_code=500, detail="Error al obtener los nodos")


# Edge endpoints
@router.get("/cities/{city_id}/edges", response_model=PaginatedEdgesResponse)
def get_network_edges(
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
        raise HTTPException(status_code=500, detail="Error al obtener los tramos")


# Trip endpoints
@router.get("/cities/{city_id}/trips", response_model=PaginatedTripsResponse)
@router.get("/cities/{city_id}/routes", response_model=PaginatedTripsResponse)  # backward compat
def get_network_trips(
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
        raise HTTPException(status_code=500, detail="Error al obtener los trayectos")


@router.get("/cities/{city_id}/trips/od-flows")
def get_od_flows(
    city_id: int,
    generation_type: str = Query(..., description="Trip generation type"),
    period: Optional[str] = Query(None, description="Month filter YYYY-MM"),
    period_from: Optional[str] = Query(None, description="Start month filter YYYY-MM"),
    resolution: int = Query(8, ge=6, le=10, description="H3 resolution (8 ≈ 0.5 km edge)"),
    conn=Depends(get_db_connection),
):
    """O-D flows aggregated by H3 hex as a GeoJSON FeatureCollection."""
    try:
        geojson = get_od_hex_flows(conn, city_id, generation_type, period=period, resolution=resolution, period_from=period_from)
        return geojson
    except Exception as e:
        logger.error(f"Error computing OD hex flows for city {city_id}: {e}")
        raise HTTPException(status_code=500, detail="Error al calcular flujos O-D")


# Feature endpoints
@router.get("/cities/{city_id}/features", response_model=PaginatedFeaturesResponse)
def get_network_features(
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
        raise HTTPException(status_code=500, detail="Error al obtener los elementos")


# GeoJSON endpoints
@router.get("/cities/{city_id}/edges/geojson", response_model=GeoJSONResponse)
def get_network_edges_geojson(
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
        raise HTTPException(status_code=500, detail="Error al obtener la geometría de los tramos")


@router.get("/cities/{city_id}/edges/search", response_model=EdgeSearchResponse)
def search_network_edges(
    city_id: int,
    q: str = Query(..., min_length=1, description="Street name to search for"),
    conn=Depends(get_db_connection)
):
    """Search edges by street name using fuzzy matching (pg_trgm if available, ILIKE fallback)."""
    try:
        validate_network_exists(conn, city_id)
        rows = search_edges_by_name(conn, city_id, q)
        edges = [EdgeResponse(**row) for row in rows]
        return EdgeSearchResponse(
            data=edges,
            message=f"Found {len(edges)} edge(s) matching '{q}'"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error searching edges for city {city_id} query '{q}': {e}")
        raise HTTPException(status_code=500, detail="Error al buscar tramos por nombre")


@router.get("/cities/{city_id}/features/geojson", response_model=GeoJSONResponse)
def get_network_features_geojson(
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
        raise HTTPException(status_code=500, detail="Error al obtener la geometría de los elementos")


# Station endpoints
@router.get("/cities/{city_id}/stations", response_model=StationListResponse)
def get_city_stations(city_id: int, conn=Depends(get_db_connection)):
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
        raise HTTPException(status_code=500, detail="Error al obtener las estaciones")


@router.get("/cities/{city_id}/stations/median-max-hourly-bikes")
def get_city_median_max_hourly_bikes_api(city_id: int, conn=Depends(get_db_connection)):
    """Median across stations of each station's peak hourly bike availability (last 3 months)."""
    try:
        value = get_city_median_max_hourly_bikes(conn, city_id)
        return {"data": {"median_max_hourly_bikes": value}}
    except Exception as e:
        logger.error(f"Error computing median max hourly bikes for city {city_id}: {e}")
        raise HTTPException(status_code=500, detail="Error al calcular la disponibilidad horaria")


@router.get("/cities/{city_id}/stations/{station_id}/demand-profile")
def get_station_demand_profile_api(city_id: int, station_id: str, conn=Depends(get_db_connection)):
    """Hourly departure (lambda) and arrival (mu) demand profile for the latest available month."""
    try:
        rows = get_station_hourly_demand(conn, city_id, station_id)
        return {
            "data": [
                {"hour_of_day": int(r[0]), "lambda_departure": float(r[1]) if r[1] is not None else 0.0,
                 "mu_arrival": float(r[2]) if r[2] is not None else 0.0}
                for r in rows
            ]
        }
    except Exception as e:
        logger.error(f"Error getting demand profile for station {station_id}: {e}")
        raise HTTPException(status_code=500, detail="Error al obtener el perfil de demanda")


@router.get("/cities/{city_id}/stations/{station_id}/hourly-availability")
def get_station_hourly_availability_api(
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
        raise HTTPException(status_code=500, detail="Error al obtener la disponibilidad horaria")


@router.get("/cities/{city_id}/stations/{station_id}/reach")
def get_station_reach(
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
        raise HTTPException(status_code=500, detail="Error al calcular el alcance")


# Traffic endpoints
@router.get("/cities/{city_id}/traffic/modes", response_model=TrafficModesResponse)
def get_city_traffic_modes(
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
        raise HTTPException(status_code=500, detail="Error al obtener los modos de tráfico")


@router.get("/cities/{city_id}/traffic", response_model=TrafficResponse)
def get_city_traffic(
    city_id: int,
    generation_type: Optional[str] = Query(None, description="Filter: real | station_based | buildings_population"),
    algorithm: Optional[str] = Query(None, description="Filter: map_matched | safest | shortest | grouped"),
    month: Optional[str] = Query(None, description="Month YYYY-MM (end of range, defaults to latest)"),
    month_from: Optional[str] = Query(None, description="Start month YYYY-MM (range start)"),
    conn=Depends(get_db_connection)
):
    """Get trip counts per road segment. Defaults to best available (generation, algorithm) combination."""
    try:
        validate_network_exists(conn, city_id)

        from datetime import date as date_type
        month_date: Optional[date_type] = None
        month_from_date: Optional[date_type] = None
        if month:
            try:
                month_date = date_type.fromisoformat(month + "-01")
            except ValueError:
                raise HTTPException(status_code=422, detail="Formato de mes inválido. Use AAAA-MM.")
        if month_from:
            try:
                month_from_date = date_type.fromisoformat(month_from + "-01")
            except ValueError:
                raise HTTPException(status_code=422, detail="Formato de mes inválido. Use AAAA-MM.")

        rows, resolved_gen, resolved_algo, resolved_month = get_edge_traffic(
            conn, city_id,
            generation_type=generation_type,
            algorithm=algorithm,
            month=month_date,
            month_from=month_from_date,
        )

        stats = None
        max_edge_name = None
        if resolved_gen and resolved_algo and resolved_month:
            raw = get_traffic_stats(conn, city_id, resolved_gen, resolved_algo, resolved_month, month_from=month_from_date)
            if raw:
                stats = TrafficStats(**raw)
            max_edge = get_max_traffic_edge(conn, city_id, resolved_gen, resolved_algo, resolved_month, month_from=month_from_date)
            if max_edge:
                max_edge_name = max_edge.get('edge_name')

        # Distinct available months for this city
        available_periods = None
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT DISTINCT TO_CHAR(month, 'YYYY-MM') AS period
                    FROM edge_traffic
                    WHERE city_id = %s
                    ORDER BY period DESC
                    """,
                    (city_id,),
                )
                available_periods = [r[0] for r in cur.fetchall()]
        except Exception as periods_err:
            logger.warning(f"Could not fetch available traffic periods for city {city_id}: {periods_err}")

        return TrafficResponse(
            data=[TrafficCount(edge_id=r[0], trip_count=r[1], month=r[2]) for r in rows],
            count=len(rows),
            generation_type=resolved_gen,
            algorithm=resolved_algo,
            month=resolved_month,
            stats=stats,
            available_periods=available_periods,
            max_edge_name=max_edge_name,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting traffic for city {city_id}: {e}")
        raise HTTPException(status_code=500, detail="Error al obtener los datos de tráfico")


@router.get("/cities/{city_id}/traffic/resolve", response_model=TrafficResolveResponse)
def resolve_city_traffic(
    city_id: int,
    generation_type: Optional[str] = Query(None),
    algorithm: Optional[str] = Query(None),
    month: Optional[str] = Query(None, description="Month YYYY-MM end of range (defaults to latest)"),
    month_from: Optional[str] = Query(None, description="Start month YYYY-MM"),
    conn=Depends(get_db_connection),
):
    """Resolve traffic parameters and return stats without per-edge data.

    The frontend uses this endpoint to determine which (generation_type, algorithm, month)
    combination to use and what the percentile stats are for the colormap.  The actual
    trip_count values are now baked into the Martin vector tiles via the
    edges_with_traffic() function source, so no bulk setFeatureState() loop is needed.
    """
    try:
        validate_network_exists(conn, city_id)

        from datetime import date as date_type
        month_date: Optional[date_type] = None
        month_from_date: Optional[date_type] = None
        if month:
            try:
                month_date = date_type.fromisoformat(month + "-01")
            except ValueError:
                raise HTTPException(status_code=422, detail="Invalid month format. Use YYYY-MM.")
        if month_from:
            try:
                month_from_date = date_type.fromisoformat(month_from + "-01")
            except ValueError:
                raise HTTPException(status_code=422, detail="Invalid month format. Use YYYY-MM.")

        resolved_gen, resolved_algo, resolved_month = resolve_traffic_params(
            conn, city_id,
            generation_type=generation_type,
            algorithm=algorithm,
            month=month_date,
        )

        if not resolved_gen or not resolved_algo or not resolved_month:
            return TrafficResolveResponse(
                success=True,
                message="No traffic data available for this city",
                generation_type=None,
                algorithm=None,
                month=None,
                stats=None,
                available_periods=[],
            )

        stats = None
        max_edge_name = None
        edge_count = None
        raw = get_traffic_stats(conn, city_id, resolved_gen, resolved_algo, resolved_month, month_from=month_from_date)
        if raw:
            edge_count = raw.get('edge_count')
            stats = TrafficStats(**{k: v for k, v in raw.items() if k != 'edge_count'})

        max_edge = get_max_traffic_edge(conn, city_id, resolved_gen, resolved_algo, resolved_month, month_from=month_from_date)
        if max_edge:
            max_edge_name = max_edge.get('edge_name')

        available_periods = None
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT DISTINCT TO_CHAR(month, 'YYYY-MM') AS period
                    FROM edge_traffic
                    WHERE city_id = %s
                      AND generation_type = %s
                      AND algorithm = %s
                    ORDER BY period DESC
                    """,
                    (city_id, resolved_gen, resolved_algo),
                )
                available_periods = [r[0] for r in cur.fetchall()]
        except Exception as periods_err:
            logger.warning(f"Could not fetch available traffic periods: {periods_err}")

        return TrafficResolveResponse(
            message="Traffic parameters resolved",
            generation_type=resolved_gen,
            algorithm=resolved_algo,
            month=resolved_month,
            stats=stats,
            available_periods=available_periods,
            max_edge_name=max_edge_name,
            edge_count=edge_count,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error resolving traffic for city {city_id}: {e}")
        raise HTTPException(status_code=500, detail="Error al resolver los parámetros de tráfico")


@router.get("/cities/{city_id}/traffic/evolution", response_model=TrafficEvolutionResponse)
def get_city_traffic_evolution(
    city_id: int,
    generation_type: Optional[str] = Query(None),
    algorithm: Optional[str] = Query(None),
    conn=Depends(get_db_connection),
):
    """Return per-month active-edge counts for all available periods.

    Replaces the frontend pattern of calling /traffic/resolve once per period
    to build the evolution chart — returns all months in a single query.
    """
    try:
        validate_network_exists(conn, city_id)

        resolved_gen, resolved_algo, _ = resolve_traffic_params(
            conn, city_id, generation_type=generation_type, algorithm=algorithm
        )

        if not resolved_gen or not resolved_algo:
            return TrafficEvolutionResponse(
                success=True,
                message="No traffic data available",
                generation_type=None,
                algorithm=None,
                data=[],
            )

        points = get_traffic_evolution(conn, city_id, resolved_gen, resolved_algo)

        return TrafficEvolutionResponse(
            message="Evolution data retrieved",
            generation_type=resolved_gen,
            algorithm=resolved_algo,
            data=[TrafficEvolutionPoint(**p) for p in points],
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting traffic evolution for city {city_id}: {e}")
        raise HTTPException(status_code=500, detail="Error al obtener la evolución del tráfico")


@router.get("/cities/{city_id}/edges/{edge_id}/routes", response_model=EdgeRoutesResponse)
def get_edge_routes(
    city_id: int,
    edge_id: int,
    mode: Literal["traces", "heatmap"] = Query("traces", description="Visualisation mode: traces or heatmap"),
    limit: int = Query(100, ge=1, le=1000, description="Page size"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    generation_type: Optional[str] = Query(None, description="Trip generation filter"),
    algorithm: Optional[str] = Query(None, description="Path algorithm filter"),
    month: Optional[str] = Query(None, description="Month filter YYYY-MM"),
    month_from: Optional[str] = Query(None, description="Start month filter YYYY-MM"),
    skip_count: bool = Query(False, description="Skip the total count query; use tile trip_count instead"),
    conn=Depends(get_db_connection),
):
    """Return routes passing through a specific edge as GeoJSON.

    mode=traces  → FeatureCollection of LineString geometries (one per route).
    mode=heatmap → FeatureCollection of Point geometries (origin + dest per route).

    Supports pagination via limit+offset and filtering by generation/algorithm/month
    so the client can iteratively load all matching routes.
    """
    try:
        with conn.cursor() as _cur:
            _cur.execute("SET LOCAL statement_timeout = '30s'")

        validate_network_exists(conn, city_id)

        # Verify the edge belongs to this city
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id FROM edges WHERE id = %s AND city_id = %s",
                (edge_id, city_id),
            )
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Tramo no encontrado en esta ciudad")

        total = 0 if skip_count else count_edge_routes(
            conn, city_id, edge_id,
            generation_type=generation_type,
            algorithm=algorithm,
            month=month,
            month_from=month_from,
        )

        if mode == "heatmap":
            rows = get_edge_route_od(
                conn, city_id, edge_id,
                limit=limit, offset=offset,
                generation_type=generation_type,
                algorithm=algorithm,
                month=month,
                month_from=month_from,
            )
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
            geom_strings = get_edge_route_traces(
                conn, city_id, edge_id,
                limit=limit, offset=offset,
                generation_type=generation_type,
                algorithm=algorithm,
                month=month,
                month_from=month_from,
            )
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
            total=total,
            offset=offset,
            message=f"{count}/{total} routes returned for edge {edge_id}",
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting routes for edge {edge_id}: {e}")
        raise HTTPException(status_code=500, detail="Error al obtener las rutas de los tramos")


# Accidents endpoints
@router.get("/cities/{city_id}/accidents")
def get_city_accidents(
    city_id: int,
    cyclists_only: bool = Query(True, description="Filter to cyclist-involved accidents only"),
    year_from: Optional[int] = Query(None, description="Start year (inclusive)"),
    year_to: Optional[int] = Query(None, description="End year (inclusive)"),
    conn=Depends(get_db_connection),
):
    """Slim GeoJSON FeatureCollection for the map (no per-victim participants).

    Each feature has severity ('fatal', 'serious', 'minor', 'uninjured') plus
    accident-level metadata. Per-victim breakdown is at /accidents/{accident_id}.
    """
    try:
        with conn.cursor() as _cur:
            _cur.execute("SET LOCAL statement_timeout = '30s'")
        validate_network_exists(conn, city_id)
        geojson = get_accidents_geojson(conn, city_id, cyclists_only=cyclists_only, year_from=year_from, year_to=year_to)
        return {
            "data": geojson,
            "count": len(geojson["features"]),
            "message": f"Retrieved {len(geojson['features'])} accidents",
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting accidents for city {city_id}: {e}")
        raise HTTPException(status_code=500, detail="Error al obtener los datos de accidentes")


@router.get("/cities/{city_id}/accidents/summary")
def get_city_accidents_summary(
    city_id: int,
    year_from: Optional[int] = Query(None, description="Start year (inclusive)"),
    year_to: Optional[int] = Query(None, description="End year (inclusive)"),
    conn=Depends(get_db_connection),
):
    """Aggregate counts (total / cyclist / pedestrian / latest_year / available_years)."""
    try:
        validate_network_exists(conn, city_id)
        return {"data": get_accidents_summary(conn, city_id, year_from=year_from, year_to=year_to)}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting accidents summary for city {city_id}: {e}")
        raise HTTPException(status_code=500, detail="Error al obtener el resumen de accidentes")


@router.get("/cities/{city_id}/accidents/pair-stats")
def get_city_accidents_pair_stats(
    city_id: int,
    year_from: Optional[int] = Query(None, description="Start year (inclusive)"),
    year_to: Optional[int] = Query(None, description="End year (inclusive)"),
    conn=Depends(get_db_connection),
):
    """Per-vehicle-type severity for each vehicle-pair combination."""
    try:
        validate_network_exists(conn, city_id)
        return {"data": get_vehicle_pair_severity(conn, city_id, year_from=year_from, year_to=year_to)}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting pair stats for city {city_id}: {e}")
        raise HTTPException(status_code=500, detail="Error al obtener estadísticas de pares de vehículos")


@router.get("/cities/{city_id}/accidents/{accident_id}")
def get_city_accident_detail(city_id: int, accident_id: str, conn=Depends(get_db_connection)):
    """Per-victim breakdown for a single accident."""
    try:
        validate_network_exists(conn, city_id)
        detail = get_accident_detail(conn, city_id, accident_id)
        if detail is None:
            raise HTTPException(status_code=404, detail="Accidente no encontrado")
        return {"data": detail}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting accident {accident_id}: {e}")
        raise HTTPException(status_code=500, detail="Error al obtener el detalle del accidente")


# ── Infrastructure analytics ──────────────────────────────────────────────────

@router.get("/cities/{city_id}/infrastructure/stats", response_model=InfraStatsResponse)
def get_infrastructure_stats(city_id: int, conn=Depends(get_db_connection)):
    """Return infrastructure analytics: GCC coverage and Vías Públicas budget (cod. 153)."""
    try:
        validate_network_exists(conn, city_id)
        gcc    = get_gcc_coverage(conn, city_id)
        budget = get_infra_budget(conn, city_id)
        coverage = get_building_coverage_fraction(conn, city_id)

        total_km = gcc.get("total_km")
        vias_eur = budget.get("amount_eur")
        km_per_meur = (total_km / (vias_eur / 1_000_000)) if (total_km and vias_eur and vias_eur > 0) else None

        return InfraStatsResponse(
            message="Infrastructure stats retrieved",
            data={
                "gcc_fraction": gcc.get("gcc_fraction"),
                "gcc_km": gcc.get("gcc_km"),
                "total_km": total_km,
                "n_components": gcc.get("n_components", 0),
                "coverage": coverage,
                "vias_budget_year": budget.get("year"),
                "vias_budget_type": budget.get("budget_type"),
                "vias_budget_eur": vias_eur,
                "km_per_meur_vias": round(km_per_meur, 3) if km_per_meur else None,
            },
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting infra stats for city {city_id}: {e}")
        raise HTTPException(status_code=500, detail="Error al obtener las estadísticas de infraestructura")


@router.get("/cities/{city_id}/infrastructure/components", response_model=InfraComponentsResponse)
def get_infrastructure_components(city_id: int, conn=Depends(get_db_connection)):
    """Return cycling edges as GeoJSON with component_id (0 = largest component)."""
    try:
        validate_network_exists(conn, city_id)
        geojson = get_cycling_components_geojson(conn, city_id)
        return InfraComponentsResponse(message="Infrastructure components retrieved", data=geojson)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting infra components for city {city_id}: {e}")
        raise HTTPException(status_code=500, detail="Error al obtener los componentes de infraestructura")


@router.get("/cities/{city_id}/infrastructure/building-coverage", response_model=InfraComponentsResponse)
def get_infrastructure_building_coverage(city_id: int, conn=Depends(get_db_connection)):
    """Return bike_path_buildings as GeoJSON with component_id based on 150m buffer connectivity."""
    try:
        geojson = get_building_coverage_components_geojson(conn, city_id)
        return InfraComponentsResponse(message="Building coverage components retrieved", data=geojson)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting building coverage components for city {city_id}: {e}")
        raise HTTPException(status_code=500, detail="Error al obtener los datos de cobertura de edificios")


@router.get("/cities/{city_id}/infrastructure/edge-building-coverage", response_model=EdgeBuildingCoverageResponse)
def get_infrastructure_edge_building_coverage(city_id: int, conn=Depends(get_db_connection)):
    """Return per-edge building counts for histogram of edge effectiveness (buildings/km)."""
    try:
        edges = get_edge_building_coverage(conn, city_id)
        return EdgeBuildingCoverageResponse(message="Edge building coverage retrieved", edges=edges)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting edge building coverage for city {city_id}: {e}")
        raise HTTPException(status_code=500, detail="Error al obtener la cobertura de edificios por tramo")


# ── Traffic analytics ─────────────────────────────────────────────────────────

@router.get("/cities/{city_id}/traffic/infra-coverage", response_model=TrafficInfraCoverage)
def get_city_traffic_infra_coverage(
    city_id: int,
    generation_type: Optional[str] = Query(None),
    algorithm: Optional[str] = Query(None),
    month: Optional[str] = Query(None, description="YYYY-MM"),
    month_from: Optional[str] = Query(None, description="Start month YYYY-MM for range aggregation"),
    conn=Depends(get_db_connection),
):
    """Return km of simulated trips on cycling infrastructure for a given (gen, algo, month)."""
    try:
        validate_network_exists(conn, city_id)

        from datetime import date as date_type
        if generation_type is None or algorithm is None:
            best = get_best_traffic_mode(conn, city_id)
            if not best:
                return TrafficInfraCoverage(message="No traffic data", data={})
            generation_type, algorithm = best

        month_date = None
        if month:
            month_date = date_type.fromisoformat(month + "-01")
        if month_date is None:
            month_date = get_latest_traffic_month(conn, city_id, generation_type, algorithm)
        if month_date is None:
            return TrafficInfraCoverage(message="No traffic data for this combination", data={})

        month_from_date = date_type.fromisoformat(month_from + "-01") if month_from else None

        cov = get_traffic_infra_coverage(conn, city_id, generation_type, algorithm, month_date, month_from=month_from_date)
        return TrafficInfraCoverage(
            message="Traffic infrastructure coverage retrieved",
            data={
                "generation_type": generation_type,
                "algorithm": algorithm,
                "month": month_date,
                **cov,
            },
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting traffic infra coverage for city {city_id}: {e}")
        raise HTTPException(status_code=500, detail="Error al obtener la cobertura de infraestructura de tráfico")


@router.get("/cities/{city_id}/traffic/histogram", response_model=RouteHistogramResponse)
def get_city_route_histogram(
    city_id: int,
    bins: int = Query(20, ge=5, le=50, description="Number of histogram bins"),
    conn=Depends(get_db_connection),
):
    """Return route-length and infra-fraction histograms for all available strategies."""
    try:
        validate_network_exists(conn, city_id)
        with conn.cursor() as _cur:
            _cur.execute("SET LOCAL statement_timeout = '20s'")
        data = get_route_histogram(conn, city_id, bins=bins)
        series = [
            RouteHistogramSeries(
                generation_type=d["generation_type"],
                algorithm=d["algorithm"],
                n_routes=d["n_routes"],
                length_km=HistogramSeries(**d["length_km"]),
                infra_fraction=HistogramSeries(**d["infra_fraction"]),
            )
            for d in data
        ]
        return RouteHistogramResponse(data=series, message=f"{len(series)} series computed")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting route histogram for city {city_id}: {e}")
        raise HTTPException(status_code=500, detail="Error al obtener el histograma de rutas")


# ── Station analytics ─────────────────────────────────────────────────────────

@router.get("/cities/{city_id}/stations/building-coverage", response_model=StationBuildingCoverageResponse)
def get_station_building_coverage_route(city_id: int, conn=Depends(get_db_connection)):
    """Return station building metrics: avg count per station and true city-wide coverage % (study area)."""
    try:
        avg_count = get_avg_station_building_count(conn, city_id)
        city_coverage = get_city_station_coverage(conn, city_id)
        return StationBuildingCoverageResponse(
            message="Station building metrics retrieved", 
            avg_count=avg_count,
            city_coverage=city_coverage
        )
    except Exception as e:
        logger.error(f"Error getting station building metrics for city {city_id}: {e}")
        raise HTTPException(status_code=500, detail="Error al obtener las métricas de edificios de estaciones")


@router.get("/cities/{city_id}/stations/monthly", response_model=StationMonthlyResponse)
def get_city_station_monthly(city_id: int, conn=Depends(get_db_connection)):
    """Return monthly aggregated station trips (estimated + actual) for the city."""
    try:
        validate_network_exists(conn, city_id)
        rows = get_station_monthly_agg(conn, city_id)
        return StationMonthlyResponse(
            data=[StationMonthlyPoint(**r) for r in rows],
            message=f"{len(rows)} months returned",
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting station monthly for city {city_id}: {e}")
        raise HTTPException(status_code=500, detail="Error al obtener los datos mensuales de estaciones")


# ── Budget & political data ───────────────────────────────────────────────────

@router.get("/cities/{city_id}/budgets", response_model=CityBudgetsResponse)
def get_city_budgets_endpoint(city_id: int, conn=Depends(get_db_connection)):
    """Return all budget years with functional category lines for sunburst visualization."""
    try:
        validate_network_exists(conn, city_id)
        raw = get_city_budgets(conn, city_id)
        years = [
            BudgetYear(
                year=r["year"],
                total_income=r.get("total_income"),
                total_expenses=r.get("total_expenses"),
                public_debt=r.get("public_debt"),
                lines=[
                    BudgetCategory(
                        category_code=ln["category_code"],
                        category_name=ln.get("category_name"),
                        amount=ln["amount"],
                        budget_type=ln["budget_type"],
                    )
                    for ln in (r.get("lines") or [])
                ],
            )
            for r in raw
        ]
        return CityBudgetsResponse(data=years, message=f"{len(years)} budget years returned")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting budgets for city {city_id}: {e}")
        raise HTTPException(status_code=500, detail="Error al obtener los presupuestos")


@router.get("/cities/{city_id}/mayors", response_model=MayorsTimelineResponse)
def get_city_mayors_timeline(city_id: int, conn=Depends(get_db_connection)):
    """Return historical mayors list and electoral results for a timeline/Gantt chart."""
    try:
        validate_network_exists(conn, city_id)
        mayors = get_historical_mayors(conn, city_id)
        elections = get_city_elections_data(conn, city_id)
        councilors = get_city_councilors_data(conn, city_id)
        return MayorsTimelineResponse(
            mayors=[MayorRecord(**m) for m in mayors],
            elections=[ElectionResult(**e) for e in elections],
            councilors=[CouncilorRecord(**c) for c in councilors],
            message=f"{len(mayors)} mayors, {len(elections)} election records",
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting mayors timeline for city {city_id}: {e}")
        raise HTTPException(status_code=500, detail="Error al obtener la historia de alcaldes")


@router.get("/cities/{city_id}/context", response_model=CityContextResponse)
def get_city_context(city_id: int, conn=Depends(get_db_connection)):
    """Return city context: historical mayors and latest budget categories."""
    try:
        validate_network_exists(conn, city_id)

        # Fetch mayors
        with conn.cursor() as cur:
            cur.execute(
                "SELECT name, party, start_date, end_date FROM historical_mayors WHERE city_id = %s ORDER BY start_date ASC",
                (city_id,),
            )
            mayors = [
                MayorTermResponse(name=r[0], party=r[1], start_date=r[2], end_date=r[3])
                for r in cur.fetchall()
            ]

        # Fetch latest budget year
        with conn.cursor() as cur:
            cur.execute(
                "SELECT MAX(year) FROM city_budget_categories WHERE city_id = %s",
                (city_id,),
            )
            row = cur.fetchone()
            budget_year = row[0] if row else None

        # Fetch budget categories for that year
        budget_categories: Dict[str, List[BudgetCategoryResponse]] = {}
        if budget_year is not None:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT budget_type, category_code AS code, category_name AS name, amount "
                    "FROM city_budget_categories WHERE city_id = %s AND year = %s ORDER BY category_code",
                    (city_id, budget_year),
                )
                for budget_type, code, name, amount in cur.fetchall():
                    budget_categories.setdefault(budget_type, []).append(
                        BudgetCategoryResponse(code=code, name=name, amount=amount)
                    )

        return CityContextResponse(
            mayors=mayors,
            budget_year=budget_year,
            budget_categories=budget_categories,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting city context for city {city_id}: {e}")
        raise HTTPException(status_code=500, detail="Error al obtener el contexto de la ciudad")


# Status endpoint
@router.get("/status")
def get_system_status(conn=Depends(get_db_connection)):
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
            (city_id, name, alt_name, slug, description, wikidata_id,
             center_lat, center_lon, radius,
             population, budget, coverage, cycling_network,
             min_lat, max_lat, min_lon, max_lon,
             infra, traffic, traffic_combos, accidents, stations, transparency_submodes,
             mayor, mayor_party, service_name, stations_count, monthly_trips, bicycles_count, station_coverage) = row

            city_stats.append({
                "id": city_id,
                "name": name,
                "nodes": count_nodes(conn, city_id),
                "edges": count_edges(conn, city_id),
                "routes": count_trips(conn, city_id),
                "stations_count": int(stations_count) if stations_count is not None else 0,
                "monthly_trips": int(monthly_trips) if monthly_trips is not None else 0,
                "available_modes": {
                    "infrastructure": bool(infra),
                    "traffic": bool(traffic),
                    "traffic_combinations": traffic_combos or [],
                    "accidents": bool(accidents),
                    "stations": bool(stations),
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
        raise HTTPException(status_code=500, detail="Error al obtener el estado del sistema")


# Health check with database validation
@router.get("/health/detailed")
def detailed_health_check(conn=Depends(get_db_connection)):
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