import { useState, useEffect, useCallback } from 'react';
import { fetchCityContext } from '../services/api';
import type { ContextBudgetCategory, CityContextData } from '../services/api';

export type { ContextBudgetCategory };

export interface BudgetNode {
  code: string;
  name: string;
  amount: number;
  children?: BudgetNode[];
}

function buildTree(categories: ContextBudgetCategory[]): BudgetNode | null {
  if (categories.length === 0) return null;

  // Sort by code so parents always come before children
  const sorted = [...categories].sort((a, b) => a.code.localeCompare(b.code));

  // Build a map for quick lookup
  const nodeMap = new Map<string, BudgetNode>();
  for (const cat of sorted) {
    nodeMap.set(cat.code, { code: cat.code, name: cat.name, amount: cat.amount });
  }

  const roots: BudgetNode[] = [];

  for (const node of nodeMap.values()) {
    // Find parent: longest prefix code of length (node.code.length - 1) that exists in the map
    let placed = false;
    for (let parentLen = node.code.length - 1; parentLen >= 1; parentLen--) {
      const parentCode = node.code.slice(0, parentLen);
      const parent = nodeMap.get(parentCode);
      if (parent) {
        if (!parent.children) parent.children = [];
        parent.children.push(node);
        placed = true;
        break;
      }
    }
    if (!placed) {
      roots.push(node);
    }
  }

  if (roots.length === 0) return null;
  if (roots.length === 1) return roots[0];

  // Wrap multiple roots in a synthetic root
  const total = roots.reduce((sum, r) => sum + r.amount, 0);
  return { code: 'root', name: 'Total', amount: total, children: roots };
}

export function useCityBudgets(cityId: number | null): {
  budgetYear: number | null;
  budgetType: 'planned' | 'executed';
  setBudgetType: (t: 'planned' | 'executed') => void;
  categories: ContextBudgetCategory[];
  buildBudgetTree: () => BudgetNode | null;
  loading: boolean;
  error: string | null;
} {
  const [ctx, setCtx] = useState<CityContextData | null>(null);
  const [budgetType, setBudgetType] = useState<'planned' | 'executed'>('planned');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cityId === null) {
      setCtx(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchCityContext(cityId)
      .then(data => {
        if (cancelled) return;
        setCtx(data);
        setLoading(false);
      })
      .catch(err => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to fetch city budgets');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [cityId]);

  const categories: ContextBudgetCategory[] =
    (ctx?.budget_categories?.[budgetType] ?? []);

  const budgetYear = ctx?.budget_year ?? null;

  const buildBudgetTree = useCallback((): BudgetNode | null => {
    return buildTree(categories);
  }, [categories]);

  return {
    budgetYear,
    budgetType,
    setBudgetType,
    categories,
    buildBudgetTree,
    loading,
    error,
  };
}
