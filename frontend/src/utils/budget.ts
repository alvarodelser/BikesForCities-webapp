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

  const minLen = Math.min(...lines.map(l => l.category_code.length));
  const topLines = lines.filter(l => l.category_code.length === minLen);
  const subLines = lines.filter(l => l.category_code.length > minLen);

  const topCodes = topLines.map(t => t.category_code);

  const children: BudgetNode[] = topLines.map(topLine => {
    const topCode = topLine.category_code;
    const subs = subLines.filter(l => {
      const longestMatch = topCodes
        .filter(tc => l.category_code.startsWith(tc))
        .reduce((a, b) => (a.length >= b.length ? a : b), '');
      return longestMatch === topCode;
    });

    if (subs.length === 0) {
      return { code: topCode, name: topLine.category_name ?? topCode, amount: topLine.amount };
    }

    return {
      code: topCode,
      name: topLine.category_name ?? topCode,
      amount: 0,
      children: subs.map(s => ({
        code: s.category_code,
        name: s.category_name ?? s.category_code,
        amount: s.amount,
      })),
    };
  });

  return { code: 'root', name: 'Presupuesto', amount: 0, children };
}
