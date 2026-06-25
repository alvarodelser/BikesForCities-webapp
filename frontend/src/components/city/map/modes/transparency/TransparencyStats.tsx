import { useMemo } from 'react';
import PeriodRangeTimeline, { fillSequential } from '../PeriodRangeTimeline';
import { BudgetDeltaChart } from '../../../plots/BudgetDeltaChart';
import { MayorsGanttChart } from '../../../plots/MayorsGanttChart';
import { ElectoralSemicircle } from '../../../plots/ElectoralSemicircle';
import CategoryEvolutionChart from '../../../plots/CategoryEvolutionChart';
import { CategoryHighlightControl } from './CategoryHighlightControl';
import { buildCategoryOptions, latestYearWithBoth, resolveBudgetType } from '../../../../../utils/budget';
import MetricPill from '../../../pills/MetricPill';
import type { BudgetYear, MayorTerm, ElectionResult, CouncilorRecord } from '../../../../../services/api';
import type { CityData } from '../../../../../constants/cities';

interface TransparencyStatsProps {
  city: CityData;

  budgetYears: BudgetYear[];
  selectedYear: number;
  onYearChange: (year: number) => void;
  highlightCodes: Set<string>;
  onHighlightChange: (next: Set<string>) => void;
  mayors: MayorTerm[];
  elections: ElectionResult[];
  councilors?: CouncilorRecord[];
  variant?: 'light' | 'darkTint';
}

const ACCENT = '#3A6C7F';

// Budget figures scaled to millions so they fit the MetricPill big-number slot;
// the "M€" unit is carried by the sublabel.
const fmtBudgetMetric = (v: number | null | undefined): string =>
  v == null ? '—' : `${Math.round(v / 1e6)} M€`;

