# Landing Traffic O/D Bubble Map — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate a static PNG of clustered trip O/D volume bubbles and wire it into the `MapsPanel` landing page showcase component.

**Architecture:** A self-contained Jupyter notebook (`notebooks/generate_landing_maps.ipynb`) queries trips + nodes from the DB, aggregates O/D counts per H3 hex, and renders a decorative gradient bubble map saved to `frontend/public/landing/map_traffic_od.png`. `MapsPanel.tsx` is then updated to display that static image instead of its current placeholder graphics.

**Tech Stack:** Python 3.11, psycopg2, h3-py, numpy, pandas, matplotlib, dotenv (notebook side); React 18 / TypeScript, vitest (frontend side).

---

## Files

| Action | Path |
|--------|------|
| Create (dir) | `frontend/public/landing/` |
| Create | `notebooks/generate_landing_maps.ipynb` |
| Modify | `frontend/src/components/landing/showcase/MapsPanel.test.tsx` |
| Modify | `frontend/src/components/landing/showcase/MapsPanel.tsx` |

---

### Task 1: Create output directory and notebook skeleton

**Files:**
- Create: `frontend/public/landing/` (directory)
- Create: `notebooks/generate_landing_maps.ipynb` (cell 1 only)

- [ ] **Step 1: Create the output directory**

```bash
mkdir -p frontend/public/landing
```

- [ ] **Step 2: Create the notebook and add cell 1 (imports + parameters)**

Open Jupyter from the project root (`jupyter notebook` or `jupyter lab`), create a new Python 3 notebook at `notebooks/generate_landing_maps.ipynb`, and paste the following as **Cell 1**:

```python
%load_ext autoreload
%autoreload 2

from pathlib import Path
from collections import defaultdict

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import h3
from dotenv import load_dotenv

from backend.database.db_io import connect_db, get_city_center

load_dotenv()

# ─── Parameters ──────────────────────────────────────────────────────────────
CITY_ID       = 1        # Default: Madrid. Swap to any city_id.
H3_RESOLUTION = 7        # 7 ≈ 1.2 km cells → ~20-40 bubbles; 8 ≈ 0.5 km → denser
MIN_VOLUME    = 50       # Drop hexes with fewer total trips than this
BUBBLE_SCALE  = 1.0      # Radius multiplier — tune visually after first run
BASE_RADIUS   = 18       # Base scatter size before volume scaling
OUTPUT_DIR    = Path('../frontend/public/landing')
FIG_W, FIG_H  = 6, 5
DPI           = 150
COLOR         = '#027A76'
BG_COLOR      = '#FBF6EF'
BBOX_COLOR    = '#003849'

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
print(f'Output dir: {OUTPUT_DIR.resolve()}')
```

- [ ] **Step 3: Run cell 1 and verify**

Run the cell. Expected output: a line like `Output dir: .../frontend/public/landing`. If you see an import error for `h3`, install it: `pip install h3`.

- [ ] **Step 4: Commit the notebook skeleton**

```bash
git add frontend/public/landing notebooks/generate_landing_maps.ipynb
git commit -m "feat: add landing maps notebook skeleton and output directory"
```

---

### Task 2: DB query and H3 aggregation cell

**Files:**
- Modify: `notebooks/generate_landing_maps.ipynb` (add cell 2)

- [ ] **Step 1: Add cell 2 (DB query + H3 aggregation)**

Add as **Cell 2** in the notebook:

