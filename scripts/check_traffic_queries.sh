#!/usr/bin/env bash
# check_traffic_queries.sh — Run EXPLAIN ANALYZE on all edge_traffic queries
# and print results for a given city/mode combination.
#
# Usage: ./scripts/check_traffic_queries.sh [stg|prod]
#
# The script reads the .env from the corresponding deploy dir, extracts DB
# credentials, and executes each query inside docker exec so nothing needs
# to be exposed externally.

set -euo pipefail

ENV="${1:-stg}"

case "$ENV" in
  stg)  DEPLOY_DIR="/srv/bikesforcities_stg" ; DB_CONTAINER="b4c_database_stg" ;;
  prod) DEPLOY_DIR="/srv/bikesforcities"     ; DB_CONTAINER="b4c_database"     ;;
  *)    echo "Usage: $0 [stg|prod]"; exit 1 ;;
esac

ENV_FILE="$DEPLOY_DIR/.env"

PGUSER=$(grep  '^POSTGRES_USER='  "$ENV_FILE" | cut -d= -f2)
PGDB=$(grep    '^POSTGRES_DB='    "$ENV_FILE" | cut -d= -f2)

psql_exec() {
  docker exec "$DB_CONTAINER" psql -U "$PGUSER" -d "$PGDB" -c "$1"
}

# ---------------------------------------------------------------------------
# 0. Pick sample parameters from whatever data is in the DB
# ---------------------------------------------------------------------------
echo "======================================================================"
echo "Discovering sample parameters..."
echo "======================================================================"

SAMPLE=$(docker exec "$DB_CONTAINER" psql -U "$PGUSER" -d "$PGDB" -t -A -F'|' -c \
  "SELECT city_id, generation_type, algorithm, month::text
   FROM edge_traffic
   LIMIT 1;")

if [ -z "$SAMPLE" ]; then
  echo "No rows in edge_traffic — nothing to test."
  exit 0
fi

CITY_ID=$(echo   "$SAMPLE" | cut -d'|' -f1)
GEN_TYPE=$(echo  "$SAMPLE" | cut -d'|' -f2)
ALGORITHM=$(echo "$SAMPLE" | cut -d'|' -f3)
MONTH=$(echo     "$SAMPLE" | cut -d'|' -f4)

echo "city_id=$CITY_ID  generation_type=$GEN_TYPE  algorithm=$ALGORITHM  month=$MONTH"
echo ""

# ---------------------------------------------------------------------------
# Helper: print a labelled separator then run EXPLAIN (ANALYZE, BUFFERS)
# ---------------------------------------------------------------------------
explain() {
  local label="$1"
  local sql="$2"
  echo "======================================================================"
  echo "QUERY: $label"
  echo "======================================================================"
  psql_exec "EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) $sql"
  echo ""
}

# ---------------------------------------------------------------------------
# 1. get_traffic_modes  (city_id only — should use idx_edge_traffic_city_id)
# ---------------------------------------------------------------------------
explain "get_traffic_modes — GROUP BY generation_type, algorithm" \
  "SELECT generation_type, algorithm, COUNT(DISTINCT edge_id) AS edge_count
   FROM edge_traffic
   WHERE city_id = $CITY_ID
   GROUP BY generation_type, algorithm
   ORDER BY generation_type, algorithm;"

# ---------------------------------------------------------------------------
# 2. get_latest_traffic_month  (city_id + generation_type + algorithm — MAX)
# ---------------------------------------------------------------------------
explain "get_latest_traffic_month — MAX(month) with 3-col filter" \
  "SELECT MAX(month) FROM edge_traffic
   WHERE city_id = $CITY_ID
     AND generation_type = '$GEN_TYPE'
     AND algorithm = '$ALGORITHM';"

# ---------------------------------------------------------------------------
# 3. get_traffic_stats  (4-col filter + percentiles) — the hot path
# ---------------------------------------------------------------------------
explain "get_traffic_stats — percentiles with 4-col filter" \
  "SELECT
     PERCENTILE_CONT(0.05) WITHIN GROUP (ORDER BY trip_count) AS q5,
     PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY trip_count) AS q50,
     PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY trip_count) AS q95,
     MIN(trip_count), MAX(trip_count), COUNT(*)
   FROM edge_traffic
   WHERE city_id        = $CITY_ID
     AND generation_type = '$GEN_TYPE'
     AND algorithm       = '$ALGORITHM'
     AND month           = '$MONTH'
     AND trip_count      > 0;"