export default function TransparencyStats({
  city,
  budgetYears,
  selectedYear,
  onYearChange,
  highlightCodes,
  onHighlightChange,
  mayors,
  elections,
  councilors,
  variant,
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

  // Among potentially duplicate entries for the same year (one per budget_type),
  // prefer the executed row — identified by having a distinct total_income or
  // total_expenses compared to the other rows for that year.
  const yearData = useMemo(() => {
    const candidates = budgetYears.filter(by => by.year === selectedYear);
    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0];
    // Pick the row whose total_income is highest (executed income tends to be >= planned)
    return candidates.reduce((best, c) =>
      (c.total_income ?? 0) >= (best.total_income ?? 0) ? c : best
    );
  }, [budgetYears, selectedYear]);

  const categoryOptions = useMemo(
    () => buildCategoryOptions(budgetYears),
    [budgetYears],
  );

  // Planned-vs-executed comparison uses the latest year that actually has both.
  const deltaYear = useMemo(
    () => latestYearWithBoth(budgetYears),
    [budgetYears],
  );

  // Percentage of total expenses in the selected year covered by highlighted categories.
  const highlightPct = useMemo(() => {
    if (!yearData || highlightCodes.size === 0) return null;
    const { lines } = yearData;
    const preferType = resolveBudgetType(yearData);
    const typeLines = lines.filter(l => l.budget_type === preferType);
    if (typeLines.length === 0) return null;
    const minLen = Math.min(...typeLines.map(l => l.category_code.length));
    const totalExpenses = typeLines
      .filter(l => l.category_code.length === minLen)
      .reduce((sum, l) => sum + l.amount, 0);
    if (totalExpenses === 0) return null;
    const selectedExpenses = typeLines
      .filter(l => highlightCodes.has(l.category_code))
      .reduce((sum, l) => sum + l.amount, 0);
    return (selectedExpenses / totalExpenses) * 100;
  }, [yearData, highlightCodes]);

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

            {/* ── Category highlight control ────────────────────────────── */}
            <CategoryHighlightControl
              categories={categoryOptions}
              selected={highlightCodes}
              onChange={onHighlightChange}
            />
          </div>

          {/* ── Summary metric cards ─────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <MetricPill
              value={fmtBudgetMetric(yearData?.total_income)}
              label="Ingresos totales"
              sublabel="Millones de €"
              accent={ACCENT}
              variant={variant}
              helpQueVes="El total de ingresos del municipio en el año seleccionado."
              helpPorQueEsUtil="Los ingresos determinan la capacidad financiera del ayuntamiento para invertir en servicios e infraestructura."
              helpComoSeRecogieron="Se obtienen del presupuesto municipal oficial obtenido del CONPREL, Ministerio de Hacienda. La cifra de ejecutado refleja los ingresos realmente percibidos según la contabilidad municipal."
            />
            <MetricPill
              value={fmtBudgetMetric(yearData?.total_expenses)}
              label="Gastos totales"
              sublabel="Millones de €"
              accent={ACCENT}
              variant={variant}
              helpQueVes="El total de gastos del municipio en el año seleccionado."
              helpPorQueEsUtil="El gasto refleja las prioridades políticas y operativas del ayuntamiento."
              helpComoSeRecogieron="Se obtienen del presupuesto municipal oficial. Las cifras ejecutada y planficada procede de la contabilidad municipal y representa el gasto efectivamente realizado."
            />
          </div>

          {/* ── Budget delta chart ───────────────────────────────────────── */}
          {deltaYear && (
            <BudgetDeltaChart
              budgetYear={deltaYear}
              filterCodes={highlightCodes}
              title="Ejecución presupuestaria"
              subtitle={`Ejecutado − Planificado · ${deltaYear.year}`}
              helpContent={
                <>
                  <p><span className="inline-flex px-1.5 py-px rounded-full text-[7.5px] font-black uppercase tracking-widest text-black/35 bg-black/[0.045] border border-black/[0.07] mr-1.5 align-middle">QUÉ VES</span>La desviación entre ejecutado y planificado para las áreas destacadas. Una desviación hacia abajo indican menos gasto del previsto; hacia arriba, más.</p>
                  <p><span className="inline-flex px-1.5 py-px rounded-full text-[7.5px] font-black uppercase tracking-widest text-black/35 bg-black/[0.045] border border-black/[0.07] mr-1.5 align-middle">POR QUÉ IMPORTA</span>Las desviaciones revelan la capacidad de ejecución del presupuesto del consistorio y qué prioridades se reforzaron o recortaron en la práctica frente a lo aprobado.</p>
                  <p><span className="inline-flex px-1.5 py-px rounded-full text-[7.5px] font-black uppercase tracking-widest text-black/35 bg-black/[0.045] border border-black/[0.07] mr-1.5 align-middle">METODOLOGÍA</span>Se restan los importes planificados de los ejecutados para cada área seleccionada en el panel, usando el año más reciente que dispone de ambos tipos de presupuesto.</p>
                </>
              }
            />
          )}

          {/* ── Category expense evolution ───────────────────────────────── */}
          <CategoryEvolutionChart
            budgetYears={budgetYears}
            categories={categoryOptions}
            selected={highlightCodes}
          />
        </>
      )}

      {/* ── Mayors Gantt chart ───────────────────────────────────────── */}
      {hasMayors && democraticMayors.length > 0 && (
        <MayorsGanttChart
          terms={democraticMayors}
          title="Historial de Alcaldía"
          helpContent={
            <>
              <p><span className="inline-flex px-1.5 py-px rounded-full text-[7.5px] font-black uppercase tracking-widest text-black/35 bg-black/[0.045] border border-black/[0.07] mr-1.5 align-middle">QUÉ VES</span>Mandatos de alcaldes desde 1975 hasta hoy. Cada barra es un mandato, cuyo tono indica el partido político y dimensionada según su duración.</p>
              <p><span className="inline-flex px-1.5 py-px rounded-full text-[7.5px] font-black uppercase tracking-widest text-black/35 bg-black/[0.045] border border-black/[0.07] mr-1.5 align-middle">POR QUÉ IMPORTA</span>El historial de alcaldía contextualiza las prioridades de los mandatos electorales y la continuidad de las políticas urbanas.</p>
              <p><span className="inline-flex px-1.5 py-px rounded-full text-[7.5px] font-black uppercase tracking-widest text-black/35 bg-black/[0.045] border border-black/[0.07] mr-1.5 align-middle">METODOLOGÍA</span>Los datos proceden de Wikidata, la base de datos semántica basada en Wikipedia. Se ha obtenido todos los alcaldes asociados a cada municipio y su afiliación política, que puede no coincidir con el período en cuestión. Se muestra el período a partir de 1975.</p>
            </>
          }
        />
      )}

      {/* ── Electoral semicircle ─────────────────────────────────────────────── */}
      {hasElections && (
        <ElectoralSemicircle
          elections={elections}
          councilors={councilors}
          selectedYear={selectedYear}
          helpContent={
            <>
              <p><span className="inline-flex px-1.5 py-px rounded-full text-[7.5px] font-black uppercase tracking-widest text-black/35 bg-black/[0.045] border border-black/[0.07] mr-1.5 align-middle">QUÉ VES</span>La composición del pleno municipal tras las últimas elecciones disponibles. Cada punto es un concejal, su color indica el partido.</p>
              <p><span className="inline-flex px-1.5 py-px rounded-full text-[7.5px] font-black uppercase tracking-widest text-black/35 bg-black/[0.045] border border-black/[0.07] mr-1.5 align-middle">POR QUÉ IMPORTA</span>El hemiciclo muestra de un vistazo el equilibrio de fuerzas del consistorio, base para entender la toma de decisiones municipal.</p>
              <p><span className="inline-flex px-1.5 py-px rounded-full text-[7.5px] font-black uppercase tracking-widest text-black/35 bg-black/[0.045] border border-black/[0.07] mr-1.5 align-middle">METODOLOGÍA</span>Los concejales proceden del registros electorales oficiales del ministerio del interior. La posición izquierda-derecha se basa en la clasificación ideológica estándar de cada partido.</p>
            </>
          }
        />
      )}
    </div>
  );
}
