# Integration Tests

Direct backend API tests for each mode (infrastructure, traffic, stations).

## Usage

Each script tests one mode of the application:

```bash
# Test infrastructure mode
python test_infrastructure.py --city Madrid

# Test traffic mode  
python test_traffic.py --city Barcelona

# Test stations mode
python test_stations.py --city 19

# By city ID (faster)
python test_infrastructure.py --city 1
```

## What They Test

### Infrastructure (`test_infrastructure.py`)
- `/infrastructure/stats` — GCC, total km, population coverage, budget efficiency
- `/infrastructure/components` — cycling network connected components
- `/infrastructure/edge-building-coverage` — buildings near each cycleway
- `/infrastructure/building-coverage` — building coverage polygons

### Traffic (`test_traffic.py`)
- `/traffic/modes` — available (generation_type, algorithm) combinations
- `/traffic` — edge traffic data for best combination
- `/traffic/infra-coverage` — fraction of trips on cycling infrastructure
- `/traffic/histogram` — route length distribution

### Stations (`test_stations.py`)
- `/stations` — station list with availability
- `/stations/{id}/reach` — reachability polygon (1000m max distance)
- `/stations/monthly` — monthly aggregated trip and availability data
- `/stations/building-coverage` — building coverage around stations

## Output

Each script shows:
- ✓ Success with data summary
- ⚠ Warnings for missing/null data
- ❌ Errors with exception details
- Final results: X/Y tests passed

## Exit Code

- `0` if all tests passed
- `1` if any test failed

## Environment

Tests hit the live backend at: `https://wiig.dia.fi.upm.es/b4c_api`

Modify `API_BASE` in each script if needed.
