// frontend/src/components/city/plots/ElectoralSemicircle.test.ts
import { describe, it, expect } from 'vitest';
import { buildSemicircleLayout, seatRows } from './ElectoralSemicircle';
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

  // Madrid 2023: 57 councilors
  const MADRID: PartyAllocation[] = [
    { party: 'PP',    councilors: 29, votes: 694861 },
    { party: 'MM-VQ', councilors: 12, votes: 285411 },
    { party: 'PSOE',  councilors: 11, votes: 265362 },
    { party: 'VOX',   councilors: 5,  votes: 113426 },
  ];

  // Round to 3 decimals: row radii like 67.5 carry ±1e-12 float jitter
  const distinctRadii = (dots: ReturnType<typeof buildSemicircleLayout>): number[] =>
    [...new Set(dots.map(d =>
      Math.round(Math.sqrt((d.x - CX) ** 2 + (d.y - CY) ** 2) * 1000) / 1000,
    ))].sort((a, b) => a - b);

  it('never uses fewer than 4 rows', () => {
    const dots = buildSemicircleLayout(ALLOCATIONS, CX, CY, R_INNER, R_OUTER); // 29 seats
    expect(distinctRadii(dots).length).toBeGreaterThanOrEqual(4);
  });

  it('row count scales with total seats (seatRows)', () => {
    expect(seatRows(29)).toBe(4);
    expect(seatRows(57)).toBe(5);
    expect(seatRows(120)).toBe(6); // capped
  });

  it('uses seatRows(total) rows for a real 57-seat council', () => {
    const dots = buildSemicircleLayout(MADRID, CX, CY, R_INNER, R_OUTER);
    expect(dots).toHaveLength(57);
    expect(distinctRadii(dots).length).toBe(seatRows(57));
  });

  it('outer rows hold at least as many seats as inner rows', () => {
    const dots = buildSemicircleLayout(MADRID, CX, CY, R_INNER, R_OUTER);
    const radii = distinctRadii(dots);
    const counts = radii.map(r =>
      dots.filter(d =>
        Math.round(Math.sqrt((d.x - CX) ** 2 + (d.y - CY) ** 2) * 1000) / 1000 === r,
      ).length,
    );
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i]).toBeGreaterThanOrEqual(counts[i - 1]);
    }
  });

  it('seats parties left → right by ideology regardless of input order', () => {
    const dots = buildSemicircleLayout(MADRID, CX, CY, R_INNER, R_OUTER);
    // MM-VQ (left) fills the left end of the arc, VOX (right) the right end
    expect(dots[0].party).toBe('MM-VQ');
    expect(dots[dots.length - 1].party).toBe('VOX');
    // Left half average x < right half average x for the extreme parties
    const avgX = (party: string) => {
      const xs = dots.filter(d => d.party === party).map(d => d.x);
      return xs.reduce((a, b) => a + b, 0) / xs.length;
    };
    expect(avgX('MM-VQ')).toBeLessThan(avgX('PSOE'));
    expect(avgX('PP')).toBeLessThan(avgX('VOX'));
  });

  it('assigns councilor names to seats in candidate-list order', () => {
    const withNames: PartyAllocation[] = [
      { party: 'PP',    councilors: 2, votes: null, names: ['Alcalde Uno', 'Concejal Dos'] },
      { party: 'PSOE',  councilors: 1, votes: null, names: ['Edil Tres'] },
    ];
    const dots = buildSemicircleLayout(withNames, CX, CY, R_INNER, R_OUTER);
    const ppNames = dots.filter(d => d.party === 'PP').map(d => d.name);
    expect(ppNames).toEqual(['Alcalde Uno', 'Concejal Dos']);
    expect(dots.find(d => d.party === 'PSOE')?.name).toBe('Edil Tres');
  });

  it('leaves name null when no councilor list is provided', () => {
    const dots = buildSemicircleLayout(ALLOCATIONS, CX, CY, R_INNER, R_OUTER);
    expect(dots.every(d => d.name === null)).toBe(true);
  });

  // Geometry rules ported from d3-parliament-chart (dkaoster), single section:
  // each row's arc is inset by atan(seatRadius / rowRadius) at both ends so
  // seats never poke past the horizontal baseline edges.
  it('insets row ends by the seat radius (d3-parliament-chart rule)', () => {
    const seatRadius = 10;
    const dots = buildSemicircleLayout(MADRID, CX, CY, R_INNER, R_OUTER, seatRadius);
    for (const dot of dots) {
      const r = Math.sqrt((dot.x - CX) ** 2 + (dot.y - CY) ** 2);
      const gap = Math.atan(seatRadius / r);
      const theta = Math.atan2(CY - dot.y, dot.x - CX);
      expect(theta).toBeGreaterThanOrEqual(gap - 1e-9);
      expect(theta).toBeLessThanOrEqual(Math.PI - gap + 1e-9);
    }
  });

  it('keeps full-arc behaviour when seatRadius is omitted', () => {
    const dots = buildSemicircleLayout(MADRID, CX, CY, R_INNER, R_OUTER);
    const thetas = dots.map(d => Math.atan2(CY - d.y, d.x - CX));
    expect(Math.min(...thetas)).toBeCloseTo(0, 6);
    expect(Math.max(...thetas)).toBeCloseTo(Math.PI, 6);
  });
});
