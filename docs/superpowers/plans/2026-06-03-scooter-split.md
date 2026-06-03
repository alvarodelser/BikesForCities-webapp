# Scooter Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show scooters (patinete / VMU) as a dedicated row and column in the collision heatmap and pedestrian matrix, separate from bicycles.

**Architecture:** The backend SQL CASE expression maps raw vehicle strings to category keys; splitting `bike_vmu` into `bike_vmu` (bicicleta + ePAC) and `scooter` (VMU + patinete) propagates cleanly to the frontend via the existing `VehiclePairStat` API response. The frontend hook and component then just need the new key registered.

**Tech Stack:** Python / psycopg2 (backend), React + TypeScript + Vitest (frontend), @phosphor-icons/react

---

## File Map

| File | Change |
|---|---|
| `backend/database/db_io/accidents.py` | Split one SQL CASE branch into two |
| `frontend/src/hooks/useAccidentsStats.ts` | Add `'scooter'` key, update pedestrian matrix |
| `frontend/src/hooks/useAccidentsStats.test.ts` | New — unit tests for pure functions |
| `frontend/src/components/city/plots/CollisionHeatmap.tsx` | Import Scooter icon, register in VEHICLE_META + DISPLAY_ORDER |

---

### Task 1: Backend SQL — split `scooter` out of `bike_vmu`

**Files:**
- Modify: `backend/database/db_io/accidents.py:225-227`

- [ ] **Step 1: Open the file and locate the CASE expression**

  In `backend/database/db_io/accidents.py`, find lines 225–227 (inside `WITH participant_cats AS`):

  ```python
  WHEN ap.vehicle_type ILIKE '%%bicicleta%%' OR ap.vehicle_type ILIKE '%%epac%%'
       OR ap.vehicle_type ILIKE '%%vmu%%' OR ap.vehicle_type ILIKE '%%patinete%%'
       THEN 'bike_vmu'
  ```

- [ ] **Step 2: Replace with two branches**

  Remove the two `vmu` / `patinete` conditions from the `bike_vmu` branch and add a new `scooter` branch immediately after it:

  ```python
  WHEN ap.vehicle_type ILIKE '%%bicicleta%%' OR ap.vehicle_type ILIKE '%%epac%%'
       THEN 'bike_vmu'
  WHEN ap.vehicle_type ILIKE '%%vmu%%' OR ap.vehicle_type ILIKE '%%patinete%%'
       THEN 'scooter'
  ```

  The surrounding context (lines 223–224 before, lines 228+ after) stays unchanged.

- [ ] **Step 3: Commit**

  ```bash
  git add backend/database/db_io/accidents.py
  git commit -m "feat(accidents): split scooter category out of bike_vmu in SQL"
  ```

---

### Task 2: Frontend hook — register `scooter` key and update pedestrian matrix

**Files:**
- Modify: `frontend/src/hooks/useAccidentsStats.ts`
- Create: `frontend/src/hooks/useAccidentsStats.test.ts`

- [ ] **Step 1: Write failing tests**

  Create `frontend/src/hooks/useAccidentsStats.test.ts`:

  ```typescript
  import { describe, it, expect } from 'vitest';
  import { COLLISION_VEHICLE_KEYS } from './useAccidentsStats';

  // --- Pull internal functions out for testing via a re-export shim below ---
  // These are tested via their observable output on COLLISION_VEHICLE_KEYS
  // and by calling the exported helpers once we expose them.

  describe('COLLISION_VEHICLE_KEYS', () => {
    it('includes scooter', () => {
      expect(COLLISION_VEHICLE_KEYS).toContain('scooter');
    });

    it('still includes bike_vmu', () => {
      expect(COLLISION_VEHICLE_KEYS).toContain('bike_vmu');
    });

    it('has 7 entries', () => {
      expect(COLLISION_VEHICLE_KEYS).toHaveLength(7);
    });
  });
  ```

- [ ] **Step 2: Run tests — expect failures**

  ```bash
  cd frontend && npx vitest run src/hooks/useAccidentsStats.test.ts
  ```

  Expected: 2 tests fail ("includes scooter", "has 7 entries").

- [ ] **Step 3: Update `COLLISION_VEHICLE_KEYS`**

  In `frontend/src/hooks/useAccidentsStats.ts`, line 97, change:

  ```typescript
  // before
  export const COLLISION_VEHICLE_KEYS = ['bike_vmu', 'pedestrian', 'moto', 'car', 'bus', 'truck'] as const;
  ```

  to:

  ```typescript
  export const COLLISION_VEHICLE_KEYS = ['bike_vmu', 'scooter', 'pedestrian', 'moto', 'car', 'bus', 'truck'] as const;
  ```

- [ ] **Step 4: Run tests — expect all 3 to pass**

  ```bash
  cd frontend && npx vitest run src/hooks/useAccidentsStats.test.ts
  ```

  Expected: 3 PASS.

- [ ] **Step 5: Update `PEDESTRIAN_VEHICLE_ROWS` and its mapping**

  In `useAccidentsStats.ts`, find `PEDESTRIAN_VEHICLE_ROWS` (line ~89) and `buildPedestrianMatrixFromPairStats` (line ~133).

  Replace the rows constant:

  ```typescript
  // before
  const PEDESTRIAN_VEHICLE_ROWS = [
    'Coche/Furg',
    'Bus',
    'Camión/Maq',
    'Moto',
    'Bicicleta',
  ] as const;
  ```

  ```typescript
  // after
  const PEDESTRIAN_VEHICLE_ROWS = [
    'Coche/Furg',
    'Bus',
    'Camión/Maq',
    'Moto',
    'Bici/EPAC',
    'Patinete/VMU',
  ] as const;
  ```

  Inside `buildPedestrianMatrixFromPairStats`, replace the `colToRow` map:

  ```typescript
  // before
  const colToRow: Record<string, string> = {
    car: 'Coche/Furg',
    bus: 'Bus',
    truck: 'Camión/Maq',
    moto: 'Moto',
    bike_vmu: 'Bicicleta',
  };
  ```

  ```typescript
  // after
  const colToRow: Record<string, string> = {
    car: 'Coche/Furg',
    bus: 'Bus',
    truck: 'Camión/Maq',
    moto: 'Moto',
    bike_vmu: 'Bici/EPAC',
    scooter: 'Patinete/VMU',
  };
  ```

