import { describe, it, expect } from 'vitest';
import { buildDeltaData } from './BudgetDeltaChart';
import type { BudgetYear } from '../../../services/api';

const sampleYear: BudgetYear = {
  year: 2023,
  total_income: 500_000,
  total_expenses: 480_000,
  public_debt: 120_000,
  lines: [
    { category_code: '1', category_name: 'Personal',    amount: 200_000, budget_type: 'planned' },
    { category_code: '2', category_name: 'Inversiones', amount: 80_000,  budget_type: 'planned' },
    { category_code: '1', category_name: 'Personal',    amount: 220_000, budget_type: 'executed' },
    { category_code: '2', category_name: 'Inversiones', amount: 60_000,  budget_type: 'executed' },
  ],
};

describe('buildDeltaData', () => {
  it('computes delta = executed - planned per category', () => {
    const data = buildDeltaData(sampleYear);
    const personal = data.find(d => d.code === '1');
    const inversiones = data.find(d => d.code === '2');
    expect(personal?.delta).toBe(20_000);   // 220k - 200k
    expect(inversiones?.delta).toBe(-20_000); // 60k - 80k
  });

  it('returns empty array when both planned and executed are missing', () => {
    const emptyYear: BudgetYear = { ...sampleYear, lines: [] };
    expect(buildDeltaData(emptyYear)).toHaveLength(0);
  });

  it('includes deltaPct', () => {
    const data = buildDeltaData(sampleYear);
    const personal = data.find(d => d.code === '1')!;
    expect(personal.deltaPct).toBeCloseTo(10); // 20k / 200k = 10%
  });

  it('sorts by absolute delta descending', () => {
    const data = buildDeltaData(sampleYear);
    expect(Math.abs(data[0].delta)).toBeGreaterThanOrEqual(Math.abs(data[1].delta));
  });

  it('returns empty array when only one budget type is present', () => {
    const onlyPlanned: BudgetYear = {
      ...sampleYear,
      lines: sampleYear.lines.filter(l => l.budget_type === 'planned'),
    };
    expect(buildDeltaData(onlyPlanned)).toHaveLength(0);
  });

  it('sets deltaPct to null when planned amount is zero for a category', () => {
    const mixedYear: BudgetYear = {
      ...sampleYear,
      lines: [
        ...sampleYear.lines,
        { category_code: '3', category_name: 'Extra', amount: 50_000, budget_type: 'executed' },
        // No planned entry for code '3'
      ],
    };
    const data = buildDeltaData(mixedYear);
    const extra = data.find(d => d.code === '3');
    expect(extra?.deltaPct).toBeNull();
  });
});
