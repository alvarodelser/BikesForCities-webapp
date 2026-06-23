import React, { useState, useEffect, useMemo } from 'react';
import { Navigation, Users, TrendingUp, Activity, Network, Route, HelpCircle, X, ChevronDown, ChevronUp } from 'lucide-react';
import type { CityData } from '../../../../../constants/cities';
import type { TrafficOptions } from '../../../../../hooks/useTrafficStats';
import { useTrafficStats } from '../../../../../hooks/useTrafficStats';
import { fetchTrafficInfraCoverage, fetchTrafficEvolution } from '../../../../../services/api';
import { useMapState } from '../../../../../hooks/useMapState';
import MetricPill from '../../../pills/MetricPill';
import { Katex } from '../../../../ui/Katex';
import LineAreaChart from '../../../plots/LineAreaChart';
import PeriodRangeTimeline, { fillSequential } from '../PeriodRangeTimeline';
import { fmtMonth } from '../../../../../utils/formatters';

export interface TrafficStatsProps {
  city: CityData;
  variant?: 'light' | 'darkTint';
}

const ACCENT = '#3A6C7F';

const GENERATION_OPTIONS: { value: string; label: string }[] = [
  { value: 'real', label: 'GPS real' },
  { value: 'station_based', label: 'Estaciones' },
  { value: 'buildings_population', label: 'Población' },
];

const ALGORITHM_OPTIONS: { value: string; label: string }[] = [
  { value: 'map_matched', label: 'Map-matched' },
  { value: 'shortest', label: 'Ruta corta' },
  { value: 'safest', label: 'Ruta segura' },
];

const PELIG_CASES = [
  { label: 'carril bici',   p: 0,  dash: '',    sw: 1.0, opacity: 0.40, highlights: ['cycleway', '≤ 30', '1 carril'] },
  { label: 'calle terc. 2c', p: 15, dash: '5 3', sw: 1.3, opacity: 0.65, highlights: ['resid./terc.', '≤ 50', '2 carriles'] },
  { label: 'vía prim. 4c',  p: 36, dash: '',    sw: 1.8, opacity: 0.85, highlights: ['primaria', '≤ 50', '≥ 4 carriles'] },
] as const;

const PELIG_ROWS = [
  { group: 'Clase',        val: 'cycleway',       p: 0,  id: 'cycleway',      sep: false },
  { group: null,           val: 'resid./terc.',   p: 3,  id: 'resid./terc.',  sep: false },
  { group: null,           val: 'secundaria',     p: 6,  id: 'secundaria',    sep: false },
  { group: null,           val: 'primaria',       p: 12, id: 'primaria',      sep: false },
  { group: null,           val: 'trunk',          p: 20, id: 'trunk',         sep: false },
  { group: 'Vel.',         val: '≤ 30 km/h',      p: 0,  id: '≤ 30',         sep: true  },
  { group: null,           val: '≤ 50 km/h',      p: 8,  id: '≤ 50',         sep: false },
  { group: null,           val: '> 50 km/h',      p: 16, id: '> 50',         sep: false },
  { group: 'Carriles',     val: '1',              p: 0,  id: '1 carril',      sep: true  },
  { group: null,           val: '2',              p: 4,  id: '2 carriles',    sep: false },
  { group: null,           val: '≥ 4',            p: 16, id: '≥ 4 carriles', sep: false },
  { group: 'Puente/túnel', val: null,             p: 20, id: 'puente',        sep: true, span: true },
] as const;

