#!/bin/bash

# Load environment variables
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

API_URL=${REACT_APP_API_URL:-"http://localhost:8000"}

echo "--- Checking API Health at $API_URL ---"

# 1. Basic Health Check
echo "1. Detailed Health Check:"
curl -s "$API_URL/api/health/detailed" | jq . || echo "Failed to reach /health/detailed"

# 2. List Cities (Core Data)
echo -e "\n2. Cities List (Top 3):"
curl -s "$API_URL/api/cities" | jq '.data[:3] | .[] | {id: .id, name: .name, available_modes: .available_modes}' || echo "Failed to reach /api/cities"

# 3. Port Status
echo -e "\n3. Port 8000 Status:"
lsof -i :8000 | grep LISTEN || echo "Port 8000 is NOT listening"
