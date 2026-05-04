#!/usr/bin/env python3
"""
Integration test for traffic mode endpoints.

Usage:
    python test_traffic.py --city Madrid
    python test_traffic.py --city 19
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


def test_traffic_modes(city_id: int):
    """GET /traffic/modes — available (generation_type, algorithm) combinations."""
    print("\n📊 Testing /traffic/modes...")
    try:
        resp = requests.get(f"{API_BASE}/cities/{city_id}/traffic/modes", timeout=TIMEOUT)
        resp.raise_for_status()
        modes = resp.json().get("data", [])

        print(f"   ✓ {len(modes)} available combinations:")
        for m in modes:
            print(f"     - generation_type='{m['generation_type']}' algorithm='{m['algorithm']}'")

        if not modes:
            print("   ⚠ WARNING: No traffic combinations available")

    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False
    return True


def test_traffic_map(city_id: int):
    """GET /traffic — default (best) combination."""
    print("\n🗺️ Testing /traffic...")
    try:
        resp = requests.get(f"{API_BASE}/cities/{city_id}/traffic", timeout=TIMEOUT)
        resp.raise_for_status()
        body = resp.json()
        data = body.get("data", [])

        print(f"   ✓ {len(data)} edges in traffic data")
        print(f"   ✓ generation_type={body.get('generation_type')}")
        print(f"   ✓ algorithm={body.get('algorithm')}")
        print(f"   ✓ month={body.get('month')}")

        if not data:
            print("   ⚠ WARNING: No edge data for default combination")
        if body.get("month") is None:
            print("   ⚠ WARNING: month is None — no traffic data for this combination?")

    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False
    return True


def test_traffic_infra_coverage(city_id: int):
    """GET /traffic/infra-coverage — fraction of trips on cycling infrastructure."""
    print("\n📈 Testing /traffic/infra-coverage...")
    try:
        resp = requests.get(f"{API_BASE}/cities/{city_id}/traffic/infra-coverage", timeout=TIMEOUT)
        resp.raise_for_status()
        data = resp.json().get("data", {})

        infra_frac = data.get("infra_fraction")
        km_on_infra = data.get("km_on_infra")
        print(f"   ✓ infra_fraction={infra_frac}")
        print(f"   ✓ km_on_infra={km_on_infra} km")

        if infra_frac is not None and not (0 <= infra_frac <= 1):
            print(f"   ⚠ WARNING: infra_fraction={infra_frac} is out of [0, 1] range")

    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False
    return True


def test_traffic_histogram(city_id: int):
    """GET /traffic/histogram — route length distribution."""
    print("\n📊 Testing /traffic/histogram...")
    try:
        resp = requests.get(f"{API_BASE}/cities/{city_id}/traffic/histogram",
                           params={"bins": 20}, timeout=TIMEOUT)
        resp.raise_for_status()
        data = resp.json().get("data", {})

        bins = data.get("bins", [])
        counts = data.get("counts", [])
        total_trips = sum(counts) if counts else 0

        print(f"   ✓ {len(bins)} bins")
        print(f"   ✓ Total trips in histogram: {total_trips}")

        if len(bins) != len(counts):
            print(f"   ⚠ WARNING: bins length ({len(bins)}) != counts length ({len(counts)})")
        if not bins:
            print("   ⚠ WARNING: No histogram bins")
        if total_trips == 0:
            print("   ⚠ WARNING: All histogram counts are 0 — no trip data?")

    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False
    return True


def main():
    parser = argparse.ArgumentParser(description="Test traffic mode endpoints")
    parser.add_argument("--city", required=True, help="City name or ID to test")
    args = parser.parse_args()

    print(f"\n🚴 Traffic Mode Tests")
    print(f"API: {API_BASE}")
    print(f"City: {args.city}")

    city_id = get_city_id(args.city)
    if not city_id:
        sys.exit(1)

    print(f"✓ Using city_id={city_id}")

    results = [
        test_traffic_modes(city_id),
        test_traffic_map(city_id),
        test_traffic_infra_coverage(city_id),
        test_traffic_histogram(city_id),
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
