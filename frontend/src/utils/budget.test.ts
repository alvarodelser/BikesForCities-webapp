import { describe, it, expect } from 'vitest';
import { buildSunburstTree, resolveBudgetType, buildCategoryOptions, buildCategorySeries, latestYearWithBoth } from './budget';
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

// ── New helpers ───────────────────────────────────────────────────────────────

const year2022: BudgetYear = {
  year: 2022,
  total_income: null, total_expenses: null, public_debt: null,
  lines: [
    { category_code: '133', category_name: 'Tráfico',   amount: 100, budget_type: 'planned' },
    { category_code: '133', category_name: 'Tráfico',   amount: 90,  budget_type: 'executed' },
    { category_code: '44',  category_name: 'Transporte', amount: 200, budget_type: 'planned' },
    { category_code: '44',  category_name: 'Transporte', amount: 180, budget_type: 'executed' },
  ],
};

// Latest year: only planned available (e.g. budget approved, not yet executed)
const year2023: BudgetYear = {
  year: 2023,
  total_income: null, total_expenses: null, public_debt: null,
  lines: [
    { category_code: '133', category_name: 'Tráfico', amount: 110, budget_type: 'planned' },
    // note: no '44' line this year, and no executed lines at all
  ],
};

describe('resolveBudgetType', () => {
  it('prefers executed when present', () => {
    expect(resolveBudgetType(year2022)).toBe('executed');
  });
  it('falls back to planned when no executed lines', () => {
    expect(resolveBudgetType(year2023)).toBe('planned');
  });
  it('returns planned for empty or missing year', () => {
    expect(resolveBudgetType({ ...year2022, lines: [] })).toBe('planned');
    expect(resolveBudgetType(null)).toBe('planned');
  });
});

describe('buildCategoryOptions', () => {
  it('returns the deduped union of codes across years, sorted by code', () => {
    const opts = buildCategoryOptions([year2023, year2022]);
    expect(opts).toEqual([
      { code: '133', name: 'Tráfico' },
      { code: '44',  name: 'Transporte' },
    ]);
  });
  it('falls back to the code when no name is available', () => {
    const noName: BudgetYear = {
      ...year2022,
      lines: [{ category_code: '99', category_name: null, amount: 1, budget_type: 'planned' }],
    };
    expect(buildCategoryOptions([noName])).toEqual([{ code: '99', name: '99' }]);
  });
});

describe('buildCategorySeries', () => {
  it('uses the resolved type per year and orders years ascending', () => {
    const rows = buildCategorySeries([year2023, year2022], ['133', '44']);
    expect(rows).toEqual([
      { year: 2022, '133': 90, '44': 180 }, // 2022 resolves to executed
      { year: 2023, '133': 110 },           // 2023 resolves to planned; '44' absent → gap
    ]);
  });
  it('returns rows with only the year when no codes are requested', () => {
    expect(buildCategorySeries([year2022], [])).toEqual([{ year: 2022 }]);
  });
});

describe('latestYearWithBoth', () => {
  it('returns the latest year that has both planned and executed lines', () => {
    // year2022 has both; year2023 has only planned → 2022 is the latest "complete" year
    expect(latestYearWithBoth([year2023, year2022])?.year).toBe(2022);
  });
  it('returns null when no year has both budget types', () => {
    expect(latestYearWithBoth([year2023])).toBeNull();
  });
  it('returns null for an empty list', () => {
    expect(latestYearWithBoth([])).toBeNull();
  });
});
