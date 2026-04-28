"""
Pydantic models for API request/response schemas.
"""

from typing import List, Optional, Dict, Any, Union
from pydantic import BaseModel, Field
from datetime import datetime, date
from geojson_pydantic import Feature, FeatureCollection, Point, LineString, Polygon


# Base response model
class BaseResponse(BaseModel):
    """Base response model with common fields."""
    success: bool = True
    message: Optional[str] = None


# City models
class NetworkBase(BaseModel):
    """Base city model."""
    name: str
    alt_name: Optional[str] = None
    slug: str
    description: Optional[str] = None
    center_lat: Optional[float] = None
    center_lon: Optional[float] = None
    radius: Optional[float] = None


class CityResponse(NetworkBase):
    """City response model."""
    id: int
    created_at: Optional[datetime] = None
    population: Optional[int] = None
    budget: Optional[float] = None
    coverage: Optional[float] = None
    cycling_network: Optional[float] = None
    mayor: Optional[str] = None
    mayor_party: Optional[str] = None
    service_name: Optional[str] = None
    stations_count: Optional[int] = None
    monthly_trips: Optional[int] = None
    bicycles_count: Optional[int] = None
    bounds: Optional[Dict[str, float]] = None
    available_modes: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True


class CityListResponse(BaseResponse):
    """Response model for city list."""
    data: List[CityResponse]
    count: int


class CityDetailResponse(BaseResponse):
    """Response model for city details."""
    data: CityResponse


# Statistics models
class NetworkStats(BaseModel):
    """City statistics model."""
    city_id: int
    city_name: str
    nodes_count: int
    edges_count: int
    trips_count: int
    features_count: int
    bounds: Optional[Dict[str, float]] = None  # min_lat, max_lat, min_lon, max_lon


class CityStatsResponse(BaseResponse):
    """Response model for city statistics."""
    data: NetworkStats


# Spatial data models
class NodeResponse(BaseModel):
    """Node response model."""
    id: int
    lat: float
    lon: float
    street_count: int

    class Config:
        from_attributes = True


class EdgeResponse(BaseModel):
    """Edge response model."""
    id: int
    osmid: Optional[int] = None
    u: int  # from node
    v: int  # to node
    k: Optional[int] = None
    highway: Optional[str] = None
    name: Optional[str] = None
    length: Optional[float] = None
    width: Optional[float] = None
    maxspeed: Optional[List[int]] = None
    lanes: Optional[List[int]] = None
    oneway: Optional[bool] = None
    tunnel: Optional[bool] = None
    bridge: Optional[bool] = None
    geometry: Optional[str] = None  # WKT format

    class Config:
        from_attributes = True


class TripResponse(BaseModel):
    """Trip response model (demand record: real or synthetic O-D pair)."""
    id: int
    id_trip: str
    origin_node: int
    dest_node: int
    generation_type: str        # 'real' | 'station_based' | 'buildings_population'
    trip_minutes: Optional[float] = None
    datetime_unlock: Optional[datetime] = None
    id_bike: Optional[int] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# Backward-compatible alias
RouteResponse = TripResponse


class FeatureResponse(BaseModel):
    """Feature response model."""
    id: int
    feature_type: str
    geometry: str  # WKT format
    tags: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True


class StationResponse(BaseModel):
    """Station response model."""
    id: int
    station_id: str
    name: Optional[str] = None
    lat: float
    lon: float
    citybikes_network_id: str
    estimated_monthly_trips: Optional[float] = None
    downtime_minutes: Optional[float] = None
    reach_coverage: Optional[float] = None
    extra: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True


class StationListResponse(BaseResponse):
    """Response model for station list."""
    data: List[StationResponse]
    count: int


# Paginated response models
class PaginatedResponse(BaseResponse):
    """Base paginated response model."""
    page: int
    per_page: int
    total: int
    pages: int


class PaginatedNodesResponse(PaginatedResponse):
    """Paginated nodes response."""
    data: List[NodeResponse]


class PaginatedEdgesResponse(PaginatedResponse):
    """Paginated edges response."""
    data: List[EdgeResponse]


class PaginatedTripsResponse(PaginatedResponse):
    """Paginated trips response."""
    data: List[TripResponse]


# Backward-compatible alias
PaginatedRoutesResponse = PaginatedTripsResponse


class PaginatedFeaturesResponse(PaginatedResponse):
    """Paginated features response."""
    data: List[FeatureResponse]


# GeoJSON models
class GeoJSONFeature(BaseModel):
    """GeoJSON feature model."""
    type: str = "Feature"
    geometry: Union[Point, LineString, Polygon, Dict[str, Any]]
    properties: Dict[str, Any]


class GeoJSONFeatureCollection(BaseModel):
    """GeoJSON feature collection model."""
    type: str = "FeatureCollection"
    features: List[GeoJSONFeature]


class GeoJSONResponse(BaseResponse):
    """GeoJSON response model."""
    data: GeoJSONFeatureCollection


# Query parameters models
class PaginationParams(BaseModel):
    """Pagination parameters."""
    page: int = Field(default=1, ge=1, description="Page number")
    per_page: int = Field(default=100, ge=1, le=1000, description="Items per page")


class NodeQueryParams(PaginationParams):
    """Node query parameters."""
    bbox: Optional[str] = Field(default=None, description="Bounding box filter (min_lon,min_lat,max_lon,max_lat)")


