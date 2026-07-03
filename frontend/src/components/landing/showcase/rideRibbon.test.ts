import { describe, it, expect } from 'vitest';
import {
  PATH_TOP_Y,
  PATH_BOTTOM_Y,
  GRADIENT_Y0,
  GRADIENT_Y1,
  PALETTE,
  samplePath,
  curtainSteps,
  pointAtY,
  yForScore,
  sampleSpread,
  mainPathD,
  colorAtY,
  resolveLabelPositions,
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

function hex(rgb: string): [number, number, number] {
  const m = rgb.match(/\d+/g)!.map(Number);
  return [m[0], m[1], m[2]];
}

describe('colorAtY', () => {
  it('matches the palette ends at the gradient extremes', () => {
    const first = PALETTE[0][1];
    const last = PALETTE[PALETTE.length - 1][1];
    expect(colorAtY(GRADIENT_Y0)).toBe(
      `rgb(${parseInt(first.slice(1, 3), 16)}, ${parseInt(first.slice(3, 5), 16)}, ${parseInt(first.slice(5, 7), 16)})`,
    );
    expect(colorAtY(GRADIENT_Y1)).toBe(
      `rgb(${parseInt(last.slice(1, 3), 16)}, ${parseInt(last.slice(3, 5), 16)}, ${parseInt(last.slice(5, 7), 16)})`,
    );
  });

  it('clamps beyond the gradient range to the end colors', () => {
    expect(colorAtY(-500)).toBe(colorAtY(GRADIENT_Y0));
    expect(colorAtY(5000)).toBe(colorAtY(GRADIENT_Y1));
  });

  it('interpolates smoothly (no repeated identical colors across a wide sweep)', () => {
    const samples = Array.from({ length: 20 }, (_, i) =>
      hex(colorAtY(GRADIENT_Y0 + (i * (GRADIENT_Y1 - GRADIENT_Y0)) / 19)),
    );
    const distinct = new Set(samples.map(c => c.join(','))).size;
    expect(distinct).toBeGreaterThan(15);
  });
});

describe('resolveLabelPositions', () => {
  it('keeps well-spaced natural positions unchanged', () => {
    const natural = [100, 300, 500];
    expect(resolveLabelPositions(natural, 30, 0, 900)).toEqual(natural);
  });

  it('pushes down clustered labels to respect the minimum gap', () => {
    const resolved = resolveLabelPositions([100, 110, 115], 30, 0, 900);
    for (let i = 1; i < resolved.length; i++) {
      expect(resolved[i] - resolved[i - 1]).toBeGreaterThanOrEqual(30 - 1e-9);
    }
  });

  it('clamps within bounds and keeps output ordered when packed at the max', () => {
    const resolved = resolveLabelPositions([780, 790, 800, 810], 30, 0, 800);
    expect(resolved[resolved.length - 1]).toBeLessThanOrEqual(800);
    for (let i = 1; i < resolved.length; i++) {
      expect(resolved[i]).toBeGreaterThan(resolved[i - 1]);
    }
  });
});
