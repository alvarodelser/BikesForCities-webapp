import type { BudgetYear } from '../services/api';
// TODO: move BudgetNode to a shared types file (currently defined in BudgetSunburst.tsx)
import type { BudgetNode } from '../components/city/plots/BudgetSunburst';

export function buildSunburstTree(
  budgetYears: BudgetYear[],
  selectedYear: number,
  budgetType: 'planned' | 'executed',
): BudgetNode {
  const yearData = budgetYears.find(y => y.year === selectedYear);
  if (!yearData || yearData.lines.length === 0) {
    return { code: 'root', name: 'Presupuesto', amount: 0, children: [] };
  }

  const lines = yearData.lines.filter(l => l.budget_type === budgetType);
  if (lines.length === 0) {
    return { code: 'root', name: 'Presupuesto', amount: 0, children: [] };
  }

  const codeMap = new Map(lines.map(l => [l.category_code, { name: l.category_name ?? l.category_code, amount: l.amount }]));
  const allCodes = [...codeMap.keys()].sort();

  // For each code, find the closest ancestor: longest code in the set that is a proper prefix
  function findParent(code: string): string | null {
    let best: string | null = null;
    for (const c of allCodes) {
      if (c.length < code.length && code.startsWith(c)) {
        if (best === null || c.length > best.length) best = c;
      }
    }
    return best;
  }

  // Group direct children by parent code (null = top-level)
  const childrenOf = new Map<string | null, string[]>();
  for (const code of allCodes) {
    const parent = findParent(code);
    if (!childrenOf.has(parent)) childrenOf.set(parent, []);
    childrenOf.get(parent)!.push(code);
  }

  function buildNode(code: string): BudgetNode {
    const info = codeMap.get(code)!;
    const kids = childrenOf.get(code) ?? [];
    if (kids.length === 0) {
      return { code, name: info.name, amount: info.amount };
    }
    const childNodes = kids.map(buildNode);
    // If parent has an amount larger than the sum of its direct children's amounts,
    // the difference is budget that stays at this level without further breakdown.
    // Represent it as a synthetic "Sin desglosar" leaf so no euros disappear.
    const directChildTotal = kids.reduce((s, k) => s + (codeMap.get(k)?.amount ?? 0), 0);
    const remainder = info.amount - directChildTotal;
    if (remainder > 1) {
      childNodes.push({ code: `${code}__rest`, name: 'Sin desglosar', amount: remainder });
    }
    return { code, name: info.name, amount: 0, children: childNodes };
  }

  const topCodes = childrenOf.get(null) ?? [];
  return { code: 'root', name: 'Presupuesto', amount: 0, children: topCodes.map(buildNode) };
}

export function resolveBudgetType(
  yearData: BudgetYear | null | undefined,
): 'executed' | 'planned' {
  if (!yearData) return 'planned';
  return yearData.lines.some(l => l.budget_type === 'executed') ? 'executed' : 'planned';
}

export function buildCategoryOptions(
  budgetYears: BudgetYear[],
): { code: string; name: string }[] {
  const names = new Map<string, string>();
  for (const year of budgetYears) {
    for (const line of year.lines) {
      const existing = names.get(line.category_code);
      if (existing === undefined) {
        names.set(line.category_code, line.category_name ?? line.category_code);
      } else if (existing === line.category_code && line.category_name) {
        // upgrade a code-only placeholder once a real name appears
        names.set(line.category_code, line.category_name);
      }
    }
  }
  return [...names.entries()]
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.code.localeCompare(b.code));
}

export function buildCategorySeries(
  budgetYears: BudgetYear[],
  codes: string[],
): Array<Record<string, number>> {
  const sortedYears = [...budgetYears].sort((a, b) => a.year - b.year);
  return sortedYears.map(year => {
    const type = resolveBudgetType(year);
    const row: Record<string, number> = { year: year.year };
    for (const code of codes) {
      const line = year.lines.find(l => l.category_code === code && l.budget_type === type);
      if (line) row[code] = line.amount;
    }
    return row;
  });
}

/** The most recent year that has BOTH planned and executed lines with at least
 *  one meaningful difference — i.e. a real planned-vs-executed comparison. */
export function latestYearWithBoth(budgetYears: BudgetYear[]): BudgetYear | null {
  const withBoth = budgetYears.filter(y => {
    const planned = y.lines.filter(l => l.budget_type === 'planned');
    const executed = y.lines.filter(l => l.budget_type === 'executed');
    if (planned.length === 0 || executed.length === 0) return false;
    const executedMap = new Map(executed.map(l => [l.category_code, l.amount]));
    return planned.some(l => executedMap.get(l.category_code) !== l.amount);
  });
  if (withBoth.length === 0) return null;
  return withBoth.reduce((a, b) => (b.year > a.year ? b : a));
}
