"""
Dependency injection functions for FastAPI.
"""

import psycopg2
from fastapi import HTTPException, Depends
from typing import Generator, Optional, Tuple
import logging
from math import ceil

from app.database.network_io import connect_db

logger = logging.getLogger(__name__)

# Database connection dependency
def get_db_connection() -> Generator[psycopg2.extensions.connection, None, None]:
    """
    Get database connection for dependency injection.
    
    Yields:
        psycopg2.extensions.connection: Database connection
    """
    conn = None
    try:
        conn = connect_db()
        yield conn
    except Exception as e:
        logger.error(f"Database connection error: {e}")
        raise HTTPException(
            status_code=500,
            detail="Database connection failed"
        )
    finally:
        if conn:
            conn.close()


# Pagination utilities
def calculate_pagination(page: int, per_page: int, total: int) -> Tuple[int, int, int]:
    """
    Calculate pagination parameters.
    
    Args:
        page: Current page number
        per_page: Items per page
        total: Total number of items
    
    Returns:
        Tuple of (offset, limit, total_pages)
    """
    offset = (page - 1) * per_page
    limit = per_page
    total_pages = ceil(total / per_page) if total > 0 else 1
    
    return offset, limit, total_pages


def parse_bbox(bbox_str: Optional[str]) -> Optional[Tuple[float, float, float, float]]:
    """
    Parse bounding box string into coordinates.
    
    Args:
        bbox_str: Bounding box string in format "min_lon,min_lat,max_lon,max_lat"
        
    Returns:
        Tuple of (min_lon, min_lat, max_lon, max_lat) or None if invalid
    """
    if not bbox_str:
        return None
    
    try:
        coords = [float(x.strip()) for x in bbox_str.split(',')]
        if len(coords) != 4:
            raise ValueError("Bounding box must have exactly 4 coordinates")
        
        min_lon, min_lat, max_lon, max_lat = coords
        
        # Basic validation
        if min_lon >= max_lon or min_lat >= max_lat:
            raise ValueError("Invalid bounding box coordinates")
        
        if not (-180 <= min_lon <= 180 and -180 <= max_lon <= 180 and
                -90 <= min_lat <= 90 and -90 <= max_lat <= 90):
            raise ValueError("Coordinates must be within valid ranges")
        
        return min_lon, min_lat, max_lon, max_lat
        
    except (ValueError, TypeError) as e:
        logger.warning(f"Invalid bounding box format: {bbox_str}, error: {e}")
        raise HTTPException(
            status_code=400,
            detail=f"Invalid bounding box format. Expected: min_lon,min_lat,max_lon,max_lat"
        )


def validate_network_exists(conn: psycopg2.extensions.connection, network_id: int) -> bool:
    """
    Validate that a network exists in the database.
    
    Args:
        conn: Database connection
        network_id: Network ID to validate
        
    Returns:
        True if network exists
        
    Raises:
        HTTPException: If network doesn't exist
    """
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM networks WHERE id = %s", (network_id,))
            result = cur.fetchone()
            
            if not result:
                raise HTTPException(
                    status_code=404,
                    detail=f"Network with ID {network_id} not found"
                )
            
            return True
    except psycopg2.Error as e:
        logger.error(f"Database error while validating network {network_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail="Database error while validating network"
        )


def get_network_dependency(network_id: int, conn: psycopg2.extensions.connection = Depends(get_db_connection)):
    """
    Dependency to validate network existence and return connection.
    
    Args:
        network_id: Network ID to validate
        conn: Database connection
        
    Returns:
        Database connection
    """
    validate_network_exists(conn, network_id)
    return conn


# Common query building utilities
def build_where_clause(conditions: list, params: list) -> str:
    """
    Build WHERE clause from conditions list.
    
    Args:
        conditions: List of condition strings
        params: List of parameter values
        
    Returns:
        WHERE clause string
    """
    if not conditions:
        return ""
    
    return " WHERE " + " AND ".join(conditions)


def build_bbox_condition(bbox: Optional[Tuple[float, float, float, float]], 
                        geom_column: str = "geom") -> Tuple[str, list]:
    """
    Build spatial bounding box condition.
    
    Args:
        bbox: Bounding box coordinates (min_lon, min_lat, max_lon, max_lat)
        geom_column: Name of geometry column
        
    Returns:
        Tuple of (condition_string, parameters)
    """
    if not bbox:
        return "", []
    
    min_lon, min_lat, max_lon, max_lat = bbox
    
    condition = f"ST_Intersects({geom_column}, ST_MakeEnvelope(%s, %s, %s, %s, 4326))"
    params = [min_lon, min_lat, max_lon, max_lat]
    
    return condition, params


# Database health check
def check_database_health(conn: psycopg2.extensions.connection) -> bool:
    """
    Check database health by running a simple query.
    
    Args:
        conn: Database connection
        
    Returns:
        True if database is healthy
    """
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT 1")
            result = cur.fetchone()
            return result is not None
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        return False 