```python
conn = connect_db()

# City center for bbox + coordinate reference
center_data = get_city_center(conn, CITY_ID)
if center_data is None:
    raise ValueError(f'No center coordinates for city_id={CITY_ID}')
center_lat, center_lon, _ = center_data
print(f'City center: ({center_lat:.4f}, {center_lon:.4f})')

# Origin counts per node
with conn.cursor() as cur:
    cur.execute("""
        SELECT n.lat, n.lon, COUNT(*) AS cnt
        FROM trips t
        JOIN nodes n ON n.id = t.origin_node
        WHERE t.city_id = %s
          AND t.origin_node IS NOT NULL
          AND n.lat IS NOT NULL AND n.lon IS NOT NULL
        GROUP BY n.lat, n.lon
    """, (CITY_ID,))
    origins = cur.fetchall()

# Destination counts per node
with conn.cursor() as cur:
    cur.execute("""
        SELECT n.lat, n.lon, COUNT(*) AS cnt
        FROM trips t
        JOIN nodes n ON n.id = t.dest_node
        WHERE t.city_id = %s
          AND t.dest_node IS NOT NULL
          AND n.lat IS NOT NULL AND n.lon IS NOT NULL
        GROUP BY n.lat, n.lon
    """, (CITY_ID,))
    destinations = cur.fetchall()

conn.close()
print(f'Raw origin nodes: {len(origins)}, destination nodes: {len(destinations)}')

# Aggregate into H3 hexes (origins + destinations combined)
hex_volumes: dict = defaultdict(int)
for lat, lon, cnt in list(origins) + list(destinations):
    cell = h3.latlng_to_cell(float(lat), float(lon), H3_RESOLUTION)
    hex_volumes[cell] += int(cnt)

# Filter by MIN_VOLUME, build DataFrame with hex centroid coordinates
rows = []
for cell, vol in hex_volumes.items():
    if vol >= MIN_VOLUME:
        clat, clon = h3.cell_to_latlng(cell)
        rows.append({'lat': clat, 'lon': clon, 'volume': vol})

bubbles_df = pd.DataFrame(rows)
print(f'Hexes after MIN_VOLUME={MIN_VOLUME} filter: {len(bubbles_df)}')
if not bubbles_df.empty:
    print(bubbles_df['volume'].describe().to_string())
```

- [ ] **Step 2: Run cell 2 and verify**

Run the cell. Expected output includes:
- `City center: (40.xxxx, -3.xxxx)` (for Madrid)
- `Raw origin nodes: N, destination nodes: M` where N, M > 0
- `Hexes after MIN_VOLUME=50 filter: K` — aim for 15–50 bubbles. If K is 0, lower `MIN_VOLUME`. If K > 80, raise `H3_RESOLUTION` to 8.

- [ ] **Step 3: Commit**

```bash
git add notebooks/generate_landing_maps.ipynb
git commit -m "feat: add H3 O/D aggregation cell to landing maps notebook"
```

---

### Task 3: Bubble plot cell

**Files:**
- Modify: `notebooks/generate_landing_maps.ipynb` (add cell 3)

- [ ] **Step 1: Add cell 3 (plot + save)**

Add as **Cell 3** in the notebook:

```python
fig, ax = plt.subplots(figsize=(FIG_W, FIG_H))
ax.set_facecolor(BG_COLOR)
fig.patch.set_facecolor(BG_COLOR)

# Faint study-area bbox rectangle (10×10 km around city center)
lat_off = 5000 / 111320
lon_off = 5000 / (111320 * np.cos(np.radians(center_lat)))
rect_lons = [
    center_lon - lon_off, center_lon + lon_off,
    center_lon + lon_off, center_lon - lon_off,
    center_lon - lon_off,
]
rect_lats = [
    center_lat - lat_off, center_lat - lat_off,
    center_lat + lat_off, center_lat + lat_off,
    center_lat - lat_off,
]
ax.plot(rect_lons, rect_lats,
        color=BBOX_COLOR, linewidth=0.4, alpha=0.25, linestyle='--', zorder=1)

# Gradient circles: 4 stacked scatter passes per point (core → halo)
if not bubbles_df.empty:
    max_vol = bubbles_df['volume'].max()
    radii = BASE_RADIUS * BUBBLE_SCALE * np.sqrt(bubbles_df['volume'].values / max_vol)
    lons  = bubbles_df['lon'].values
    lats  = bubbles_df['lat'].values

    for mult, alpha in [(1.0, 0.85), (2.0, 0.30), (3.5, 0.12), (5.5, 0.05)]:
        ax.scatter(lons, lats, s=(radii * mult) ** 2,
                   c=COLOR, alpha=alpha, linewidths=0, zorder=3)

# Clip axes to bbox + 15% margin
ax.set_xlim(center_lon - lon_off * 1.15, center_lon + lon_off * 1.15)
ax.set_ylim(center_lat - lat_off * 1.15, center_lat + lat_off * 1.15)
ax.axis('off')
plt.tight_layout(pad=0)

out_path = OUTPUT_DIR / 'map_traffic_od.png'
fig.savefig(out_path, dpi=DPI, bbox_inches='tight', facecolor=BG_COLOR)
plt.show()
plt.close(fig)
print(f'✅ Saved to {out_path.resolve()}')
```

