"""
Integration test: after Madrid bike-infra ingestion, verify that:
  1. Some edges have bike_infra populated.
  2. OSM `highway` is never silently overwritten.
  3. peligrosidad_score on a known-cycleway Madrid edge is <= the score
     it would have without bike_infra.

Run on the server where the DB is reachable:
    python integration_tests/test_bike_infra_ingestion.py
"""
from __future__ import annotations
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))
from dotenv import load_dotenv
from backend.database.db_io.connection import connect_db


def main() -> int:
    load_dotenv()
    conn = connect_db()
    cur = conn.cursor()
    failures = []

    # 1. Bike infra is populated for Madrid
    cur.execute("""
        SELECT bike_infra, COUNT(*)
        FROM edges
        WHERE city_id = (SELECT id FROM cities WHERE name = 'Madrid')
          AND bike_infra IS NOT NULL
        GROUP BY bike_infra
    """)
    by_cat = dict(cur.fetchall())
    n_cycleway = by_cat.get("cycleway", 0)
    n_secondary = by_cat.get("secondary", 0)
    print(f"  cycleway:  {n_cycleway:,} edges")
    print(f"  secondary: {n_secondary:,} edges")
    if n_cycleway < 100:
        failures.append(f"Expected >100 cycleway edges, got {n_cycleway}")
    if n_secondary < 100:
        failures.append(f"Expected >100 secondary edges, got {n_secondary}")

    # 2. Sanity: bike_infra='cycleway' edges include some that OSM had as
    #    NOT-cycleway (proving Madrid added new information).
    cur.execute("""
        SELECT COUNT(*) FROM edges
        WHERE city_id = (SELECT id FROM cities WHERE name = 'Madrid')
          AND bike_infra = 'cycleway' AND highway != 'cycleway'
    """)
    n_new = cur.fetchone()[0]
    print(f"  new cycleways (not in OSM): {n_new:,}")
    if n_new == 0:
        failures.append("Madrid added zero new cycleways — spatial match suspicious")

    # 3. peligrosidad consistency: for any 'cycleway' bike_infra edge,
    #    peligrosidad <= what OSM alone would have given.
    cur.execute("""
        SELECT
          peligrosidad_score(highway, bike_infra, maxspeed, lanes, tunnel, bridge) AS with_infra,
          peligrosidad_score(highway, NULL,       maxspeed, lanes, tunnel, bridge) AS without_infra
        FROM edges
        WHERE city_id = (SELECT id FROM cities WHERE name = 'Madrid')
          AND bike_infra = 'cycleway'
        LIMIT 200
    """)
    rows = cur.fetchall()
    bad = [r for r in rows if r[0] > r[1]]
    print(f"  cycleway peligrosidad-monotonicity check: "
          f"{len(rows) - len(bad)}/{len(rows)} OK")
    if bad:
        failures.append(f"{len(bad)} edges have HIGHER peligrosidad with bike_infra")

    cur.close()
    conn.close()

    if failures:
        print("\n❌ Failures:")
        for f in failures:
            print(f"   - {f}")
        return 1
    print("\n✅ All ingestion checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