function PeligrosidadSection() {
  const [hover, setHover] = useState<number | null>(null);

  const W = 192, H = 170;
  const ml = 28, mr = 68, mt = 6, mb = 18;
  const pw = W - ml - mr;  // 96
  const ph = H - mt - mb;  // 146
  const X_MIN = 10, X_MAX = 800, Y_MAX = 1500;

  const cost = (l: number, p: number) => l * (1 + (p * Math.log10(l)) / 144);
  const sx = (l: number) => ml + ((l - X_MIN) / (X_MAX - X_MIN)) * pw;
  const sy = (c: number) => mt + ph - (c / Y_MAX) * ph;

  const xs = Array.from({ length: 80 }, (_, i) => X_MIN + ((X_MAX - X_MIN) * i) / 79);
  const makePath = (p: number) =>
    xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${sx(x).toFixed(1)},${sy(cost(x, p)).toFixed(1)}`).join(' ');

  const isHighlighted = (rowId: string) =>
    hover !== null && PELIG_CASES[hover].highlights.includes(rowId as never);

  return (
    <div className="flex flex-row flex-wrap gap-x-3 gap-y-1 items-start mb-1.5">
      {/* Table */}
      <table className="text-[9px] border-collapse flex-shrink-0 rounded" style={{ tableLayout: 'fixed', width: '194px', outline: `1px solid ${ACCENT}20` }}>
        <colgroup>
          <col style={{ width: '50px' }} />
          <col />
          <col style={{ width: '18px' }} />
        </colgroup>
        <thead>
          <tr className="text-left" style={{ color: `${ACCENT}cc` }}>
            <th className="px-1.5 pb-0.5 pt-1 font-black uppercase tracking-wide">Comp.</th>
            <th className="pb-0.5 pt-1 font-black uppercase tracking-wide">Valor</th>
            <th className="pr-1.5 pb-0.5 pt-1 font-black uppercase tracking-wide text-right">+p</th>
          </tr>
        </thead>
        <tbody>
          {PELIG_ROWS.map(row => {
            const lit = isHighlighted(row.id);
            const style = lit ? { backgroundColor: `${ACCENT}18`, fontWeight: 700 } : undefined;
            const tdBase = `transition-all ${row.sep ? 'border-t border-black/10' : ''}`;
            return (
              <tr key={row.id} style={style}>
                <td className={`px-1.5 py-px text-[var(--blue-dark)]/60 ${tdBase} ${row.sep ? 'pt-0.5' : ''}`}>
                  {row.group ?? ''}
                </td>
                {row.span ? (
                  <td colSpan={2} className={`pr-1.5 text-right text-[var(--blue-dark)]/60 ${tdBase} ${row.sep ? 'pt-0.5 pb-1' : ''}`}>
                    {row.p}
                  </td>
                ) : (
                  <>
                    <td className={`text-[var(--blue-dark)]/60 ${tdBase}`}>{row.val}</td>
                    <td className={`pr-1.5 text-right text-[var(--blue-dark)]/60 ${tdBase}`}>{row.p}</td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Chart */}
      <svg
        width={W} height={H}
        className="flex-shrink-0 overflow-visible text-[var(--blue-dark)]"
        onMouseLeave={() => setHover(null)}
      >
        {/* Y-axis grid lines */}
        {[400, 800, 1200].map(v => (
          <line key={v} x1={ml} x2={ml + pw} y1={sy(v)} y2={sy(v)}
            stroke="currentColor" strokeOpacity={0.06} strokeWidth={0.5} />
        ))}
        {/* Axes */}
        <line x1={ml} x2={ml + pw} y1={sy(0)} y2={sy(0)} stroke="currentColor" strokeOpacity={0.15} strokeWidth={0.75} />
        <line x1={ml} x2={ml} y1={mt} y2={mt + ph} stroke="currentColor" strokeOpacity={0.15} strokeWidth={0.75} />
        {/* Y-axis tick labels (cost) */}
        {[0, 400, 800, 1200].map(v => (
          <g key={v}>
            <line x1={ml - 2} x2={ml} y1={sy(v)} y2={sy(v)} stroke="currentColor" strokeOpacity={0.2} strokeWidth={0.5} />
            <text x={ml - 4} y={sy(v) + 2.5} textAnchor="end" fontSize={5.5} fill="currentColor" fillOpacity={0.35}>{v}</text>
          </g>
        ))}
        {/* X-axis ticks */}
        {[200, 400, 600, 800].map(v => (
          <g key={v}>
            <line x1={sx(v)} x2={sx(v)} y1={sy(0)} y2={sy(0) + 3} stroke="currentColor" strokeOpacity={0.15} strokeWidth={0.5} />
            <text x={sx(v)} y={sy(0) + 9} textAnchor="middle" fontSize={5.5} fill="currentColor" fillOpacity={0.35}>{v}</text>
          </g>
        ))}
        <text x={ml + pw / 2} y={H - 2} textAnchor="middle" fontSize={5.5} fill="currentColor" fillOpacity={0.35}>m</text>
        {/* Lines */}
        {PELIG_CASES.map((c, i) => {
          const active = hover === i;
          const faded = hover !== null && !active;
          const endY = sy(cost(X_MAX, c.p));
          const endCost = Math.round(cost(X_MAX, c.p));
          const labelOpacity = faded ? 0.15 : active ? 0.9 : c.opacity + 0.1;
          return (
            <g key={i} onMouseEnter={() => setHover(i)} style={{ cursor: 'default' }}>
              <path d={makePath(c.p)} fill="none" stroke="transparent" strokeWidth={10} />
              <path
                d={makePath(c.p)}
                fill="none"
                stroke="currentColor"
                strokeWidth={active ? c.sw + 0.6 : c.sw}
                strokeOpacity={faded ? 0.12 : active ? Math.min(c.opacity + 0.15, 1) : c.opacity}
                strokeDasharray={c.dash}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ transition: 'stroke-opacity 0.15s, stroke-width 0.15s' }}
              />
              <g onMouseEnter={() => setHover(i)}>
                <circle
                  cx={sx(X_MAX)} cy={endY} r={active ? 2.5 : 1.75}
                  fill="currentColor" fillOpacity={faded ? 0.12 : active ? 0.9 : c.opacity}
                  style={{ transition: 'fill-opacity 0.15s' }}
                />
                <text
                  x={sx(X_MAX) + 5} y={endY + 2}
                  fontSize={5.5} fill="currentColor" fillOpacity={labelOpacity}
                  fontWeight={active ? 'bold' : 'normal'}
                  style={{ transition: 'fill-opacity 0.15s, font-weight 0.1s' }}
                >
                  {c.label}
                </text>
                <text
                  x={sx(X_MAX) + 5} y={endY + 9}
                  fontSize={4.5} fill="currentColor" fillOpacity={labelOpacity * 0.65}
                  style={{ transition: 'fill-opacity 0.15s' }}
                >
                  {endCost}
                </text>
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function fmt(value: number | null, decimals: number, suffix: string): string {
  if (value === null) return '—';
  return suffix ? `${value.toFixed(decimals)} ${suffix}` : value.toFixed(decimals);
}

function trafficLabel(period: string): string {
  return fmtMonth(period);
}

interface FilterCardProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  options: { value: string; label: string; disabled?: boolean }[];
  activeValue: string | undefined;
  onSelect: (v: string) => void;
  helpQueVes?: string;
  helpPorQueEsUtil?: string;
  helpComoSeRecogieron?: string;
  helpComoSeRecogieronPerOption?: Record<string, React.ReactNode>;
}

export function FilterCard({ icon: Icon, title, description, options, activeValue, onSelect, helpQueVes, helpPorQueEsUtil, helpComoSeRecogieron, helpComoSeRecogieronPerOption }: FilterCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [expandedOther, setExpandedOther] = useState<string | null>(null);

  useEffect(() => {
    if (!expanded) setExpandedOther(null);
  }, [expanded]);

  const hasHelp = !!(helpQueVes || helpPorQueEsUtil || helpComoSeRecogieron || helpComoSeRecogieronPerOption);

  const sectionHead = (text: string) => (
    <p className="text-[8px] font-black uppercase tracking-widest mb-0.5 text-[var(--blue-dark)]/35">{text}</p>
  );

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
          <Icon className="w-4 h-4 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-[var(--blue-dark)]">{title}</h3>
          <p className="text-[10px] text-[var(--blue)] opacity-70 leading-snug">{description}</p>
        </div>
        {hasHelp && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 bg-black/5 hover:bg-black/10 text-[var(--blue-dark)]/30 hover:text-[var(--blue-dark)]/60 transition-all"
            aria-label={expanded ? 'Cerrar información' : 'Mostrar información'}
          >
            {expanded ? <X className="w-3 h-3" /> : <HelpCircle className="w-3 h-3" />}
          </button>
        )}
      </div>
      <div className="px-4 pb-4 flex flex-wrap gap-1.5">
        {options.map(opt => {
          const isActive = activeValue === opt.value;
          const isDisabled = opt.disabled === true;
          return (
            <button
              key={opt.value}
              onClick={() => !isDisabled && onSelect(opt.value)}
              disabled={isDisabled}
              className="px-3 py-1 rounded-xl text-xs font-bold transition-all border"
              style={{
                backgroundColor: isActive ? ACCENT : 'white',
                borderColor: isActive ? ACCENT : 'rgba(0,0,0,0.08)',
                color: isActive ? 'white' : isDisabled ? 'rgba(0,0,0,0.25)' : 'var(--blue-dark)',
                boxShadow: isActive ? `0 4px 12px ${ACCENT}40` : undefined,
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                opacity: isDisabled ? 0.45 : 1,
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      {expanded && hasHelp && (
        <div className="px-4 pb-4 border-t flex flex-col gap-2" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
          {helpQueVes && (
            <div className="pt-3">
              {sectionHead('QUÉ VES')}
              <p className="text-[10.5px] leading-relaxed text-[var(--blue-dark)]/75">{helpQueVes}</p>
            </div>
          )}
          {helpPorQueEsUtil && (
            <div>
              {sectionHead('POR QUÉ IMPORTA')}
              <p className="text-[10.5px] leading-relaxed text-[var(--blue-dark)]/75">{helpPorQueEsUtil}</p>
            </div>
          )}
          {(helpComoSeRecogieron || helpComoSeRecogieronPerOption) && (
            <div>
              {sectionHead('METODOLOGÍA')}
              {helpComoSeRecogieronPerOption ? (
                <div className="flex flex-col gap-1">
                  {options.filter(o => helpComoSeRecogieronPerOption![o.value]).map(o => {
                    const isActive = o.value === activeValue;
                    const isOpen = isActive || expandedOther === o.value;
                    return (
                      <div
                        key={o.value}
                        className="rounded-lg overflow-hidden"
                        style={{
                          backgroundColor: isActive ? `${ACCENT}12` : `${ACCENT}07`,
                          border: `1px solid ${isActive ? `${ACCENT}30` : `${ACCENT}18`}`,
                        }}
                      >
                        <button
                          className="w-full flex items-center justify-between px-2 py-1.5 text-left"
                          onClick={() => !isActive && setExpandedOther(v => v === o.value ? null : o.value)}
                          aria-label={isActive ? o.label : isOpen ? `Colapsar ${o.label}` : `Expandir ${o.label}`}
                        >
                          <span
                            className="text-[9px] font-black uppercase tracking-widest"
                            style={{ color: isActive ? ACCENT : `${ACCENT}80` }}
                          >
                            {o.label}
                          </span>
                          {!isActive && (
                            isOpen
                              ? <ChevronUp className="w-3 h-3 flex-shrink-0" style={{ color: `${ACCENT}60` }} />
                              : <ChevronDown className="w-3 h-3 flex-shrink-0" style={{ color: `${ACCENT}60` }} />
                          )}
                        </button>
                        {isOpen && (
                          <div className="px-2 pb-1.5 text-[10.5px] leading-relaxed" style={{ color: isActive ? 'var(--blue-dark)' : `${ACCENT}aa` }}>
                            {helpComoSeRecogieronPerOption![o.value]}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[10.5px] leading-relaxed text-[var(--blue-dark)]/75">{helpComoSeRecogieron}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type Combo = { generation_type: string; algorithm: string };

const TrafficStats: React.FC<TrafficStatsProps> = ({ city, variant }) => {
  const { generation, routing, period, periodFrom, submode, setGeneration, setRouting, setPeriod, setPeriodFrom } = useMapState();
  const isODMode = submode === 'od';

  const combos = (city?.available_modes?.traffic_combinations as Combo[] | undefined) ?? [];
  const availableGenerations = new Set(combos.map(c => c.generation_type));
  const availableAlgorithms = generation
    ? new Set(combos.filter(c => c.generation_type === generation).map(c => c.algorithm))
    : new Set(combos.map(c => c.algorithm));

  const handleGenerationSelect = (v: string) => {
    setGeneration(v);
    const validAlgos = new Set(combos.filter(c => c.generation_type === v).map(c => c.algorithm));
    if (routing && !validAlgos.has(routing)) {
      const firstValid = combos.find(c => c.generation_type === v)?.algorithm;
      if (firstValid) setRouting(firstValid);
    }
  };

  const options: TrafficOptions = {
    period: period || undefined,
    periodFrom: periodFrom || undefined,
    generationType: (generation || undefined) as TrafficOptions['generationType'],
    algorithm: (routing || undefined) as TrafficOptions['algorithm'],
  };

  const { tripsPerMonth, tripsPerThousandHab, maxVolume, maxEdgeName, availablePeriods, loading } =
    useTrafficStats(city.id ?? null, options, city.population);

  // Period defaults are owned by TrafficRoutesLayer (which also corrects inverted ranges).
  // No secondary initialisation here to avoid races.

  const [infraFraction, setInfraFraction] = useState<number | null>(null);
  useEffect(() => {
    if (!city.id) return;
    let cancelled = false;
    fetchTrafficInfraCoverage(city.id, generation || undefined, routing || undefined, period || undefined, periodFrom || undefined)
      .then(cov => { if (!cancelled) setInfraFraction(cov?.infra_fraction ?? null); })
      .catch(() => { if (!cancelled) setInfraFraction(null); });
    return () => { cancelled = true; };
  }, [city.id, generation, routing, period, periodFrom]);

  const [evolutionData, setEvolutionData] = useState<Record<string, unknown>[]>([]);
  useEffect(() => {
    if (!city.id) return;
    let cancelled = false;
    fetchTrafficEvolution(city.id, generation || undefined, routing || undefined)
      .then(result => {
        if (!cancelled) {
          setEvolutionData(result.data.map(p => ({ period: p.period, tripsPerMonth: p.edge_count })));
        }
      })
      .catch(() => { if (!cancelled) setEvolutionData([]); });
    return () => { cancelled = true; };
  }, [city.id, generation, routing]);

  const tripsStr = loading ? '—' : fmt(tripsPerMonth, 0, '');
  const tphStr = loading ? '—' : fmt(tripsPerThousandHab, 1, '');
  const infraFractionStr = loading ? '—' : (infraFraction !== null ? `${(infraFraction * 100).toFixed(1)}%` : '—');
  const maxVolumeStr = loading ? '—' : fmt(maxVolume, 0, '');

  const { items: sortedPeriods, disabled: disabledPeriods } = useMemo(
    () => fillSequential([...availablePeriods].sort()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [availablePeriods.join(',')],
  );
  const defaultPeriod = sortedPeriods.length > 0 ? sortedPeriods[sortedPeriods.length - 1] : '';

  return (
    <div className="w-full flex flex-col gap-4">

      {/* Header */}
      <div>
        <h2 className={`text-2xl font-bold ${variant === 'darkTint' ? 'text-[var(--blue-dark)]' : 'text-white'}`}>Modelo de Movilidad</h2>
      </div>

      {/* ── Period range timeline ───────────────────────────────────────── */}
      {sortedPeriods.length > 0 && (
        <PeriodRangeTimeline
          items={sortedPeriods}
          disabledItems={disabledPeriods}
          from={periodFrom || defaultPeriod}
          to={period || defaultPeriod}
          onChange={(f, t) => { setPeriodFrom(f); setPeriod(t); }}
          accent={ACCENT}
          unit="mes"
          formatLabel={trafficLabel}
        />
      )}

      {/* ── Filter cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <FilterCard
          icon={Network}
          title="Generación"
          description="Define cómo se estiman los orígenes y destinos de los viajes — GPS real, bici pública o distribución por población."
          options={GENERATION_OPTIONS.map(o => ({ ...o, disabled: !availableGenerations.has(o.value) }))}
          activeValue={generation || undefined}
          onSelect={handleGenerationSelect}
          helpQueVes="La fuente de datos que determina dónde se originan y terminan los viajes del modelo. Real usa trayectos GPS del sistema de bici pública; Estaciones estima los viajes a partir de los flujos de entrada y salida de cada estación; Población genera demanda sintética a partir de la densidad de edificios y la distribución de población."
          helpPorQueEsUtil="La elección de la fuente cambia radicalmente el resultado. Real capta la movilidad observada de los usuarios actuales; Estaciones amplía la estimación a todo el sistema de bici pública; Población estima la demanda potencial de la ciudad entera, incluyendo quienes podrían usar la bici pero aún no lo hacen. Comparar los tres revela qué parte de la demanda se cubre y cuánta queda sin infraestructura."
          helpComoSeRecogieronPerOption={{
            real: <>Viajes reales del sistema BiciMAD (datos.madrid.es, 2017–2023). El origen y destino de cada trayecto se anclan al nodo de red más cercano dentro de un radio de 150 m. Los pares con el mismo origen y destino comparten el path calculado, evitando computación redundante.</>,
            station_based: <>Se parte de los flujos mensuales de entradas y salidas por estación. Se construye una matriz de pesos <Katex math="W_{ij} = P(d_{\text{hav}}(i,j))" /> calibrada con el histograma de distancias de Madrid (bins 200 m). El flujo O-D se balancea con Sinkhorn-Knopp para que las sumas de filas (salidas) y columnas (llegadas) coincidan con los datos observados. Cada estación se proyecta al nodo de red más cercano.</>,
            buildings_population: <>Modelo de gravedad: <Katex math="P(i \to j) \propto \dfrac{m_i \cdot m_j}{d(i,j)}" /> donde <Katex math="m_i" /> es la densidad de edificios en el origen y <Katex math="m_j" /> la densidad de población en el destino (WorldPop/Eurostat). La función de decaimiento se calibra contra el histograma de distancias de Madrid. El pipeline de ingesta de rásteres está en desarrollo.</>,
          }}
        />
        <div style={{ opacity: isODMode ? 0.4 : 1, pointerEvents: isODMode ? 'none' : undefined }}>
          <FilterCard
            icon={Route}
            title="Enrutamiento"
            description={isODMode ? 'No aplica en Origen-Destino' : 'Determina por qué camino de la red discurre cada viaje — trazas reales, ruta más corta o ruta más segura.'}
            options={ALGORITHM_OPTIONS.map(o => ({ ...o, disabled: !availableAlgorithms.has(o.value) || isODMode }))}
            activeValue={routing || undefined}
            onSelect={v => setRouting(v)}
            helpQueVes="El algoritmo que decide por qué tramos de la red ciclista discurre cada viaje. Define si los ciclistas modelados priorizan distancia, seguridad o siguen trazas GPS registradas."
            helpPorQueEsUtil="La diferencia de volumen entre Ruta corta y Ruta segura identifica qué corredores están forzando a los ciclistas a circular por calzada — y cuánto tráfico captaría un nuevo tramo de carril en ese punto. Ambas opciones son escenarios de simulación que permiten evaluar el impacto de cualquier mejora de infraestructura antes de construirla."
            helpComoSeRecogieronPerOption={{
              map_matched: <>Los trazos GPS se almacenan directamente como rutas observadas, anclando inicio y fin al nodo de red más cercano (radio 150 m). Cada traza es única y no se deduplica. Refleja el comportamiento ciclista real en lugar de una ruta modelada.</>,
              shortest: <>Dijkstra sobre el grafo dirigido de la red OSM (respeta sentidos únicos), con peso <Katex math="w = \ell\text{ (m)}" />. Los pares origen-destino idénticos se calculan una sola vez y el resultado se comparte entre todos los viajes que los usan. El cálculo se paraleliza en hasta 8 procesos.</>,
              safest: (
                <>
                  <p className="mb-1.5">Dijkstra con peso <Katex math="\text{route\_cost} = \ell \cdot \!\left(1 + p \cdot \dfrac{\log_{10}\ell}{144}\right)" /> donde <Katex math="p" /> es la peligrosidad del tramo. Pasa el cursor sobre las líneas para ver los componentes activos.</p>
                  <PeligrosidadSection />
                  <p className="text-[9px] text-[var(--blue-dark)]/40 mt-0.5">Calibración: 100 m bici → coste 100; 800 m bici → coste 800 (lineal); 800 m primaria 4c → coste ~1381 (superlineal).</p>
                </>
              ),
            }}
          />
        </div>
      </div>

      {/* ── Row 1: Viajes + Trayectos en carril ─────────────────────────── */}
      <div className="grid grid-cols-2 gap-4">
        <MetricPill
          loading={loading}
          value={tripsStr}
          label="Viajes / período"
          sublabel="Trayectos estimados en el período"
          icon={Navigation}
          accent={ACCENT}
          variant={variant}
          helpQueVes="El número total de trayectos en bicicleta estimados para el período y la configuración del modelo seleccionados."
          helpPorQueEsUtil="Da escala real a la movilidad ciclista: cuántos desplazamientos hay que servir. Es el punto de partida para cualquier planificación de infraestructura o servicio."
          helpComoSeRecogieron="Se aplica el modelo de generación activo (GPS real, estaciones o población) y se asignan las rutas sobre la red. Los detalles de cada modelo están en la ayuda de los controles Generación y Enrutamiento."
        />
        <MetricPill
          loading={loading}
          value={infraFractionStr}
          label="Trayectos en carril"
          sublabel="% trayectos sobre infra. ciclista"
          icon={TrendingUp}
          accent={ACCENT}
          variant={variant}
          helpQueVes="El porcentaje de los trayectos estimados que discurren sobre tramos con carril bici con separación física del tráfico."
          helpPorQueEsUtil="Un porcentaje bajo significa que la mayoría de los ciclistas circulan por calzadas sin ninguna protección. Es el argumento más directo para justificar dónde construir el siguiente tramo de carril."
          helpComoSeRecogieron="Se superpone la geometría de cada ruta generada con el trazado de la red ciclista. Un trayecto contribuye al porcentaje en proporción a los kilómetros que transcurren sobre infraestructura protegida respecto a su longitud total."
        />
      </div>

      {/* ── Row 2: Incidencia ciclista + Tramo más cargado ───────────────── */}
      <div className="grid grid-cols-2 gap-4">
        <MetricPill
          loading={loading}
          value={tphStr}
          label="Incidencia Ciclista"
          sublabel="Trayectos / 1.000 hab."
          icon={Users}
          accent={ACCENT}
          variant={variant}
          helpQueVes="Los trayectos estimados en el período por cada 1.000 habitantes."
          helpPorQueEsUtil="Refleja la implantación del modo bici en la ciudad; no solo cuántos ciudadanos usan la bici, sino con qué frecuencia. Permite comparar ciudades con poblaciones muy distintas."
          helpComoSeRecogieron="Se divide el total de viajes generados por el modelo entre la población del municipio según el padrón."
        />
        <MetricPill
          loading={loading}
          value={maxVolumeStr}
          label="Tramo más cargado"
          sublabel={loading ? 'Cargando…' : (maxEdgeName ?? 'Sin nombre')}
          icon={Activity}
          accent={ACCENT}
          variant={variant}
          helpQueVes="El número de trayectos que pasan por el tramo de mayor intensidad de uso en la red, con su nombre identificado."
          helpPorQueEsUtil="Identifica el tramo más crítico de toda la red y el que más ganaría con una mejora de infraestructura. Una concentración muy alta señala un cuello de botella que aumenta la exposición al riesgo."
          helpComoSeRecogieron="Una vez asignados todos los viajes sobre la red, se acumula el volumen en cada tramo y se identifica el máximo."
        />
      </div>

      {/* ── Charts ───────────────────────────────────────────────────────── */}
      {evolutionData.length > 0 && (
        <LineAreaChart
          data={evolutionData}
          xKey="period"
          title="Evolución mensual de trayectos"
          subtitle="Total de trayectos generados por mes"
          series={[
            {
              key: 'tripsPerMonth',
              label: 'Trayectos/mes',
              color: '#4b749f',
              type: 'area',
            },
          ]}
          helpContent={
            <>
              <p><strong>QUÉ VES</strong>: El número total de trayectos del modelo para la configuración activa, representado mes a mes.</p>
              <p><strong>POR QUÉ IMPORTA</strong>: Detecta estacionalidad y tendencia de uso. Un crecimiento sostenido valida la inversión en infraestructura; la estacionalidad habitual muestra pico en septiembre y caídas moderadas en verano e invierno.</p>
              <p><strong>METODOLOGÍA</strong>: Para cada mes disponible se agregan todos los trayectos generados por la combinación activa de generación + enrutamiento. Los meses sin datos no se interpolan.</p>
            </>
          }
        />
      )}
    </div>
  );
};

export default TrafficStats;
