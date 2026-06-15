import { useMemo } from 'react';
import PeriodRangeTimeline, { fillSequential } from '../PeriodRangeTimeline';
import { BudgetDeltaChart } from '../../../plots/BudgetDeltaChart';
import { MayorsGanttChart } from '../../../plots/MayorsGanttChart';
import { ElectoralSemicircle } from '../../../plots/ElectoralSemicircle';
import CategoryEvolutionChart from '../../../plots/CategoryEvolutionChart';
import { CategoryHighlightControl } from './CategoryHighlightControl';
import { buildCategoryOptions } from '../../../../../utils/budget';
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
  v == null ? '—' : `${Math.round(v / 1e6).toLocaleString('es-ES')} M€`;

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

  const yearData = useMemo(
    () => budgetYears.find(by => by.year === selectedYear) ?? null,
    [budgetYears, selectedYear],
  );

  const categoryOptions = useMemo(
    () => buildCategoryOptions(budgetYears),
    [budgetYears],
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
              helpQueVes="El total de ingresos del municipio en el año seleccionado: impuestos, tasas, transferencias del Estado y otras fuentes de financiación."
              helpPorQueEsUtil="Los ingresos determinan la capacidad financiera del ayuntamiento para invertir en servicios e infraestructura. Comparados con el gasto y la deuda, revelan el margen real de maniobra del consistorio."
              helpComoSeRecogieron="Se obtienen del presupuesto municipal oficial. La cifra de ejecutado refleja los ingresos realmente percibidos según la contabilidad municipal."
            />
            <MetricPill
              value={fmtBudgetMetric(yearData?.total_expenses)}
              label="Gastos totales"
              sublabel="Millones de €"
              accent={ACCENT}
              variant={variant}
              helpQueVes="El total de gastos del municipio en el año seleccionado: personal, servicios, inversión en infraestructura y carga financiera."
              helpPorQueEsUtil="El gasto refleja las prioridades políticas y operativas del ayuntamiento. Contrastar lo ejecutado con lo planificado muestra la capacidad real de ejecución de la administración."
              helpComoSeRecogieron="Se obtienen del presupuesto municipal oficial. La cifra de ejecutado procede de la contabilidad municipal y representa el gasto efectivamente realizado."
            />
            <MetricPill
              value={fmtBudgetMetric(yearData?.public_debt)}
              label="Deuda pública"
              sublabel="Millones de €"
              accent={ACCENT}
              variant={variant}
              helpQueVes="El volumen de deuda viva del municipio: el endeudamiento acumulado pendiente de la administración local."
              helpPorQueEsUtil="La deuda marca la sostenibilidad financiera del municipio. Niveles altos limitan la inversión futura; un endeudamiento contenido es señal de gestión fiscal prudente."
              helpComoSeRecogieron="Se obtiene de los registros contables municipales y refleja el stock de deuda pendiente según la contabilidad de ejercicio."
            />
          </div>

          {/* ── Budget delta chart ───────────────────────────────────────── */}
          {yearData && (
            <BudgetDeltaChart
              budgetYear={yearData}
              title="Ejecución presupuestaria"
              subtitle={`Ejecutado − Planificado · ${selectedYear}`}
              helpContent={
                <>
                  <p><strong>QUÉ VES</strong>: La desviación por área de gasto entre lo ejecutado y lo planificado en el año seleccionado. Las barras hacia abajo indican menos gasto del previsto; hacia arriba, más.</p>
                  <p><strong>POR QUÉ IMPORTA</strong>: Un presupuesto solo se cumple cuando lo planificado se ejecuta. Las desviaciones revelan qué prioridades se reforzaron o recortaron en la práctica frente a lo aprobado.</p>
                  <p><strong>METODOLOGÍA</strong>: Para cada área de primer nivel se restan los importes planificados de los ejecutados. Solo se muestran años con ambos tipos de presupuesto disponibles.</p>
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
              <p><strong>QUÉ VES</strong>: La sucesión de alcaldes desde 1975 hasta hoy. Cada barra es un mandato, coloreada por el partido del alcalde y dimensionada según su duración.</p>
              <p><strong>POR QUÉ IMPORTA</strong>: El historial de alcaldía revela la estabilidad política y la continuidad de las políticas urbanas. Mandatos cortos sugieren inestabilidad; mandatos largos, consolidación o consenso.</p>
              <p><strong>METODOLOGÍA</strong>: Los datos proceden de registros administrativos municipales y bases públicas de gobiernos locales. Se incluyen solo los alcaldes desde la restauración de la democracia (1975).</p>
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
              <p><strong>QUÉ VES</strong>: La composición del pleno municipal tras las últimas elecciones disponibles. Cada punto es un concejal, coloreado por partido y situado de izquierda a derecha según su ideología.</p>
              <p><strong>POR QUÉ IMPORTA</strong>: El hemiciclo muestra de un vistazo el equilibrio de fuerzas del consistorio y qué coaliciones son posibles, base para entender la toma de decisiones municipal.</p>
              <p><strong>METODOLOGÍA</strong>: Los concejales proceden de registros electorales oficiales. La posición izquierda-derecha se basa en la clasificación ideológica estándar de cada partido.</p>
            </>
          }
        />
      )}
    </div>
  );
}
