#!/usr/bin/env python3
"""
Integration test for stations mode endpoints.

Usage:
    python test_stations.py --city Madrid
    python test_stations.py --city 19
"""
import sys
import argparse
import requests
from typing import Optional

API_BASE = "https://wiig.dia.fi.upm.es/b4c_api"
TIMEOUT = 30


def get_city_id(city_name: str) -> Optional[int]:
    """Resolve city name/slug to city ID."""
    resp = requests.get(f"{API_BASE}/cities", timeout=TIMEOUT)
    resp.raise_for_status()
    data = resp.json()

    cities = data.get("data", [])
    city_name_lower = str(city_name).lower()

    # Try exact ID match first
    try:
        city_id = int(city_name)
        match = next((c for c in cities if c["id"] == city_id), None)
        if match:
            return match["id"]
    except ValueError:
        pass

    # Try name/slug match
    match = next(
        (c for c in cities if
         city_name_lower in (c.get("name") or "").lower() or
         city_name_lower in (c.get("alt_name") or "").lower() or
         city_name_lower == (c.get("slug") or "").lower()),
        None,
    )
    if match:
        return match

    print(f"❌ City '{city_name}' not found")
    print(f"   Available: {', '.join(c['name'] for c in cities[:10])}")
    return None


def test_city_details(city_id: int):
    """GET /cities/{id} — check global station-related stats."""
    print("\n🏙 Testing /cities/{id} stats...")
    try:
        resp = requests.get(f"{API_BASE}/cities/{city_id}", timeout=TIMEOUT)
        resp.raise_for_status()
        city = resp.json().get("data", {})

        print(f"   ✓ City: {city.get('name')}")
        print(f"      stations_count: {city.get('stations_count')}")
        print(f"      bicycles_count: {city.get('bicycles_count')}")
        print(f"      monthly_trips: {city.get('monthly_trips')}")
        print(f"      service_name: {city.get('service_name')}")

        if not city.get('stations_count'):
            print("   ⚠ WARNING: stations_count is missing or 0 in city metadata")
        if not city.get('bicycles_count'):
            print("   ⚠ WARNING: bicycles_count is missing or 0 in city metadata")

    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False
    return True


def test_stations_list(city_id: int):
    """GET /stations — full station list with availability."""
    print("\n🚲 Testing /stations...")
    try:
        resp = requests.get(f"{API_BASE}/cities/{city_id}/stations", timeout=TIMEOUT)
        resp.raise_for_status()
        stations = resp.json().get("data", [])

        print(f"   ✓ {len(stations)} stations")

        if stations:
            first = stations[0]
            # Calculate aggregate stats used in the frontend
            stations_with_trips = [s for s in stations if s.get("estimated_monthly_trips") is not None]
            total_trips = sum(s.get("estimated_monthly_trips", 0) for s in stations_with_trips)
            
            stations_with_downtime = [s for s in stations if s.get("downtime_minutes") is not None]
            avg_downtime = (sum(s.get("downtime_minutes", 0) for s in stations_with_downtime) / len(stations_with_downtime)) if stations_with_downtime else 0
            
            trips_bike_day = (total_trips / len(stations) / 30) if stations else 0

            print(f"   ✓ Aggregate Stats (calculated from station list):")
            print(f"      Total Stations: {len(stations)}")
            print(f"      Avg Downtime: {avg_downtime:.1f} min/day")
            print(f"      Total Est. Trips: {total_trips:,.0f} / month")
            print(f"      Usage: {trips_bike_day:.2f} trips/bike/day")

            if not total_trips:
                print("   ⚠ WARNING: No estimated trip data across all stations")
            if not avg_downtime:
                print("   ⚠ WARNING: No downtime data across all stations")

        else:
            print("   ⚠ WARNING: No stations returned")

    except Exception as e:
        print(f"   ❌ Error: {e}")
        try:
            print(f"   Response was: {resp.json()}")
        except:
            print(f"   Response text: {resp.text}")
        return False
    return True


