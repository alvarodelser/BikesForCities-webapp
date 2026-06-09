import React, { useEffect, useMemo } from 'react';
import type { CityData } from '../../../../../constants/cities';
import { useAccidentsStats } from '../../../../../hooks/useAccidentsStats';
import { fmtInt } from '../../../../../utils/formatters';
import { useMapState } from '../../../../../hooks/useMapState';
import MetricPill from '../../../pills/MetricPill';
import StackedBarMatrix from '../../../plots/StackedBarMatrix';
import BarHistogram from '../../../plots/BarHistogram';
import CollisionHeatmap from '../../../plots/CollisionHeatmap';
import PeriodRangeTimeline, { fillSequential } from '../PeriodRangeTimeline';
import { Car, Bus, Truck, Motorcycle, Bicycle, Sun, CloudRain, Warning } from '@phosphor-icons/react';

export interface AccidentsStatsProps {
  city: CityData;
  variant?: 'light' | 'darkTint';
}

const SEVERITY_LABELS = ['Ileso', 'Leve', 'Grave', 'Fatal'];
const ACCENT = '#ef4444';

function AccidentFilterCard({ value, onChange }: { value: 'bike' | 'all'; onChange: (v: 'bike' | 'all') => void }) {
  const options: { value: 'bike' | 'all'; label: string }[] = [
    { value: 'bike', label: 'Bicicleta' },
    { value: 'all',  label: 'Todos' },
  ];
  return (
    <div
      className="rounded-2xl border bg-white/80 backdrop-blur-sm overflow-hidden"
      style={{ borderColor: 'rgba(0,0,0,0.08)', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}
    >
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT}cc)`, boxShadow: `0 4px 12px ${ACCENT}55` }}
        >
          <Warning size={16} className="text-white" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-[var(--blue-dark)]">Tipo de accidente</h3>
          <p className="text-[10px] text-[var(--blue)] opacity-70 leading-snug">
            Siniestros con ciclista implicado o todos los accidentes registrados.
          </p>
        </div>
      </div>
      <div className="px-4 pb-4 flex flex-wrap gap-1.5">
        {options.map(opt => {
          const isActive = value === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => onChange(opt.value)}
              className="px-3 py-1 rounded-xl text-xs font-bold transition-all border"
              style={{
                backgroundColor: isActive ? ACCENT : 'white',
                borderColor: isActive ? ACCENT : 'rgba(0,0,0,0.08)',
                color: isActive ? 'white' : 'var(--blue-dark)',
                boxShadow: isActive ? `0 4px 12px ${ACCENT}40` : undefined,
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const CYCLIST_ROW_ICONS = [
  <Car size={13} color="#6b7280" />,
  <Bus size={13} color="#f59e0b" />,
  <Truck size={13} color="#78716c" />,
  <Motorcycle size={13} color="#8b5cf6" />,
  <Bicycle size={13} color="#ef4444" />,
];

const PEDESTRIAN_ROW_ICONS = [
  <Car size={13} color="#6b7280" />,
  <Bus size={13} color="#f59e0b" />,
  <Truck size={13} color="#78716c" />,
  <Motorcycle size={13} color="#8b5cf6" />,
  <Bicycle size={13} color="#22c55e" />,
];

const AccidentsStats: React.FC<AccidentsStatsProps> = ({ city, variant }) => {
  const { yearFrom, yearTo, setYearFrom, setYearTo, accidentType, setAccidentType } = useMapState();

  const yearFromNum = yearFrom ? parseInt(yearFrom, 10) : undefined;
  const yearToNum   = yearTo   ? parseInt(yearTo,   10) : undefined;

  const {
    totalAccidents,
    cyclistAccidents,
    latestYear,
    availableYears,
    cyclistVehicleMatrix,
    pedestrianVehicleMatrix,
    epacWeatherBars,
    collisionMatrix,
    loading,
  } = useAccidentsStats(city.id ?? null, yearFromNum, yearToNum);

  // Auto-initialise range to latest year on first load
  useEffect(() => {
    if (!yearTo && !yearFrom && latestYear) {
      const yr = String(latestYear);
      setYearTo(yr);
      setYearFrom(yr);
    }
  }, [latestYear, yearTo, yearFrom, setYearTo, setYearFrom]);

  const fmt = (n: number) => (loading ? '—' : fmtInt(n));

  const { items: yearStrings, disabled: disabledYears } = useMemo(
    () => fillSequential([...new Set(availableYears)].sort((a, b) => a - b).map(String)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [availableYears.join(',')],
  );
  const defaultYear = latestYear != null ? String(latestYear) : '';

  return (
    <div className="w-full flex flex-col gap-6">

      {/* ── Period range timeline ───────────────────────────────────────── */}
      {yearStrings.length > 0 && (
        <PeriodRangeTimeline
          items={yearStrings}
          disabledItems={disabledYears}
          from={yearFrom || defaultYear}
          to={yearTo || defaultYear}
          onChange={(f, t) => { setYearFrom(f); setYearTo(t); }}
          accent={ACCENT}
          unit="año"
        />
      )}

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="px-1">
        <h2 className={`text-2xl font-bold ${variant === 'darkTint' ? 'text-[var(--blue-dark)]' : 'text-white'}`}>
          Siniestralidad Vial
        </h2>
      </div>

      {/* ── Tipo de accidente filter ────────────────────────────────────── */}
      <AccidentFilterCard value={accidentType} onChange={setAccidentType} />

      {/* ── Stat pills (3 cols) ─────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        <MetricPill
          value={fmt(totalAccidents)}
          label="Total siniestros"
          accent={ACCENT}
          variant={variant}
          helpQueVes="El número total de accidentes con víctimas registrados en el municipio para el período seleccionado, de todos los modos de transporte."
          helpPorQueEsUtil="Es la magnitud global del problema vial. Comparar este número con años anteriores o con ciudades similares es el primer paso para evaluar si las políticas de seguridad vial tienen efecto real."
          helpComoSeRecogieron="Datos del registro oficial de accidentalidad de la DGT o equivalente municipal. Se cuentan únicamente los partes con al menos una víctima."
        />
        <MetricPill
          value={fmt(cyclistAccidents)}
          label="Siniestros ciclistas"
          accent={ACCENT}
          variant={variant}
          helpQueVes="El número de accidentes en los que al menos un vehículo implicado era una bicicleta o vehículo de movilidad personal (VMP)."
          helpPorQueEsUtil="Los ciclistas son el colectivo más vulnerable de la vía. Este número es el que deben reducir las políticas de infraestructura ciclista — y el que mide directamente si lo consiguen."
          helpComoSeRecogieron="Se filtra el registro general de accidentes por el campo de tipo de vehículo implicado. Los VMP se incluyen cuando la fuente de datos los distingue."
        />
        <MetricPill
          value={totalAccidents > 0 ? `${((cyclistAccidents / totalAccidents) * 100).toFixed(1)} %` : '—'}
          label="Incidencia ciclista"
          accent={ACCENT}
          variant={variant}
          helpQueVes="El porcentaje de todos los accidentes con víctimas del período en los que hay al menos un ciclista o VMP implicado."
          helpPorQueEsUtil="Pone en contexto la exposición del ciclista frente a otros modos. Si la incidencia es alta pero el número absoluto es pequeño, puede indicar que hay pocos ciclistas expuestos, no que la infraestructura esté bien."
          helpComoSeRecogieron="siniestros_ciclistas / siniestros_totales × 100. Ambos valores se calculan sobre el mismo período y área de estudio."
        />
      </div>

      {/* ── Matrices ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StackedBarMatrix
          rows={cyclistVehicleMatrix}
          segmentLabels={SEVERITY_LABELS}
          title="Severidad ciclista"
          subtitle="Por tipo de vehículo implicado"
          rowIcons={CYCLIST_ROW_ICONS}
          helpContent={
            <>
              <p><strong>QUÉ VES</strong>: Para cada tipo de vehículo contrario (turismo, camión, moto, etc.), la distribución de los siniestros ciclistas por nivel de gravedad: ileso, leve, grave y fatal.</p>
              <p><strong>POR QUÉ IMPORTA</strong>: No todos los choques son iguales. Las colisiones con camiones y autobuses concentran la mortalidad aunque sean menos frecuentes. Este gráfico identifica con qué tipo de vehículo hay que separar físicamente el carril para reducir fatalidades.</p>
              <p><strong>METODOLOGÍA</strong>: Se cruzan el tipo de vehículo contrario y la severidad de las víctimas ciclistas. La altura de cada barra es el número total de siniestros; los colores apilados representan las cuatro categorías de gravedad según la clasificación oficial de la DGT.</p>
            </>
          }
        />
        <StackedBarMatrix
          rows={pedestrianVehicleMatrix}
          segmentLabels={SEVERITY_LABELS}
          title="Severidad peatonal"
          subtitle="Por tipo de vehículo implicado"
          rowIcons={PEDESTRIAN_ROW_ICONS}
          helpContent={
            <>
              <p><strong>QUÉ VES</strong>: Para cada tipo de vehículo, la distribución de los siniestros con víctimas peatonales según gravedad: ileso, leve, grave y fatal.</p>
              <p><strong>POR QUÉ IMPORTA</strong>: Muestra qué tipo de tráfico pone en riesgo a los peatones. La gravedad media de los atropellos varía mucho según el vehículo. Sirve para priorizar zonas de coexistencia o de velocidad reducida junto a la red ciclista.</p>
              <p><strong>METODOLOGÍA</strong>: Mismo registro que la matriz ciclista, filtrado por víctima peatonal. El vehículo contrario puede ser motorizado, bicicleta o VMP.</p>
            </>
          }
        />
      </div>

      {/* ── Weather + Collision matrix side by side ─────────────────────── */}
      <div className="grid grid-cols-2 gap-6">
        <BarHistogram
          data={epacWeatherBars.map(d => ({
            ...d,
            icon: d.label.includes('lluvia') ? CloudRain : Sun,
          }))}
          accent={ACCENT}
          title="Efecto meteorológico sobre caídas"
          subtitle="Siniestros ciclistas según condiciones meteorológicas"
          helpContent={
            <>
              <p><strong>QUÉ VES</strong>: La comparación del número de siniestros ciclistas en condiciones de buen tiempo frente a lluvia, separado por bicicletas convencionales y EPACs.</p>
              <p><strong>POR QUÉ IMPORTA</strong>: Si los siniestros en lluvia son desproporcionadamente graves, puede indicar problemas de adherencia o visibilidad. Si son más frecuentes en seco, el patrón apunta a mayor volumen de uso en buen tiempo.</p>
              <p><strong>METODOLOGÍA</strong>: Se filtra el registro de accidentes por tipo de vehículo (bicicleta / EPAC) y por la condición meteorológica declarada en el parte oficial: seco vs lluvia. Las demás condiciones se agrupan en "otras".</p>
            </>
          }
        />
        <CollisionHeatmap
          data={collisionMatrix}
          title="Matriz de colisiones"
          subtitle="▽ fila · △ columna · gravedad media del vehículo"
          helpContent={
            <>
              <p><strong>QUÉ VES</strong>: Una matriz donde filas y columnas representan tipos de vehículo. El color de cada celda indica la gravedad media de los accidentes entre ese par, escalado de verde (ileso promedio) a rojo (mortal promedio).</p>
              <p><strong>POR QUÉ IMPORTA</strong>: De un vistazo, muestra qué combinaciones de vehículos producen los peores resultados. Es el argumento más visual para justificar la separación física entre bicicletas y tráfico motorizado pesado.</p>
              <p><strong>METODOLOGÍA</strong>: Para cada par de tipos de vehículo se promedian los valores de gravedad (0=ileso, 1=leve, 2=grave, 3=fatal). Solo se muestran celdas con al menos 5 siniestros en el período para evitar ruido estadístico.</p>
            </>
          }
        />
      </div>
    </div>
  );
};

export default AccidentsStats;
