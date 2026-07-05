import { describe, it, expect } from 'vitest';
import {
  generateBuilding, nextGap, crossedBike, shouldRecycle, pulseIntensity,
  GAP_MIN, GAP_MAX, PULSE_MS, RECYCLE_X, LANE_CLEARANCE,
  type BuildingKind,
} from './buildings.logic';

// Deterministic rng from a fixed sequence, cycling.
const seq = (vals: number[]) => {
  let i = 0;
  return () => vals[i++ % vals.length];
};

describe('crossedBike', () => {
  it('fires exactly when a building crosses x=0 moving backwards', () => {
    expect(crossedBike(0.1, -0.1)).toBe(true);
    expect(crossedBike(5, 1)).toBe(false);    // still ahead
    expect(crossedBike(-1, -2)).toBe(false);  // already behind
    expect(crossedBike(0, -1)).toBe(false);   // was already at/behind bike
  });
});

describe('shouldRecycle', () => {
  it('recycles only past the recycle line', () => {
    expect(shouldRecycle(RECYCLE_X - 1)).toBe(true);
    expect(shouldRecycle(RECYCLE_X + 1)).toBe(false);
  });
});

describe('pulseIntensity', () => {
  it('is zero outside the pulse window', () => {
    expect(pulseIntensity(-1)).toBe(0);
    expect(pulseIntensity(PULSE_MS)).toBe(0);
    expect(pulseIntensity(PULSE_MS + 500)).toBe(0);
  });
  it('rises to a peak then decays', () => {
    const peak = pulseIntensity(PULSE_MS * 0.25);
    expect(peak).toBeCloseTo(1);
    expect(pulseIntensity(PULSE_MS * 0.05)).toBeLessThan(peak);
    expect(pulseIntensity(PULSE_MS * 0.9)).toBeLessThan(peak);
  });
});

describe('nextGap', () => {
  it('stays within [GAP_MIN, GAP_MAX]', () => {
    expect(nextGap(() => 0)).toBe(GAP_MIN);
    expect(nextGap(() => 0.999999)).toBeLessThanOrEqual(GAP_MAX);
    expect(nextGap(() => 0.5)).toBeGreaterThan(GAP_MIN);
  });
});

describe('generateBuilding', () => {
  it('keeps buildings clear of the lane on the requested side', () => {
    for (const r of [0, 0.3, 0.7, 0.99]) {
      const behind = generateBuilding(seq([r, r, r, r, r]), 1);
      const front = generateBuilding(seq([r, r, r, r, r]), -1);
      expect(behind.z).toBeGreaterThanOrEqual(LANE_CLEARANCE);
      expect(front.z).toBeLessThanOrEqual(-LANE_CLEARANCE);
    }
  });

  it('produces sane positive dimensions', () => {
    for (const r of [0, 0.25, 0.5, 0.75, 0.999]) {
      const b = generateBuilding(seq([r, r, r, r, r]), 1);
      expect(b.w).toBeGreaterThan(0);
      expect(b.d).toBeGreaterThan(0);
      expect(b.h).toBeGreaterThan(0);
      expect(b.h).toBeLessThan(30);
    }
  });

  it('reaches every silhouette kind across the rng range', () => {
    const kinds = new Set<BuildingKind>();
    for (let i = 0; i < 200; i++) {
      const r = i / 200;
      kinds.add(generateBuilding(seq([r, 0.5, 0.5, 0.5, 0.5]), 1).kind);
    }
    expect(kinds).toEqual(new Set(['box', 'slab', 'tower', 'stepped', 'l']));
  });
});