def test_stations_reach(city_id: int, stations: list):
    """GET /stations/{id}/reach — reachability polygon for first station."""
    print("\n📍 Testing /stations/{id}/reach...")
    try:
        if not stations:
            print("   ⚠ SKIP: No stations to test reach with")
            return True

        station = stations[0]
        station_id = station["station_id"]
        resp = requests.get(f"{API_BASE}/cities/{city_id}/stations/{station_id}/reach",
                           params={"max_distance": 1000}, timeout=TIMEOUT)
        resp.raise_for_status()
        data = resp.json().get("data", {})

        edges = data.get("edges", [])
        coverage = data.get("coverage")
        print(f"   ✓ Station {station_id}: {len(edges)} reachability edges")
        print(f"   ✓ Coverage: {coverage}%")

        if not edges:
            print("   ⚠ WARNING: No reachability edges — station may be disconnected?")
        if coverage is None:
            print("   ⚠ WARNING: coverage is None")

    except Exception as e:
        print(f"   ❌ Error: {e}")
        try:
            print(f"   Response was: {resp.json()}")
        except:
            print(f"   Response text: {resp.text}")
        return False
    return True


def test_stations_monthly(city_id: int):
    """GET /stations/monthly — monthly aggregated trip and availability data."""
    print("\n📈 Testing /stations/monthly...")
    try:
        resp = requests.get(f"{API_BASE}/cities/{city_id}/stations/monthly", timeout=TIMEOUT)
        resp.raise_for_status()
        data = resp.json().get("data", [])

        print(f"   ✓ {len(data)} monthly records")

        if data:
            first = data[0]
            # The model uses estimated_trips and actual_trips, not total_trips or avg_availability
            print(f"   ✓ Sample: month={first.get('month')}")
            print(f"      estimated_trips={first.get('estimated_trips')}")
            print(f"      actual_trips={first.get('actual_trips')}")
            print(f"      active_stations={first.get('active_stations')}")

            months_with_trips = [r for r in data if (r.get("estimated_trips") or 0) > 0 or (r.get("actual_trips") or 0) > 0]
            print(f"   ✓ {len(months_with_trips)}/{len(data)} months have trip data")

            if not months_with_trips:
                print("   ⚠ WARNING: All months have 0 trips — trip data may not be ingested")

        else:
            print("   ⚠ WARNING: No monthly records")

    except Exception as e:
        print(f"   ❌ Error: {e}")
        try:
            print(f"   Response was: {resp.json()}")
        except:
            print(f"   Response text: {resp.text}")
        return False
    return True


def test_stations_building_coverage(city_id: int):
    """GET /stations/building-coverage — building coverage around stations."""
    print("\n🏢 Testing /stations/building-coverage...")
    try:
        resp = requests.get(f"{API_BASE}/cities/{city_id}/stations/building-coverage", timeout=TIMEOUT)
        resp.raise_for_status()
        # Note: This endpoint returns a single value (coverage), not a list of stations
        data = resp.json()
        avg_coverage = data.get("coverage")
        
        if avg_coverage is not None:
            print(f"   ✓ Average station building coverage: {avg_coverage}")
        else:
            print(f"   ⚠ WARNING: Unexpected response format: {data}")

    except Exception as e:
        print(f"   ❌ Error: {e}")
        try:
            print(f"   Response was: {resp.json()}")
        except:
            print(f"   Response text: {resp.text}")
        return False
    return True


def main():
    parser = argparse.ArgumentParser(description="Test stations mode endpoints")
    parser.add_argument("--city", required=True, help="City name or ID to test")
    args = parser.parse_args()

    print(f"\n🚉 Stations Mode Tests")
    print(f"API: {API_BASE}")
    print(f"City: {args.city}")

    city_data = get_city_id(args.city)
    if not city_data:
        sys.exit(1)
    
    city_id = city_data["id"]
    print(f"✓ Using city_id={city_id}")

    # Fetch stations for reachability test
    try:
        resp = requests.get(f"{API_BASE}/cities/{city_id}/stations", timeout=TIMEOUT)
        resp.raise_for_status()
        stations = resp.json().get("data", [])
    except:
        stations = []

    results = [
        test_city_details(city_id),
        test_stations_list(city_id),
        test_stations_reach(city_id, stations),
        test_stations_monthly(city_id),
        test_stations_building_coverage(city_id),
    ]

    passed = sum(results)
    total = len(results)
    print(f"\n{'='*50}")
    print(f"Results: {passed}/{total} tests passed")

    if passed == total:
        print("✅ All tests passed!")
        sys.exit(0)
    else:
        print(f"❌ {total - passed} test(s) failed")
        sys.exit(1)


if __name__ == "__main__":
    main()
