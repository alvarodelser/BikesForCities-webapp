import React, { useMemo } from 'react';
import { TrendUp, CurrencyEur, Bank, ChartBar } from '@phosphor-icons/react';
import PeriodRangeTimeline, { fillSequential } from '../PeriodRangeTimeline';
import { BudgetDeltaChart } from '../../../plots/BudgetDeltaChart';
import { MayorsGanttChart } from '../../../plots/MayorsGanttChart';
import { ElectoralSemicircle } from '../../../plots/ElectoralSemicircle';
import type { BudgetYear, MayorTerm, ElectionResult } from '../../../../../services/api';
import type { CityData } from '../../../../../constants/cities';
import { formatCurrency } from '../../../../../utils/formatters';

interface TransparencyStatsProps {
  city: CityData;

  budgetYears: BudgetYear[];
  selectedYear: number;
  onYearChange: (year: number) => void;
  budgetType: 'planned' | 'executed';
  onBudgetTypeChange: (t: 'planned' | 'executed') => void;
  mayors: MayorTerm[];
  elections: ElectionResult[];
}

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: string;
}

function MetricCard({ icon, label, value, accent = '#3A6C7F' }: MetricCardProps) {
  return (
    <div
      className="rounded-2xl border bg-white/80 backdrop-blur-sm p-4 flex items-center gap-3"
      style={{ borderColor: 'rgba(0,0,0,0.08)', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{
          background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
          boxShadow: `0 4px 12px ${accent}55`,
        }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">
          {label}
        </div>
        <div className="text-sm font-bold text-gray-800 leading-tight truncate">
          {value}
        </div>
      </div>
    </div>
  );
}

const ACCENT = '#3A6C7F';

export default function TransparencyStats({
  city,
  budgetYears,
  selectedYear,
  onYearChange,
  budgetType,
  onBudgetTypeChange,
  mayors,
  elections,
}: TransparencyStatsProps) {
  const submodes = (city.available_modes?.transparency_submodes as string[] | undefined) ?? [];
  const allEnabled = submodes.length === 0;
  const hasBudget    = allEnabled || submodes.includes('budget');
  const hasMayors    = allEnabled || submodes.includes('mayors');
  const hasElections = (allEnabled || submodes.includes('electoral')) && elections.length > 0;

  const { items: yearItems, disabled: disabledYears } = useMemo(
    () => fillSequential(
      [...new Set(budgetYears.map(by => by.year))]
        .sort((a, b) => a - b)
        .map(String)
    ),
    [budgetYears],
  );

  const yearData = useMemo(
    () => budgetYears.find(by => by.year === selectedYear) ?? null,
    [budgetYears, selectedYear],
  );

  const democraticMayors = useMemo(() => {
    const today = new Date();
    return mayors.filter(m => {
      if (!m.start_date) return false;
      const start = new Date(m.start_date);
      return start.getFullYear() >= 1975 && start <= today;
    });
  }, [mayors]);

  const handleChange = (from: string, to: string) => {
    // Clicking left moves 'from'; clicking right moves 'to'. Use whichever changed.
    const newYear = from !== selectedYearStr ? from : to;
    onYearChange(Number(newYear));
  };

  const selectedYearStr = String(selectedYear);

  return (
    <div className="flex flex-col gap-4">
      {hasBudget && (
        <>
          {/* ── Year selector + budget type card (side by side) ─────────── */}
          <div className="flex items-stretch gap-4">
            <div className="w-2/3 min-w-0">
              {yearItems.length > 1 ? (
                <PeriodRangeTimeline
                  items={yearItems}
                  disabledItems={disabledYears}
                  from={selectedYearStr}
                  to={selectedYearStr}
                  onChange={handleChange}
                  accent={ACCENT}
                  unit="año"
                />
              ) : yearItems.length === 1 ? (
                <p className="text-sm font-bold opacity-70" style={{ color: ACCENT }}>{yearItems[0]}</p>
              ) : null}
            </div>

            {/* ── Budget type card ──────────────────────────────────────── */}
            <div
              className="rounded-2xl border bg-white/80 backdrop-blur-sm overflow-hidden w-1/3"
              style={{ borderColor: 'rgba(0,0,0,0.08)', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}
            >
              <div className="flex items-center gap-3 px-4 pt-4 pb-2">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT}cc)`, boxShadow: `0 4px 12px ${ACCENT}55` }}
                >
                  <ChartBar size={16} color="white" weight="bold" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-bold text-[var(--blue-dark)]">Tipo de presupuesto</h3>
                  <p className="text-[10px] text-[var(--blue)] opacity-70 leading-snug">Alterna entre el presupuesto aprobado y el gasto realmente ejecutado.</p>
                </div>
              </div>
              <div className="px-4 pb-4 flex flex-wrap gap-1.5">
                {(['planned', 'executed'] as const).map(t => {
                  const isActive = budgetType === t;
                  return (
                    <button
                      key={t}
                      onClick={() => onBudgetTypeChange(t)}
                      className="px-3 py-1 rounded-xl text-xs font-bold transition-all border"
                      style={{
                        backgroundColor: isActive ? ACCENT : 'white',
                        borderColor: isActive ? ACCENT : 'rgba(0,0,0,0.08)',
                        color: isActive ? 'white' : 'var(--blue-dark)',
                        boxShadow: isActive ? `0 4px 12px ${ACCENT}40` : undefined,
                      }}
                    >
                      {t === 'planned' ? 'Planificado' : 'Ejecutado'}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Summary metric cards ─────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <MetricCard
              icon={<TrendUp size={18} color="white" weight="bold" />}
              label="Ingresos totales"
              value={yearData?.total_income != null ? formatCurrency(yearData.total_income) : '—'}
              accent={ACCENT}
            />
            <MetricCard
              icon={<CurrencyEur size={18} color="white" weight="bold" />}
              label="Gastos totales"
              value={yearData?.total_expenses != null ? formatCurrency(yearData.total_expenses) : '—'}
              accent={ACCENT}
            />
            <MetricCard
              icon={<Bank size={18} color="white" weight="bold" />}
              label="Deuda pública"
              value={yearData?.public_debt != null ? formatCurrency(yearData.public_debt) : '—'}
              accent={ACCENT}
            />
          </div>

          {/* ── Budget delta chart ───────────────────────────────────────── */}
          {yearData && (
            <BudgetDeltaChart
              budgetYear={yearData}
              title="Ejecución presupuestaria"
              subtitle={`Ejecutado − Planificado · ${selectedYear}`}
            />
          )}
        </>
      )}

      {/* ── Mayors Gantt chart ───────────────────────────────────────── */}
      {hasMayors && democraticMayors.length > 0 && (
        <MayorsGanttChart
          terms={democraticMayors}
          title="Historial de Alcaldía"
        />
      )}

      {/* ── Electoral semicircle ─────────────────────────────────────────────── */}
      {hasElections && (
        <ElectoralSemicircle elections={elections} selectedYear={selectedYear} />
      )}
    </div>
  );
}
