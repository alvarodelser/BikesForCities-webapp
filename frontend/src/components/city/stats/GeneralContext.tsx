import React from 'react';
import { useMayorHistory } from '../../../hooks/useMayorHistory';
import { useCityBudgets } from '../../../hooks/useCityBudgets';
import { PARTY_COLORS } from '../../../constants/parties';
import { MayorsGanttChart } from '../plots/MayorsGanttChart';
import { BudgetSunburst } from '../plots/BudgetSunburst';

export interface GeneralContextProps {
  cityId: number;
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function Skeleton({ height }: { height: number }) {
  return (
    <div
      className="w-full rounded-xl bg-stone-200 animate-pulse"
      style={{ height }}
    />
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const GeneralContext: React.FC<GeneralContextProps> = ({ cityId }) => {
  const { terms, loading: mayorsLoading } = useMayorHistory(cityId);
  const {
    budgetYear,
    budgetType,
    setBudgetType,
    buildBudgetTree,
    loading: budgetsLoading,
  } = useCityBudgets(cityId);

  const budgetTree = budgetsLoading ? null : buildBudgetTree();

  return (
    <div className="w-full flex flex-col gap-6 bg-stone-100 rounded-2xl p-5">

      {/* Section heading */}
      <h2 className="text-xl font-bold text-stone-800">
        Contexto político y presupuestario
      </h2>

      {/* Mayors Gantt chart */}
      <div className="w-full">
        {mayorsLoading ? (
          <Skeleton height={120} />
        ) : terms.length === 0 ? (
          <p className="text-sm text-stone-400">Sin datos de alcaldes disponibles</p>
        ) : (
          <MayorsGanttChart
            terms={terms}
            partyColors={PARTY_COLORS}
          />
        )}
      </div>

      {/* Budget sunburst */}
      <div className="w-full">
        {budgetsLoading ? (
          <Skeleton height={440} />
        ) : budgetTree === null ? (
          <p className="text-sm text-stone-400">Sin datos presupuestarios disponibles</p>
        ) : (
          <BudgetSunburst
            data={budgetTree}
            year={budgetYear ?? new Date().getFullYear()}
            budgetType={budgetType}
            onBudgetTypeChange={setBudgetType}
          />
        )}
      </div>
    </div>
  );
};

export default GeneralContext;
