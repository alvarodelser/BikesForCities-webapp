# Scooter split from bike_vmu in accident stats matrix

**Date:** 2026-06-03  
**Branch:** dev

## Problem

Scooters (patinete / VMU) were merged into the `bike_vmu` backend category alongside bicycles and ePACs, making them invisible as a distinct row/column in the collision heatmap and pedestrian matrix.

## Design

Split the single `bike_vmu` SQL CASE branch into two distinct categories:

| New category | Matches |
|---|---|
| `bike_vmu` | `bicicleta`, `epac` |
| `scooter`  | `vmu`, `patinete`  |

### Files changed

**1. `backend/database/db_io/accidents.py` (lines 225–227)**  
Replace the combined CASE branch with two separate branches.

**2. `frontend/src/hooks/useAccidentsStats.ts`**  
- Add `'scooter'` to `COLLISION_VEHICLE_KEYS` (7th entry).  
- Add `'Patinete/VMU'` to `PEDESTRIAN_VEHICLE_ROWS`.  
- Rename `bike_vmu` pedestrian-matrix row label to `'Bici/EPAC'` (scooters no longer counted there).  
- Map `scooter → 'Patinete/VMU'` in `buildPedestrianMatrixFromPairStats`.

**3. `frontend/src/components/city/plots/CollisionHeatmap.tsx`**  
- Import `Scooter` from `@phosphor-icons/react`.  
- Add `scooter: { label: 'Patinete/VMU', icon: Scooter, color: ICON_COLOR }` to `VEHICLE_META`.  
- Insert `'scooter'` into `DISPLAY_ORDER` after `'bike_vmu'`.

### Out of scope

The cyclist matrix (what vehicle types hit cyclists) is not modified. Scooter-cyclist collisions currently fall through to the `'Coche/Furg'` catch-all row; this is acceptable given their low frequency and is not what was requested.

## Acceptance criteria

- Collision heatmap shows a 7×7 matrix with a dedicated Patinete/VMU row and column.  
- Pedestrian matrix has separate "Bici/EPAC" and "Patinete/VMU" rows.  
- The `bike_vmu` row/column data reflects only bicycles and ePACs.  
- No TypeScript type errors introduced.