- [ ] **Step 6: Verify TypeScript compiles**

  ```bash
  cd frontend && npx tsc --noEmit
  ```

  Expected: no errors. (The `CollisionVehicleKey` union type is derived from `COLLISION_VEHICLE_KEYS`, so `'scooter'` is automatically included.)

- [ ] **Step 7: Commit**

  ```bash
  git add frontend/src/hooks/useAccidentsStats.ts frontend/src/hooks/useAccidentsStats.test.ts
  git commit -m "feat(stats): add scooter as collision matrix key, update pedestrian matrix rows"
  ```

---

### Task 3: Frontend component — register scooter in the heatmap

**Files:**
- Modify: `frontend/src/components/city/plots/CollisionHeatmap.tsx`

- [ ] **Step 1: Add Scooter to the import**

  In `CollisionHeatmap.tsx`, line 5–7, change:

  ```typescript
  // before
  import {
    Bicycle, PersonSimpleWalk, Motorcycle, CarProfile, Van, Truck,
  } from '@phosphor-icons/react';
  ```

  ```typescript
  // after
  import {
    Bicycle, PersonSimpleWalk, Motorcycle, CarProfile, Van, Truck, Scooter,
  } from '@phosphor-icons/react';
  ```

- [ ] **Step 2: Add scooter entry to `VEHICLE_META`**

  In `CollisionHeatmap.tsx`, `VEHICLE_META` starts at line 10. Add the `scooter` entry:

  ```typescript
  // before
  const VEHICLE_META: Record<CollisionVehicleKey, { label: string; icon: React.ElementType; color: string }> = {
    bike_vmu:   { label: 'Bicicleta', icon: Bicycle,          color: ICON_COLOR },
    pedestrian: { label: 'Peatón',    icon: PersonSimpleWalk,  color: ICON_COLOR },
    moto:       { label: 'Moto',      icon: Motorcycle,        color: ICON_COLOR },
    car:        { label: 'Turismo',   icon: CarProfile,        color: ICON_COLOR },
    bus:        { label: 'Autobús',   icon: Van,               color: ICON_COLOR },
    truck:      { label: 'Camión',    icon: Truck,             color: ICON_COLOR },
  };
  ```

  ```typescript
  // after
  const VEHICLE_META: Record<CollisionVehicleKey, { label: string; icon: React.ElementType; color: string }> = {
    bike_vmu:   { label: 'Bici/EPAC',     icon: Bicycle,          color: ICON_COLOR },
    scooter:    { label: 'Patinete/VMU',  icon: Scooter,          color: ICON_COLOR },
    pedestrian: { label: 'Peatón',        icon: PersonSimpleWalk,  color: ICON_COLOR },
    moto:       { label: 'Moto',          icon: Motorcycle,        color: ICON_COLOR },
    car:        { label: 'Turismo',       icon: CarProfile,        color: ICON_COLOR },
    bus:        { label: 'Autobús',       icon: Van,               color: ICON_COLOR },
    truck:      { label: 'Camión',        icon: Truck,             color: ICON_COLOR },
  };
  ```

  Note: the `bike_vmu` label is also updated from `'Bicicleta'` to `'Bici/EPAC'` to reflect that scooters are no longer counted there.

- [ ] **Step 3: Add scooter to `DISPLAY_ORDER`**

  Line 20, change:

  ```typescript
  // before
  const DISPLAY_ORDER: CollisionVehicleKey[] = ['pedestrian', 'bike_vmu', 'moto', 'car', 'bus', 'truck'];
  ```

  ```typescript
  // after
  const DISPLAY_ORDER: CollisionVehicleKey[] = ['pedestrian', 'bike_vmu', 'scooter', 'moto', 'car', 'bus', 'truck'];
  ```

- [ ] **Step 4: Verify TypeScript compiles**

  ```bash
  cd frontend && npx tsc --noEmit
  ```

  Expected: no errors. The `Record<CollisionVehicleKey, …>` type on `VEHICLE_META` will error if any key is missing — a full 7-entry map is now required.

- [ ] **Step 5: Run all tests**

  ```bash
  cd frontend && npx vitest run
  ```

  Expected: all tests pass (no regressions).

- [ ] **Step 6: Commit**

  ```bash
  git add frontend/src/components/city/plots/CollisionHeatmap.tsx
  git commit -m "feat(heatmap): add Patinete/VMU row and column to collision matrix"
  ```

---

## Verification checklist

After all tasks are complete:

- [ ] Backend returns `scooter` as a category in `/api/accidents/vehicle-pairs/{city_id}` responses (check with `curl` or the browser network tab after restarting the backend).
- [ ] The collision heatmap renders a 7×7 grid with a Scooter icon row and column.
- [ ] The pedestrian matrix shows separate "Bici/EPAC" and "Patinete/VMU" rows.
- [ ] The `bike_vmu` cells contain only bicycle/ePAC data (scooter counts moved to `scooter` cells).
- [ ] `npx tsc --noEmit` exits clean.
- [ ] `npx vitest run` exits clean.
