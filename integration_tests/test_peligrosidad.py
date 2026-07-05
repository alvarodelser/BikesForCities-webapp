"""
Integration test: verify peligrosidad_score and route_cost SQL functions
(migrations 010 + 024) match the calibration spec.

Run on the server where the DB is reachable:
    python integration_tests/test_peligrosidad.py
"""
from __future__ import annotations
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))
from dotenv import load_dotenv
from backend.database.db_io.connection import connect_db


PELIGROSIDAD_CASES = [
    # (highway, bike_infra, maxspeed, lanes, tunnel, bridge, expected)
    ("cycleway",      None,        None,    None,    False, False,  0),
    ("living_street", None,        None,    None,    False, False,  1),
    ("residential",   None,        None,    None,    False, False,  3),
    ("tertiary",      None,        None,    None,    False, False,  3),
    ("secondary",     None,        None,    None,    False, False,  6),
    ("primary",       None,        None,    None,    False, False, 12),
    ("trunk",         None,        None,    None,    False, False, 20),

    # Bridge/tunnel floor of 20
    ("residential",   None,        None,    None,    True,  False, 20),
    ("residential",   None,        None,    None,    False, True,  20),
    # Bridge does not exceed trunk
    ("trunk",         None,        None,    None,    True,  False, 20),

    # Speed penalties
    ("residential",   None,        [20],    None,    False, False,  3),
    ("residential",   None,        [30],    None,    False, False,  5),  # 3 + 2
    ("residential",   None,        [40],    None,    False, False,  7),  # 3 + 4
    ("residential",   None,        [50],    None,    False, False, 11),  # 3 + 8
    ("residential",   None,        [70],    None,    False, False, 19),  # 3 + 16

    # Lane penalties
    ("residential",   None,        None,    [1],     False, False,  3),
    ("residential",   None,        None,    [2],     False, False,  7),  # 3 + 4
    ("residential",   None,        None,    [3],     False, False, 11),  # 3 + 8
    ("residential",   None,        None,    [4],     False, False, 19),  # 3 + 16
    ("residential",   None,        None,    [6],     False, False, 19),  # 3 + 16

    # bike_infra upgrades safety (LEAST)
    ("primary",       "cycleway",  None,    None,    False, False,  0),
    ("primary",       "secondary", None,    None,    False, False,  6),
    # bike_infra does NOT raise danger above existing OSM class
    ("residential",   "secondary", None,    None,    False, False,  3),

    # Full primary urban (calibration anchor for route_cost): 12 + 8 + 16 = 36
    ("primary",       None,        [50],    [4],     False, False, 36),
]

ROUTE_COST_CASES = [
    # (length_m, peligrosidad, expected) — formula: l * (1 + p * l / 7200)
    (100.0,  0,  100.0),   # safe road costs exactly its length
    (100.0, 36,  150.0),   # primary 4-lane 50kmh — calibration anchor (kept)
    (200.0, 36,  400.0),   # tipping point — "won't ride a highway past here", feels 2x
    (500.0, 36, 1750.0),   # quadratic blow-up on long dangerous run
    (10.0,   0,   10.0),
]


def main() -> int:
    load_dotenv()
    conn = connect_db()
    cur = conn.cursor()

    failures = []

    print("\n🧪 peligrosidad_score()")
    for case in PELIGROSIDAD_CASES:
        hw, bi, ms, ln, tn, br, expected = case
        cur.execute(
            "SELECT peligrosidad_score(%s, %s, %s, %s, %s, %s)",
            (hw, bi, ms, ln, tn, br),
        )
        actual = cur.fetchone()[0]
        ok = actual == expected
        marker = "✓" if ok else "✗"
        print(f"  {marker} hw={hw!r:14} bi={bi!r:11} ms={ms} ln={ln} tn={tn} br={br}"
              f"  → {actual}  (expected {expected})")
        if not ok:
            failures.append((case, actual))

    print("\n🧪 route_cost()")
    for length, p, expected in ROUTE_COST_CASES:
        cur.execute("SELECT route_cost(%s, %s)", (length, p))
        actual = cur.fetchone()[0]
        # Allow ±2% tolerance for the logarithmic 500m anchor
        ok = abs(actual - expected) <= max(1.0, expected * 0.02)
        marker = "✓" if ok else "✗"
        print(f"  {marker} length={length:6.1f}m  peligrosidad={p:3d}"
              f"  → {actual:7.2f}  (expected ~{expected})")
        if not ok:
            failures.append((("route_cost", length, p), actual))

    cur.close()
    conn.close()

    if failures:
        print(f"\n❌ {len(failures)} test(s) failed:")
        for case, actual in failures:
            print(f"   {case} → got {actual}")
        return 1
    print(f"\n✅ All {len(PELIGROSIDAD_CASES) + len(ROUTE_COST_CASES)} cases passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
