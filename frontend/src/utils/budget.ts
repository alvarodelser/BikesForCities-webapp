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
