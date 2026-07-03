import { describe, it, expect } from 'vitest';
import {
  PATH_TOP_Y,
  PATH_BOTTOM_Y,
  samplePath,
  curtainSteps,
  pointAtY,
  yForScore,
  sampleSpread,
  mainPathD,
} from './rideRibbon';

describe('samplePath', () => {
  const pts = samplePath();

  it('starts at the path top and ends at the path bottom', () => {
    expect(pts[0].x).toBeCloseTo(400, 0);
    expect(pts[0].y).toBeCloseTo(PATH_TOP_Y, 0);
    expect(pts[pts.length - 1].x).toBeCloseTo(95, 0);
    expect(pts[pts.length - 1].y).toBeCloseTo(PATH_BOTTOM_Y, 0);
  });

  it('is monotonically descending in y (within sampling tolerance)', () => {
    for (let i = 1; i < pts.length; i++) {
      expect(pts[i].y).toBeGreaterThanOrEqual(pts[i - 1].y - 0.6);
    }
  });
});

describe('pointAtY', () => {
  const pts = samplePath();

  it('resolves known curve points', () => {
    expect(pointAtY(pts, PATH_TOP_Y).x).toBeCloseTo(400, 0);
    expect(pointAtY(pts, PATH_BOTTOM_Y).x).toBeCloseTo(95, 0);
    // (427, 490) is a segment endpoint on the right bulge
    expect(Math.abs(pointAtY(pts, 490).x - 427)).toBeLessThan(3);
  });

  it('clamps out-of-range y to the path ends', () => {
    expect(pointAtY(pts, 0).y).toBeCloseTo(PATH_TOP_Y, 0);
    expect(pointAtY(pts, 2000).y).toBeCloseTo(PATH_BOTTOM_Y, 0);
  });
});

describe('yForScore', () => {
  it('maps min to the bottom and max to the top of the path', () => {
    expect(yForScore(10, 10, 90)).toBeCloseTo(PATH_BOTTOM_Y);
    expect(yForScore(90, 10, 90)).toBeCloseTo(PATH_TOP_Y);
    expect(yForScore(50, 10, 90)).toBeCloseTo((PATH_TOP_Y + PATH_BOTTOM_Y) / 2);
  });

  it('places a degenerate range at the path midpoint', () => {
    expect(yForScore(42, 42, 42)).toBeCloseTo((PATH_TOP_Y + PATH_BOTTOM_Y) / 2);
  });
});

describe('sampleSpread', () => {
  it('keeps first and last and returns k items', () => {
    const arr = Array.from({ length: 25 }, (_, i) => i);
    const picked = sampleSpread(arr, 10);
    expect(picked).toHaveLength(10);
    expect(picked[0]).toBe(0);
    expect(picked[picked.length - 1]).toBe(24);
    // strictly increasing subsequence of the input
    for (let i = 1; i < picked.length; i++) {
      expect(picked[i]).toBeGreaterThan(picked[i - 1]);
    }
  });

  it('returns everything when k >= length', () => {
    expect(sampleSpread([1, 2, 3], 10)).toEqual([1, 2, 3]);
  });
});

describe('curtainSteps', () => {
  const pts = samplePath();
  const steps = curtainSteps(pts);

  it('produces parallels below the main line', () => {
    expect(steps.length).toBeGreaterThan(50);
    for (const { dy, runs } of steps) {
      expect(dy).toBeGreaterThan(0);
      for (const run of runs) {
        expect(run.length).toBeGreaterThan(1);
        for (const p of run) {
          expect(p.y).toBeGreaterThan(PATH_TOP_Y);
        }
      }
    }
  });

  it('never draws overlapping strokes from different parallels at the same x', () => {
    // the user-visible guarantee of occlusion culling: strokes share exact
    // sample x-coordinates (offsets are purely vertical), and at any such x
    // strokes from different parallels keep vertical separation (no
    // crosshatch). Binning by rounded x would falsely flag side-by-side
    // strokes on near-vertical sections, so group by exact x.
    const byX = new Map<number, { y: number; step: number }[]>();
    steps.forEach(({ runs }, si) => {
      for (const run of runs) {
        for (const p of run) {
          if (!byX.has(p.x)) byX.set(p.x, []);
          byX.get(p.x)!.push({ y: p.y, step: si });
        }
      }
    });
    for (const entries of byX.values()) {
      entries.sort((a, b) => a.y - b.y);
      for (let i = 1; i < entries.length; i++) {
        if (entries[i].step !== entries[i - 1].step) {
          expect(entries[i].y - entries[i - 1].y).toBeGreaterThan(2);
        }
      }
    }
  });
});

describe('mainPathD', () => {
  it('starts at the top-right entry point', () => {
    expect(mainPathD()).toMatch(/^M 400 90 /);
  });
});
