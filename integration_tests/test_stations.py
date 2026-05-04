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
        return match["id"]

    print(f"❌ City '{city_name}' not found")
    print(f"   Available: {', '.join(c['name'] for c in cities[:10])}")
    return None


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
            print(f"   ✓ Sample: {first.get('name')} (id={first.get('station_id')})")
            print(f"      available_bikes={first.get('available_bikes')}")
            print(f"      capacity={first.get('capacity')}")

            bikes_reported = [s.get("available_bikes") for s in stations if s.get("available_bikes") is not None]
            print(f"   ✓ {len(bikes_reported)}/{len(stations)} stations have available_bikes data")

            if not bikes_reported:
                print("   ⚠ WARNING: No available_bikes data — station readings may be stale")

        else:
            print("   ⚠ WARNING: No stations returned")

    except Exception as e:
        print(f"   ❌ Error: {e}")
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
            print(f"   ✓ Sample: month={first.get('month')}")
            print(f"      avg_availability={first.get('avg_availability')}")
            print(f"      total_trips={first.get('total_trips')}")

            months_with_trips = [r for r in data if (r.get("total_trips") or 0) > 0]
            print(f"   ✓ {len(months_with_trips)}/{len(data)} months have trip data")

            if not months_with_trips:
                print("   ⚠ WARNING: All months have 0 trips — trip data may not be ingested")

        else:
            print("   ⚠ WARNING: No monthly records")

    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False
    return True


def test_stations_building_coverage(city_id: int):
    """GET /stations/building-coverage — building coverage around stations."""
    print("\n🏢 Testing /stations/building-coverage...")
    try:
        resp = requests.get(f"{API_BASE}/cities/{city_id}/stations/building-coverage", timeout=TIMEOUT)
        resp.raise_for_status()
        data = resp.json().get("data", [])

        print(f"   ✓ {len(data)} stations with building coverage data")

        if data:
            coverages = [s.get("coverage", 0) for s in data if s.get("coverage") is not None]
            if coverages:
                avg_coverage = sum(coverages) / len(coverages)
                print(f"   ✓ Average building coverage: {avg_coverage:.1f}%")

                if all(c == 0 for c in coverages):
                    print("   ⚠ WARNING: All stations have 0 building coverage — features data missing?")
            else:
                print("   ⚠ WARNING: No coverage values")

        else:
            print("   ⚠ WARNING: No building coverage data")

    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False
    return True


def main():
    parser = argparse.ArgumentParser(description="Test stations mode endpoints")
    parser.add_argument("--city", required=True, help="City name or ID to test")
    args = parser.parse_args()

    print(f"\n🚉 Stations Mode Tests")
    print(f"API: {API_BASE}")
    print(f"City: {args.city}")

    city_id = get_city_id(args.city)
    if not city_id:
        sys.exit(1)

    print(f"✓ Using city_id={city_id}")

    # Fetch stations for reachability test
    try:
        resp = requests.get(f"{API_BASE}/cities/{city_id}/stations", timeout=TIMEOUT)
        resp.raise_for_status()
        stations = resp.json().get("data", [])
    except:
        stations = []

    results = [
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
