FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for PostGIS and spatial libraries
RUN apt-get update && apt-get install -y \
    libpq-dev \
    gcc \
    g++ \
    libgeos-dev \
    libproj-dev \
    libgdal-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p /app/cache /app/logs /app/Data

# Expose port
EXPOSE 8000

# Default command
CMD ["uvicorn", "app.api.main:app", "--host", "0.0.0.0", "--port", "8000"] 