class EdgeQueryParams(PaginationParams):
    """Edge query parameters."""
    highway: Optional[str] = Field(default=None, description="Filter by highway type")
    bbox: Optional[str] = Field(default=None, description="Bounding box filter (min_lon,min_lat,max_lon,max_lat)")


class TripQueryParams(PaginationParams):
    """Trip query parameters."""
    generation_type: Optional[str] = Field(
        default=None,
        description="Filter by generation type: real | station_based | buildings_population",
    )
    min_duration: Optional[float] = Field(default=None, ge=0, description="Minimum trip duration in minutes")
    max_duration: Optional[float] = Field(default=None, ge=0, description="Maximum trip duration in minutes")


# Backward-compatible alias (strategy param ignored — was redundant with generation_type)
RouteQueryParams = TripQueryParams


class FeatureQueryParams(PaginationParams):
    """Feature query parameters."""
    feature_type: Optional[str] = Field(default=None, description="Filter by feature type")
    bbox: Optional[str] = Field(default=None, description="Bounding box filter (min_lon,min_lat,max_lon,max_lat)")


# Error models
class ErrorResponse(BaseModel):
    """Error response model."""
    success: bool = False
    error: str
    detail: Optional[str] = None


class ValidationErrorResponse(BaseModel):
    """Validation error response model."""
    success: bool = False
    error: str = "Validation Error"
    details: List[Dict[str, Any]]


# Health check models
class HealthResponse(BaseModel):
    """Health check response model."""
    status: str
    timestamp: str
    version: str
    database_connected: Optional[bool] = None


class APIInfoResponse(BaseModel):
    """API information response model."""
    title: str
    description: str
    version: str
    endpoints: Dict[str, str]


# Traffic models
class TrafficCount(BaseModel):
    """Traffic count for a single edge."""
    edge_id: int
    trip_count: int
    month: Optional[date] = None


class TrafficStats(BaseModel):
    """Percentile statistics for colormap scaling."""
    q5: float
    q50: float
    q95: float
    min: float
    max: float


class TrafficMode(BaseModel):
    """An available (generation_type, algorithm) combination for a city."""
    generation_type: str
    algorithm: str
    edge_count: int


class TrafficModesResponse(BaseResponse):
    """Available traffic combinations for a city."""
    data: List[TrafficMode]


class TrafficResponse(BaseResponse):
    """Response model for edge traffic data."""
    data: List[TrafficCount]
    count: int
    generation_type: Optional[str] = None
    algorithm: Optional[str] = None
    month: Optional[date] = None
    stats: Optional[TrafficStats] = None

class EdgeRoutesResponse(BaseResponse):
    """Response model for routes passing through a specific edge."""
    data: Dict[str, Any]   # GeoJSON FeatureCollection
    count: int             # number of routes returned in this page
    total: int = 0         # total number of routes matching filters
    offset: int = 0        # offset of this page


# ── Infrastructure analytics models ──────────────────────────────────────────

class InfraStatsResponse(BaseResponse):
    """Infrastructure analytics: GCC coverage + budget cod.153."""
    gcc_fraction: Optional[float] = None
    gcc_km: Optional[float] = None
    total_km: Optional[float] = None
    n_components: int = 0
    vias_budget_year: Optional[int] = None
    vias_budget_type: Optional[str] = None
    vias_budget_eur: Optional[int] = None
    km_per_meur_vias: Optional[float] = None


# ── Infrastructure components model ──────────────────────────────────────────

class InfraComponentsResponse(BaseResponse):
    """GeoJSON FeatureCollection of cycling edges with component_id property."""
    data: Dict[str, Any]  # GeoJSON FeatureCollection


# ── Traffic analytics models ──────────────────────────────────────────────────

class TrafficInfraCoverage(BaseResponse):
    """Fraction of simulated route-km on cycling infrastructure."""
    infra_fraction: Optional[float] = None
    km_on_infra: Optional[float] = None
    generation_type: Optional[str] = None
    algorithm: Optional[str] = None
    month: Optional[date] = None


class HistogramSeries(BaseModel):
    bin_edges: List[float]
    counts: List[int]


class RouteHistogramSeries(BaseModel):
    generation_type: str
    algorithm: str
    n_routes: int
    length_km: HistogramSeries
    infra_fraction: HistogramSeries


class RouteHistogramResponse(BaseResponse):
    data: List[RouteHistogramSeries]


# ── Station monthly models ────────────────────────────────────────────────────

class StationMonthlyPoint(BaseModel):
    month: Optional[str] = None
    estimated_trips: Optional[float] = None
    actual_trips: Optional[float] = None
    active_stations: int = 0


class StationMonthlyResponse(BaseResponse):
    data: List[StationMonthlyPoint]


# ── Budget & political models ─────────────────────────────────────────────────

class BudgetCategory(BaseModel):
    category_code: str
    category_name: Optional[str] = None
    amount: int
    budget_type: str


class BudgetYear(BaseModel):
    year: int
    total_income: Optional[int] = None
    total_expenses: Optional[int] = None
    public_debt: Optional[int] = None
    lines: List[BudgetCategory] = []


class CityBudgetsResponse(BaseResponse):
    data: List[BudgetYear]


class MayorRecord(BaseModel):
    name: str
    party: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None


class ElectionResult(BaseModel):
    year: int
    party: str
    votes: Optional[int] = None
    councilors: Optional[int] = None


class MayorsTimelineResponse(BaseResponse):
    mayors: List[MayorRecord]
    elections: List[ElectionResult]
