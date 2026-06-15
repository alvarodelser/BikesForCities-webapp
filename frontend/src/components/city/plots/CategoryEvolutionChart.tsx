import React from 'react';
import type { BudgetYear } from '../../../services/api';
import { buildCategorySeries } from '../../../utils/budget';
import { LineAreaChart } from './LineAreaChart';
import { SUNBURST_COLORS } from './BudgetSunburst';

const ACCENT = '#3A6C7F';

interface CategoryEvolutionChartProps {
  budgetYears: BudgetYear[];
  /** Full set of selectable categories (provides display names). */
  categories: { code: string; name: string }[];
  /** Currently highlighted category codes. */
  selected: Set<string>;
}

export const CategoryEvolutionChart: React.FC<CategoryEvolutionChartProps> = ({
  budgetYears,
  categories,
  selected,
}) => {
  const selectedCats = categories.filter(c => selected.has(c.code));

  if (selectedCats.length === 0) {
    return (
      <div
        className="rounded-2xl border bg-white/80 backdrop-blur-sm p-5 w-full text-center"
        style={{ borderColor: 'rgba(0,0,0,0.08)', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}
      >
        <h3 className="text-sm font-bold text-[var(--blue-dark)]">Evolución del gasto por área</h3>
        <p className="mt-2 text-xs text-[var(--blue-dark)]/60">
          Selecciona una o más áreas en el panel para ver su evolución a lo largo de los años.
        </p>
      </div>
    );
  }

  const codes = selectedCats.map(c => c.code);
  const data = buildCategorySeries(budgetYears, codes);
  const series = selectedCats.map((c, i) => ({
    key: c.code,
    label: c.name,
    color: SUNBURST_COLORS[i % SUNBURST_COLORS.length],
    type: 'line' as const,
  }));

  return (
    <LineAreaChart
      data={data}
      xKey="year"
      series={series}
      title="Evolución del gasto por área"
      subtitle="Importe por año · ejecutado (planificado cuando no hay ejecución)"
      variant="light"
      accent={ACCENT}
      endLabels
      helpContent={
        <>
          <p><strong>QUÉ VES</strong>: La evolución del importe presupuestario de las áreas seleccionadas a lo largo de los años disponibles. Cada línea es un área de gasto.</p>
          <p><strong>POR QUÉ IMPORTA</strong>: Ver una categoría en el tiempo revela tendencias —refuerzo o recorte sostenido— que una sola foto anual no muestra.</p>
          <p><strong>METODOLOGÍA</strong>: Para cada año se usa el gasto ejecutado; cuando un año aún no tiene ejecución disponible, se usa el planificado. Las áreas sin dato en un año concreto dejan un hueco en su línea.</p>
        </>
      }
    />
  );
};

export default CategoryEvolutionChart;
