// frontend/src/components/city/plots/ElectoralSemicircle.test.ts
import { describe, it, expect } from 'vitest';
import { buildSemicircleLayout } from './ElectoralSemicircle';
import type { PartyAllocation } from './ElectoralSemicircle';

const ALLOCATIONS: PartyAllocation[] = [
  { party: 'PP',   councilors: 11, votes: 50000 },
  { party: 'PSOE', councilors: 9,  votes: 40000 },
  { party: 'Vox',  councilors: 5,  votes: 20000 },
  { party: 'MM',   councilors: 4,  votes: 18000 },
];

const CX = 150, CY = 90, R_INNER = 60, R_OUTER = 90;

describe('buildSemicircleLayout', () => {
  it('returns one dot per councilor', () => {
    const dots = buildSemicircleLayout(ALLOCATIONS, CX, CY, R_INNER, R_OUTER);
    expect(dots).toHaveLength(29); // 11+9+5+4
  });

  it('returns empty array for zero seats', () => {
    const dots = buildSemicircleLayout([], CX, CY, R_INNER, R_OUTER);
    expect(dots).toHaveLength(0);
  });

  it('assigns correct party to each dot (parties are contiguous)', () => {
    const dots = buildSemicircleLayout(ALLOCATIONS, CX, CY, R_INNER, R_OUTER);
    const ppDots = dots.filter(d => d.party === 'PP');
    const psoeDots = dots.filter(d => d.party === 'PSOE');
    expect(ppDots).toHaveLength(11);
    expect(psoeDots).toHaveLength(9);
  });

  it('all dots lie within the expected radius band', () => {
    const dots = buildSemicircleLayout(ALLOCATIONS, CX, CY, R_INNER, R_OUTER);
    for (const dot of dots) {
      const r = Math.sqrt((dot.x - CX) ** 2 + (dot.y - CY) ** 2);
      expect(r).toBeGreaterThanOrEqual(R_INNER - 1);
      expect(r).toBeLessThanOrEqual(R_OUTER + 1);
    }
  });

  it('all dots have y <= CY (arc stays above the baseline)', () => {
    const dots = buildSemicircleLayout(ALLOCATIONS, CX, CY, R_INNER, R_OUTER);
    for (const dot of dots) {
      expect(dot.y).toBeLessThanOrEqual(CY + 0.001);
    }
  });

  it('assigns a color string to every dot', () => {
    const dots = buildSemicircleLayout(ALLOCATIONS, CX, CY, R_INNER, R_OUTER);
    for (const dot of dots) {
      expect(dot.color).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('works with a single party', () => {
    const single: PartyAllocation[] = [{ party: 'PP', councilors: 5, votes: null }];
    const dots = buildSemicircleLayout(single, CX, CY, R_INNER, R_OUTER);
    expect(dots).toHaveLength(5);
    expect(dots.every(d => d.party === 'PP')).toBe(true);
  });
});