# ---------------------------------------------------------------------------
# 4. get_edge_traffic  (4-col filter — returns all rows)
# ---------------------------------------------------------------------------
explain "get_edge_traffic — SELECT all rows with 4-col filter" \
  "SELECT edge_id, trip_count, month
   FROM edge_traffic
   WHERE city_id        = $CITY_ID
     AND generation_type = '$GEN_TYPE'
     AND algorithm       = '$ALGORITHM'
     AND month           = '$MONTH'
   ORDER BY edge_id
   LIMIT 5;"

# ---------------------------------------------------------------------------
# 5. get_max_traffic_edge  (4-col filter + JOIN edges)
# ---------------------------------------------------------------------------
explain "get_max_traffic_edge — ORDER BY trip_count DESC LIMIT 1" \
  "SELECT et.trip_count, e.name
   FROM edge_traffic et
   JOIN edges e ON e.id = et.edge_id AND e.city_id = et.city_id
   WHERE et.city_id        = $CITY_ID
     AND et.generation_type = '$GEN_TYPE'
     AND et.algorithm       = '$ALGORITHM'
     AND et.month           = '$MONTH'
   ORDER BY et.trip_count DESC
   LIMIT 1;"

# ---------------------------------------------------------------------------
# 6. get_traffic_infra_coverage  (4-col filter + JOIN edges + SUM)
# ---------------------------------------------------------------------------
explain "get_traffic_infra_coverage — SUM with 4-col filter + JOIN" \
  "SELECT
     SUM(e.length * et.trip_count)
         FILTER (WHERE e.highway LIKE '%cycleway%') AS infra_weighted,
     SUM(e.length * et.trip_count) AS total_weighted,
     SUM(e.length)
         FILTER (WHERE e.highway LIKE '%cycleway%') AS infra_km_raw
   FROM edge_traffic et
   JOIN edges e ON e.id = et.edge_id
   WHERE et.city_id        = $CITY_ID
     AND et.generation_type = '$GEN_TYPE'
     AND et.algorithm       = '$ALGORITHM'
     AND et.month           = '$MONTH';"

# ---------------------------------------------------------------------------
# 7. edges_with_traffic tile function inner SELECT (sample tile z=13,x=4090,y=3099)
# ---------------------------------------------------------------------------
explain "edges_with_traffic tile function — LEFT JOIN at z=13 (sample tile)" \
  "SELECT
     e.id, e.city_id, e.name, e.highway, e.length,
     COALESCE(et.trip_count, 0) AS trip_count,
     ST_AsMVTGeom(e.geom, ST_TileEnvelope(13, 4090, 3099), 4096, 0, true) AS geom
   FROM edges e
   LEFT JOIN edge_traffic et
          ON et.edge_id        = e.id
         AND et.generation_type = '$GEN_TYPE'
         AND et.algorithm       = '$ALGORITHM'
         AND et.month           = '$MONTH'
   WHERE e.geom && ST_TileEnvelope(13, 4090, 3099)
     AND ST_AsMVTGeom(e.geom, ST_TileEnvelope(13, 4090, 3099), 4096, 0, true) IS NOT NULL
   LIMIT 5;"

# ---------------------------------------------------------------------------
# 8. Show existing indexes on edge_traffic
# ---------------------------------------------------------------------------
echo "======================================================================"
echo "Current indexes on edge_traffic"
echo "======================================================================"
psql_exec "\d edge_traffic"
