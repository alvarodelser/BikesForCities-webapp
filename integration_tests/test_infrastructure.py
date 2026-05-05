#!/usr/bin/env python3
"""
Integration test for infrastructure mode endpoints.

Usage:
    python test_infrastructure.py --city Madrid
    python test_infrastructure.py --city 19
"""
import sys
import argparse
import requests
from typing import Optional

API_BASE = "https://wiig.dia.fi.upm.es/b4c_api"
TIMEOUT = 120


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


def test_infrastructure_stats(city_id: int):
    """GET /infrastructure/stats — totals, coverage, GCC."""
    print("\n📊 Testing /infrastructure/stats...")
    try:
        resp = requests.get(f"{API_BASE}/cities/{city_id}/infrastructure/stats", timeout=TIMEOUT)
        resp.raise_for_status()
        body = resp.json()
        print(f"   Response: {body}")

        data = body.get("data") or body
        print(f"   ✓ total_km={data.get('total_km')} km")
        print(f"   ✓ coverage={data.get('coverage')}")
        print(f"   ✓ gcc_fraction={data.get('gcc_fraction')}")
        print(f"   ✓ n_components={data.get('n_components')}")

        if not data.get("total_km") or data.get("total_km") == 0:
            print("   ⚠ WARNING: total_km is 0 — no cycling edges?")
        if data.get("gcc_fraction") is None:
            print("   ⚠ WARNING: gcc_fraction is None — GCC computation failed?")

    except Exception as e:
        print(f"   ❌ Error: {e}")
        try:
            print(f"   Response was: {resp.json()}")
        except:
            print(f"   Response text: {resp.text}")
        return False
    return True


def test_infrastructure_components(city_id: int):
    """GET /infrastructure/components — cycling network connected components."""
    print("\n🔗 Testing /infrastructure/components...")
    try:
        resp = requests.get(f"{API_BASE}/cities/{city_id}/infrastructure/components", timeout=TIMEOUT)
        resp.raise_for_status()
        body = resp.json()
        data = body.get("data", body)
        features = data.get("features", []) if isinstance(data, dict) else []

        print(f"   ✓ {len(features)} component features")

        if not features:
            print("   ⚠ WARNING: No features — no cycling edges?")

    except Exception as e:
        print(f"   ❌ Error: {e}")
        try:
            print(f"   Response was: {resp.json()}")
        except:
            print(f"   Response text: {resp.text}")
        return False
    return True


def test_infrastructure_edge_building_coverage(city_id: int):
    """GET /infrastructure/edge-building-coverage — buildings per cycleway edge."""
    print("\n🏢 Testing /infrastructure/edge-building-coverage...")
    try:
        resp = requests.get(f"{API_BASE}/cities/{city_id}/infrastructure/edge-building-coverage", timeout=TIMEOUT)
        resp.raise_for_status()
        body = resp.json()
        data = body.get("data", body.get("edges", []))

        print(f"   ✓ {len(data)} edges with building data")

        if not data:
            print("   ⚠ WARNING: No edge data")
        else:
            total_buildings = sum(e.get("building_count", 0) for e in data)
            print(f"   ✓ Total buildings near edges: {total_buildings}")
            if total_buildings == 0:
                print("   ⚠ WARNING: All edges have 0 buildings — features data missing?")

    except Exception as e:
        print(f"   ❌ Error: {e}")
        try:
            print(f"   Response was: {resp.json()}")
        except:
            print(f"   Response text: {resp.text}")
        return False
    return True


def test_infrastructure_building_coverage(city_id: int):
    """GET /infrastructure/building-coverage — building coverage polygon components."""
    print("\n🗺️ Testing /infrastructure/building-coverage...")
    try:
        resp = requests.get(f"{API_BASE}/cities/{city_id}/infrastructure/building-coverage", timeout=TIMEOUT)
        resp.raise_for_status()
        body = resp.json()
        data = body.get("data", body)
        features = data.get("features", []) if isinstance(data, dict) else []

        print(f"   ✓ {len(features)} building coverage features")

        if not features:
            print("   ⚠ WARNING: No building coverage data")

    except Exception as e:
        print(f"   ❌ Error: {e}")
        try:
            print(f"   Response was: {resp.json()}")
        except:
            print(f"   Response text: {resp.text}")
        return False
    return True


def main():
    parser = argparse.ArgumentParser(description="Test infrastructure mode endpoints")
    parser.add_argument("--city", required=True, help="City name or ID to test")
    args = parser.parse_args()

    print(f"\n🏛️ Infrastructure Mode Tests")
    print(f"API: {API_BASE}")
    print(f"City: {args.city}")

    city_id = get_city_id(args.city)
    if not city_id:
        sys.exit(1)

    print(f"✓ Using city_id={city_id}")

    results = [
        test_infrastructure_stats(city_id),
        test_infrastructure_components(city_id),
        test_infrastructure_edge_building_coverage(city_id),
        test_infrastructure_building_coverage(city_id),
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
