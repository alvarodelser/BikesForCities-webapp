import { describe, it, expect } from 'vitest';
import { buildSunburstTree } from './budget';
import type { BudgetYear } from '../services/api';

const sampleYear: BudgetYear = {
  year: 2023,
  total_income: 500_000,
  total_expenses: 480_000,
  public_debt: 120_000,
  lines: [
    { category_code: '1',   category_name: 'Personal',     amount: 200_000, budget_type: 'planned' },
    { category_code: '1a',  category_name: 'Fijo',         amount: 150_000, budget_type: 'planned' },
    { category_code: '1b',  category_name: 'Temporal',     amount: 50_000,  budget_type: 'planned' },
    { category_code: '2',   category_name: 'Inversiones',  amount: 80_000,  budget_type: 'planned' },
    { category_code: '1',   category_name: 'Personal',     amount: 210_000, budget_type: 'executed' },
    { category_code: '1a',  category_name: 'Fijo',         amount: 160_000, budget_type: 'executed' },
    { category_code: '1b',  category_name: 'Temporal',     amount: 50_000,  budget_type: 'executed' },
    { category_code: '2',   category_name: 'Inversiones',  amount: 70_000,  budget_type: 'executed' },
  ],
};

describe('buildSunburstTree', () => {
  it('returns root node with children', () => {
    const tree = buildSunburstTree([sampleYear], 2023, 'planned');
    expect(tree.code).toBe('root');
    expect(tree.children).toHaveLength(2);
  });

  it('filters by budget type', () => {
    const planned = buildSunburstTree([sampleYear], 2023, 'planned');
    const executed = buildSunburstTree([sampleYear], 2023, 'executed');
    expect(planned.children).toHaveLength(2);
    expect(executed.children).toHaveLength(2);
  });

  it('returns empty tree when requested budgetType has no lines', () => {
    const onlyPlanned: BudgetYear = {
      ...sampleYear,
      lines: sampleYear.lines.filter(l => l.budget_type === 'planned'),
    };
    const tree = buildSunburstTree([onlyPlanned], 2023, 'executed');
    expect(tree.children).toHaveLength(0);
  });

  it('nests children under top-level codes', () => {
    const tree = buildSunburstTree([sampleYear], 2023, 'planned');
    const personal = tree.children!.find(c => c.code === '1');
    expect(personal).toBeDefined();
    expect(personal!.children).toHaveLength(2);
    expect(personal!.children!.map(c => c.code)).toContain('1a');
    expect(personal!.children!.map(c => c.code)).toContain('1b');
  });

  it('returns empty tree for missing year', () => {
    const tree = buildSunburstTree([sampleYear], 9999, 'planned');
    expect(tree.children).toHaveLength(0);
  });

  it('leaf nodes carry their amount', () => {
    const tree = buildSunburstTree([sampleYear], 2023, 'planned');
    const personal = tree.children!.find(c => c.code === '1')!;
    const fijo = personal.children!.find(c => c.code === '1a')!;
    expect(fijo.amount).toBe(150_000);
  });
});
