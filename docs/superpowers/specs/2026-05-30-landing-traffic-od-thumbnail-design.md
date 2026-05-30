---
name: landing-traffic-od-thumbnail
description: Design spec for the traffic O/D bubble map PNG thumbnail used in the MapsPanel landing page showcase component
metadata:
  type: project
---

# Landing Page — Traffic O/D Bubble Map Thumbnail

## Problem

The `MapsPanel` showcase component on the landing page currently shows placeholder graphics (dot grids and colored lines). Loading a real MapLibre map would be too slow for a landing page (WebGL init + tile fetches). The solution is to pre-generate a static PNG using Python/matplotlib and serve it as a static asset.

## What We Are Building

A Jupyter notebook (`notebooks/generate_landing_maps.ipynb`) that queries the database, clusters trip origin/destination data into H3 hexes, and renders a decorative bubble map saved as a PNG to `frontend/public/landing/map_traffic_od.png`.

The image replaces the placeholder graphic in `MapsPanel.tsx`.

## Notebook Design

### File
`notebooks/generate_landing_maps.ipynb`

### Parameters cell (top of notebook)
```python
CITY_ID       = 1        # Default: Madrid. Swap to any city_id.
H3_RESOLUTION = 7        # 7 ≈ 1.2 km cells → ~20-40 bubbles; 8 ≈ 0.5 km → denser
MIN_VOLUME    = 50       # Drop hexes with fewer total trips than this
BUBBLE_SCALE  = 1.0      # Radius multiplier — tune visually after first run
BASE_RADIUS   = 18       # Base scatter size (points²) before volume scaling
OUTPUT_DIR    = Path("../frontend/public/landing")
FIG_W, FIG_H  = 6, 5     # inches
DPI           = 150      # → 900×750 px output
```

### Data query

Aggregate trip counts by H3 hex for both origins and destinations:

```sql
-- Origins per node
SELECT origin_node AS node_id, COUNT(*) AS cnt
FROM trips WHERE city_id = %s
  AND origin_node IS NOT NULL
GROUP BY origin_node

-- Destinations per node
SELECT dest_node AS node_id, COUNT(*) AS cnt
FROM trips WHERE city_id = %s
  AND dest_node IS NOT NULL
GROUP BY dest_node
```

Join each with `nodes` to get `lat/lon`. Map each coordinate to an H3 cell at `H3_RESOLUTION`. Sum counts per hex (origins + destinations). Filter by `MIN_VOLUME`. The hex centroid (`h3.cell_to_latlng`) becomes the bubble position.

City center (for bbox + coordinate projection) is fetched via `get_city_center(conn, city_id)` which returns `(center_lat, center_lon, radius)`. The `h3` package is already a dependency (used in `trips.py`).

### Visual style

- **Background:** `#FBF6EF` (cream — matches app map background)
- **No geographic feature layers** — pure bubble visualization
- **Faint study-area rectangle:** thin dashed outline of the 10×10 km bbox around city center, `#003849`, linewidth=0.4, alpha=0.25. Anchors the bubbles geographically without adding visual noise.
- **Gradient circles:** 4 stacked scatter layers per point, from opaque core to transparent halo:
  - Layer 1 (core): `s = r²`,      alpha=0.85
  - Layer 2:        `s = (2r)²`,   alpha=0.30
  - Layer 3:        `s = (3.5r)²`, alpha=0.12
  - Layer 4 (halo): `s = (5.5r)²`, alpha=0.05
  - Where `r = BUBBLE_SCALE × sqrt(volume / max_volume) × BASE_RADIUS`
- **Color:** `#027A76` (dark teal — matches traffic layer palette)
- **Axes:** off. No labels, no ticks, no title.
- **Tight layout**, no padding.

### Output
`frontend/public/landing/map_traffic_od.png` — 900×750 px PNG.

## Frontend Integration

Update `MapsPanel.tsx`:

- Remove the `MapsGraphic` placeholder component
- Replace with a single `<img>` tag pointing to `/landing/map_traffic_od.png`
- The image fills the graphic card area (same `ShowcasePanel` wrapper, same dimensions)
- `alt` text: `"Mapa de flujos origen-destino de movilidad ciclista"`
- `object-fit: cover` so it scales correctly at different viewport sizes

## Parameters for future adjustment

After the first render, the likely knobs to turn:
1. `H3_RESOLUTION` — coarser (6) for fewer larger bubbles, finer (8-9) for a denser field
2. `MIN_VOLUME` — raise to remove the long tail of small bubbles
3. `BUBBLE_SCALE` — scale all radii up/down uniformly
4. `BASE_RADIUS` — absolute size anchor before scaling
5. Layer alphas — adjust bloom softness
