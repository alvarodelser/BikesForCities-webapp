#!/bin/bash

# run_ingestion.sh - Master script to execute full ingestion pipeline
# Location: ingestion/run_ingestion.sh

# Get the project root directory (one level up from this script)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( dirname "$SCRIPT_DIR" )"

# Always run from the project root
cd "$PROJECT_ROOT"

# Exit on any error
set -e

# Define colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}======================================================${NC}"
echo -e "${BLUE}🚀 Starting Full Bikes for Cities Ingestion Pipeline${NC}"
echo -e "${BLUE}======================================================${NC}"

# Check for virtual environment
if [ -d "b4c_venv" ]; then
    echo -e "${YELLOW}📦 Activating virtual environment...${NC}"
    source b4c_venv/bin/activate
fi

# 1. Cities & Metadata
echo -e "\n${GREEN}--- Phase 1: Cities & Metadata ---${NC}"
python3 ingestion/01_cities/010_load_cities.py
python3 ingestion/01_cities/011_load_wikidata.py
python3 ingestion/01_cities/012_load_electoral.py

# 2. Geometry & Infrastructure
echo -e "\n${GREEN}--- Phase 2: Geometry & Infrastructure ---${NC}"
python3 ingestion/02_geometry/020_load_osm.py
python3 ingestion/02_geometry/021_calculate_infra_metrics.py
# 022 – Madrid-only: enrich edges with municipal bike-infra classification
python3 ingestion/02_geometry/022_load_madrid_bike_infra.py

# 3. Stations & Accessibility
echo -e "\n${GREEN}--- Phase 3: Stations & Accessibility ---${NC}"
python3 ingestion/03_stations/030_load_stations.py
python3 ingestion/03_stations/031_calculate_traffic.py
python3 ingestion/03_stations/032_calculate_reach.py

# 4. Trips
echo -e "\n${GREEN}--- Phase 4: Trips & Traffic ---${NC}"
# 040 – Real trips from bike-share data (Madrid / BiciMAD)
if [ -d "data/bicimad_trips" ]; then
    echo -e "${YELLOW}Processing Madrid BiciMAD trips...${NC}"
    python3 ingestion/04_trips/040_load_madrid_trips.py
fi
# 041 – Synthetic trips from station inbound/outbound flows
python3 ingestion/04_trips/041_generate_station_trips.py
# 042 – Synthetic trips from buildings + population density (stub)
python3 ingestion/04_trips/042_generate_pop_trips.py

# 5. Routes
echo -e "\n${GREEN}--- Phase 5: Routes ---${NC}"
# 050 – Compute shortest paths for all unrouted trips
python3 ingestion/05_routes/050_compute_shortest_paths.py

# 6. Accidents
if [ -f "ingestion/06_accidents/060_load_madrid_accidents.py" ]; then
    echo -e "\n${GREEN}--- Phase 6: Accidents ---${NC}"
    python3 ingestion/06_accidents/060_load_madrid_accidents.py
fi


echo -e "\n${BLUE}======================================================${NC}"
echo -e "${BLUE}🎯 Ingestion Pipeline Completed Successfully!${NC}"
echo -e "${BLUE}======================================================${NC}"