- [ ] **Step 2: Run cell 3 and verify visually**

Run the cell. You should see the image inline in the notebook: cream background, faint dashed rectangle, teal gradient bubbles of varying sizes. Verify `frontend/public/landing/map_traffic_od.png` exists:

```bash
ls -lh frontend/public/landing/map_traffic_od.png
```

Expected: file exists, ~100–400 KB.

If the bubbles are too dense → raise `H3_RESOLUTION` to 8 or raise `MIN_VOLUME`.
If bubbles are too few or all the same size → lower `H3_RESOLUTION` to 6 or lower `MIN_VOLUME`.
Tune `BASE_RADIUS` and `BUBBLE_SCALE` for size.

- [ ] **Step 3: Commit the notebook and generated image**

```bash
git add notebooks/generate_landing_maps.ipynb frontend/public/landing/map_traffic_od.png
git commit -m "feat: generate traffic O/D bubble map thumbnail for landing page"
```

---

### Task 4: Update MapsPanel test (TDD — write failing test first)

**Files:**
- Modify: `frontend/src/components/landing/showcase/MapsPanel.test.tsx`

- [ ] **Step 1: Replace the test file content**

The current tests check for `'Infraestructura'`, `'Accidentes'`, `'Tráfico'` labels which will no longer exist. Replace the entire file with:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import MapsPanel from './MapsPanel';

vi.mock('../../../services/api', () => ({
  fetchCities: vi.fn().mockResolvedValue([]),
}));

describe('MapsPanel', () => {
  it('renders section title', () => {
    render(<MemoryRouter><MapsPanel /></MemoryRouter>);
    expect(screen.getByText('Modelos de movilidad para tu ciudad')).toBeInTheDocument();
  });

  it('renders the traffic O/D map image with correct src and alt', () => {
    render(<MemoryRouter><MapsPanel /></MemoryRouter>);
    const img = screen.getByAltText('Mapa de flujos origen-destino de movilidad ciclista');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', '/landing/map_traffic_od.png');
  });

  it('renders the CTA button', () => {
    render(<MemoryRouter><MapsPanel /></MemoryRouter>);
    expect(screen.getByRole('button', { name: /explorar mapas/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests and confirm the image test fails**

```bash
cd frontend && npx vitest run src/components/landing/showcase/MapsPanel.test.tsx
```

Expected: `renders the traffic O/D map image` FAILS (no `<img>` yet), `renders section title` and CTA still pass.

---

### Task 5: Update MapsPanel component

**Files:**
- Modify: `frontend/src/components/landing/showcase/MapsPanel.tsx`

- [ ] **Step 1: Replace MapsPanel.tsx with the static image implementation**

Replace the entire file content:

```tsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import type { CityData } from '../../../constants/cities';
import { fetchCities } from '../../../services/api';
import ShowcasePanel from './ShowcasePanel';

const MapsPanel: React.FC = () => {
  const navigate = useNavigate();
  const [firstCityPath, setFirstCityPath] = useState<string | null>(null);

  useEffect(() => {
    fetchCities()
      .then((cities: CityData[]) => {
        if (cities.length > 0) setFirstCityPath(cities[0].path);
      })
      .catch(() => {});
  }, []);

  return (
    <ShowcasePanel
      graphic={
        <img
          src="/landing/map_traffic_od.png"
          alt="Mapa de flujos origen-destino de movilidad ciclista"
          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }}
        />
      }
      eyebrow="Análisis · mapas"
      title="Modelos de movilidad para tu ciudad"
      body="Infraestructura ciclista, accidentalidad y flujos de tráfico: tres capas de análisis para entender cómo se mueve tu ciudad — y dónde hay que actuar."
      ctaLabel="Explorar mapas →"
      onCta={() => navigate(firstCityPath ?? '/compare')}
    />
  );
};

export default MapsPanel;
```

- [ ] **Step 2: Run the tests and confirm all pass**

```bash
cd frontend && npx vitest run src/components/landing/showcase/MapsPanel.test.tsx
```

Expected: all 3 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/landing/showcase/MapsPanel.tsx \
        frontend/src/components/landing/showcase/MapsPanel.test.tsx
git commit -m "feat: replace MapsPanel placeholder with static traffic O/D bubble image"
```
