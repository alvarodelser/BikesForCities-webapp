"""
Pydantic models for API request/response schemas.
"""

from typing import List, Optional, Dict, Any, Union
from pydantic import BaseModel, Field
from datetime import datetime
from geojson_pydantic import Feature, FeatureCollection, Point, LineString, Polygon


# Base response model
class BaseResponse(BaseModel):
    """Base response model with common fields."""
    success: bool = True
    message: Optional[str] = None


# Network models
class NetworkBase(BaseModel):
    """Base network model."""
    name: str
    description: Optional[str] = None
    center_lat: Optional[float] = None
    center_lon: Optional[float] = None
    radius: Optional[float] = None


class NetworkResponse(NetworkBase):
    """Network response model."""
    id: int
    created_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class NetworkListResponse(BaseResponse):
    """Response model for network list."""
    data: List[NetworkResponse]
    count: int


class NetworkDetailResponse(BaseResponse):
    """Response model for network details."""
    data: NetworkResponse


# Statistics models
class NetworkStats(BaseModel):
    """Network statistics model."""
    network_id: int
    network_name: str
    nodes_count: int
    edges_count: int
    routes_count: int
    features_count: int
    bounds: Optional[Dict[str, float]] = None  # min_lat, max_lat, min_lon, max_lon


class NetworkStatsResponse(BaseResponse):
    """Response model for network statistics."""
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


class RouteResponse(BaseModel):
    """Route response model."""
    id: int
    id_trip: str
    origin_node: int
    dest_node: int
    strategy: str
    trip_minutes: Optional[float] = None
    datetime_unlock: Optional[datetime] = None
    id_bike: Optional[int] = None
    created_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class FeatureResponse(BaseModel):
    """Feature response model."""
    id: int
    feature_type: str
    geometry: str  # WKT format
    tags: Optional[Dict[str, Any]] = None
    
    class Config:
        from_attributes = True


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


class PaginatedRoutesResponse(PaginatedResponse):
    """Paginated routes response."""
    data: List[RouteResponse]


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


class RouteQueryParams(PaginationParams):
    """Route query parameters."""
    strategy: Optional[str] = Field(default=None, description="Filter by routing strategy")
    min_duration: Optional[float] = Field(default=None, ge=0, description="Minimum trip duration in minutes")
    max_duration: Optional[float] = Field(default=None, ge=0, description="Maximum trip duration in minutes")


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