"""
FastAPI application for Bikes for Cities API.
"""

from fastapi import FastAPI, HTTPException, Security, Depends, Request
from fastapi.security import APIKeyHeader
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging
from datetime import datetime
from typing import Dict, Any, List

from .routes import router as api_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

import os

env = os.getenv("ENVIRONMENT", "development")
# root_path should only be active if we are actually behind the /b4c_api proxy
root_path = "/b4c_api" if env == "production" else ""

# Security Configuration
API_KEY_NAME = "X-API-Key"
API_KEY = os.getenv("API_KEY")
api_key_header = APIKeyHeader(name=API_KEY_NAME, auto_error=False)

async def get_api_key(
    request: Request,
    api_key_header: str = Security(api_key_header),
):
    # 1. Always allow preflight (OPTIONS) requests
    if request.method == "OPTIONS":
        return None
        
    # 2. Only enforce API key if NOT in development mode
    if env == "development":
        return api_key_header
        
    # 3. Skip if no API_KEY is configured on the server
    if not API_KEY:
        return api_key_header

    # 4. Validate the key
    if api_key_header == API_KEY:
        return api_key_header
    
    raise HTTPException(
        status_code=403,
        detail="Could not validate credentials"
    )

# Create FastAPI app
app = FastAPI(
    title="Bikes for Cities API",
    description="REST API for bike-sharing city analysis and visualization",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    root_path=root_path
)

# Add CORS middleware
allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "")

# We always allow localhost for your development workflow,
# and your specific domains for production.
default_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:5175",
    "http://localhost:3000",
    "https://bikesforcities.es",
    "https://www.bikesforcities.es",
    "https://bikesforcities-7wypojwsq-alvarodelsers-projects.vercel.app"
]

if allowed_origins_env:
    origins = list(set(default_origins + [o.strip() for o in allowed_origins_env.split(",")]))
else:
    origins = default_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-API-Key", "Accept"],
)

# Include API routes with global security dependency if not in dev
dependencies = [Depends(get_api_key)] if env != "development" else []
app.include_router(api_router, prefix="/api", dependencies=dependencies)

# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error(f"Unexpected error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Error interno del servidor"}
    )

# Health check endpoint
@app.get("/health")
async def health_check() -> Dict[str, Any]:
    """Health check endpoint."""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0"
    }

# API information endpoint
@app.get("/api/info")
async def api_info() -> Dict[str, Any]:
    """Get API information."""
    return {
        "title": "Bikes for Cities API",
        "description": "REST API for bike-sharing city analysis and visualization",
        "version": "1.0.0",
        "endpoints": {
            "cities": "/api/cities",
            "health": "/health",
            "docs": "/docs"
        }
    }

# Root endpoint
@app.get("/")
async def root():
    """Root endpoint with API welcome message."""
    return {
        "message": "Welcome to Bikes for Cities API",
        "docs": "/docs",
        "health": "/health"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 