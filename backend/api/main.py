"""
FastAPI application for Bikes for Cities API.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging
from datetime import datetime
from typing import Dict, Any

from .routes import router as api_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

import os

env = os.getenv("ENVIRONMENT", "development")
root_path = "/b4c_api" if env == "production" else ""

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

if env == "production":
    # Restrict to strictly your Vercel instance
    origins = [
        "https://bikesforcities-7wypojwsq-alvarodelsers-projects.vercel.app"
    ]
else:
    # Allow local frontend ports
    origins = [
        "http://localhost:5173", 
        "http://localhost:3000",
        "127.0.0.1:5173",
        "*"
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(api_router, prefix="/api")

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