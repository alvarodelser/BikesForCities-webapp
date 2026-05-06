#!/bin/bash
set -e

CITY="${1:-}"
VENV="b4c_venv/bin/python"

if [ -z "$CITY" ]; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🔄 Re-ingesting ALL CITIES"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    CITY_ARG=""
else
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🔄 Re-ingesting: $CITY"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    CITY_ARG="--city $CITY"
fi

# 01 - Cities (base data)
echo ""
echo "📍 [01] Loading city metadata..."
$VENV ingestion/01_cities/010_load_cities.py $CITY_ARG --force
$VENV ingestion/01_cities/011_load_wikidata.py $CITY_ARG --force 2>/dev/null || true
$VENV ingestion/01_cities/012_load_electoral.py $CITY_ARG --force 2>/dev/null || true
$VENV ingestion/01_cities/013_load_budgets.py $CITY_ARG --force 2>/dev/null || true

# 02 - Geometry (OSM data + buildings for building_coverage)
echo ""
echo "🗺️  [02] Loading OSM & features (buildings)..."
$VENV ingestion/02_geometry/020_load_osm.py $CITY_ARG --force
$VENV ingestion/02_geometry/021_calculate_infra_metrics.py $CITY_ARG --force

# 03 - Stations (core + reach + building_coverage computation)
echo ""
echo "🚉 [03] Loading stations..."
$VENV ingestion/03_stations/030_load_stations.py $CITY_ARG --force
$VENV ingestion/03_stations/031_calculate_traffic.py $CITY_ARG --force
echo "   Computing reach coverage & building_coverage..."
$VENV ingestion/03_stations/032_calculate_reach.py $CITY_ARG --force

# 04 - Trips (no force)
echo ""
echo "🚲 [04] Generating trips..."
$VENV ingestion/04_trips/040_load_madrid_trips.py $CITY_ARG 2>/dev/null || true
$VENV ingestion/04_trips/041_generate_station_trips.py $CITY_ARG 2>/dev/null || true
$VENV ingestion/04_trips/042_generate_pop_trips.py $CITY_ARG 2>/dev/null || true

# 05 - Routes (no force)
echo ""
echo "🛣️  [05] Computing routes..."
$VENV ingestion/05_routes/050_compute_shortest_paths.py $CITY_ARG 2>/dev/null || true

# 06 - Accidents (no force)
echo ""
echo "⚠️  [06] Loading accidents..."
$VENV ingestion/06_accidents/060_load_madrid_accidents.py $CITY_ARG --force

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ -z "$1" ]; then
    echo "✅ Re-ingestion complete: ALL CITIES"
else
    echo "✅ Re-ingestion complete: $CITY"
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
