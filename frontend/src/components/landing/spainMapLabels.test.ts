import { describe, it, expect } from 'vitest';
import {
  computeLabelCandidates,
  rectsOverlap,
  type LabelCandidate,
  type LabelRect,
} from './spainMapLabels';

describe('computeLabelCandidates', () => {
  it('returns four candidates in order: below, above, right, left', () => {
    const candidates = computeLabelCandidates(100, 100, 14, 12, 60);
    expect(candidates).toHaveLength(4);
    expect(candidates[0].position).toBe('below');
    expect(candidates[1].position).toBe('above');
    expect(candidates[2].position).toBe('right');
    expect(candidates[3].position).toBe('left');
  });

  it('below candidate rect top edge is below pin bottom edge', () => {
    const pinH = 12;
    const [below] = computeLabelCandidates(100, 100, 14, pinH, 60);
    expect(below.rect.y).toBeGreaterThan(100 + pinH / 2);
  });

  it('above candidate rect bottom edge is above pin top edge', () => {
    const pinH = 12;
    const candidates = computeLabelCandidates(100, 100, 14, pinH, 60);
    const above = candidates[1];
    expect(above.rect.y + above.rect.height).toBeLessThan(100 - pinH / 2);
  });

  it('right candidate rect left edge is right of pin right edge', () => {
    const pinW = 14;
    const candidates = computeLabelCandidates(100, 100, pinW, 12, 60);
    const right = candidates[2];
    expect(right.rect.x).toBeGreaterThan(100 + pinW / 2);
  });

  it('left candidate rect right edge is left of pin left edge', () => {
    const pinW = 14;
    const candidates = computeLabelCandidates(100, 100, pinW, 12, 60);
    const left = candidates[3];
    expect(left.rect.x + left.rect.width).toBeLessThan(100 - pinW / 2);
  });

  it('all rects have the given textWidth as width', () => {
    const textWidth = 72;
    const candidates = computeLabelCandidates(100, 100, 14, 12, textWidth);
    candidates.forEach(c => expect(c.rect.width).toBe(textWidth));
  });
});

describe('rectsOverlap', () => {
  it('returns true for clearly overlapping rects', () => {
    const a: LabelRect = { x: 0, y: 0, width: 50, height: 14 };
    const b: LabelRect = { x: 20, y: 0, width: 50, height: 14 };
    expect(rectsOverlap(a, b)).toBe(true);
  });

  it('returns false for clearly separated rects', () => {
    const a: LabelRect = { x: 0, y: 0, width: 50, height: 14 };
    const b: LabelRect = { x: 100, y: 0, width: 50, height: 14 };
    expect(rectsOverlap(a, b)).toBe(false);
  });

  it('returns false for rects that touch but do not overlap', () => {
    const a: LabelRect = { x: 0, y: 0, width: 50, height: 14 };
    const b: LabelRect = { x: 50, y: 0, width: 50, height: 14 };
    expect(rectsOverlap(a, b)).toBe(false);
  });

  it('returns false for vertically separated rects', () => {
    const a: LabelRect = { x: 0, y: 0, width: 50, height: 14 };
    const b: LabelRect = { x: 0, y: 20, width: 50, height: 14 };
    expect(rectsOverlap(a, b)).toBe(false);
  });
});
