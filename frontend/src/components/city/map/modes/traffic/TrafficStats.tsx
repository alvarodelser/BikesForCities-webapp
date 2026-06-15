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

function fmt(value: number | null, decimals: number, suffix: string): string {
  if (value === null) return '—';
  return suffix ? `${value.toFixed(decimals)} ${suffix}` : value.toFixed(decimals);
}

const ACCENT = '#3A6C7F';

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
  const [othersExpanded, setOthersExpanded] = useState(false);

  useEffect(() => {
    if (!expanded) setOthersExpanded(false);
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
                activeValue && helpComoSeRecogieronPerOption[activeValue] ? (
                  (() => {
                    const otherOptions = options.filter(o => o.value !== activeValue && helpComoSeRecogieronPerOption![o.value]);
                    return (
                      <>
                        <div
                          className="rounded-lg px-2 py-1.5 mb-2"
                          style={{ backgroundColor: `${ACCENT}12`, border: `1px solid ${ACCENT}30` }}
                        >
                          <span
                            className="text-[9px] font-black uppercase tracking-widest"
                            style={{ color: ACCENT }}
                          >
                            {options.find(o => o.value === activeValue)?.label ?? activeValue}
                          </span>
                          <p className="text-[10.5px] leading-relaxed text-[var(--blue-dark)]/75 mt-0.5">
                            {helpComoSeRecogieronPerOption[activeValue]}
                          </p>
                        </div>
                        {otherOptions.length > 0 && (
                          <button
                            onClick={() => setOthersExpanded(v => !v)}
                            className="flex items-center gap-1 text-[10px] font-semibold text-[var(--blue-dark)]/40 hover:text-[var(--blue-dark)]/65 transition-colors mt-1"
                            aria-label={othersExpanded ? 'Ocultar otras opciones' : `Ver otros (${otherOptions.length})`}
                          >
                            {othersExpanded ? (
                              <><ChevronUp className="w-3 h-3" />Ver otros</>
                            ) : (
                              <><ChevronDown className="w-3 h-3" />Ver otros ({otherOptions.length})</>
                            )}
                          </button>
                        )}
                        {othersExpanded && (
                          <div className="mt-2 flex flex-col gap-2">
                            {otherOptions.map((o) => (
                              <div
                                key={o.value}
                                className="rounded-lg px-2 py-1.5"
                                style={{ backgroundColor: `${ACCENT}07`, border: `1px solid ${ACCENT}18` }}
                              >
                                <p className="text-[10.5px] font-bold text-[var(--blue-dark)]/55">{o.label}</p>
                                <p className="text-[10.5px] leading-relaxed text-[var(--blue-dark)]/45 mt-0.5">
                                  {helpComoSeRecogieronPerOption![o.value]}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    );
                  })()
                ) : (
                  <div className="flex flex-col gap-2">
                    {options
                      .filter(o => helpComoSeRecogieronPerOption![o.value])
                      .map((o) => (
                        <div
                          key={o.value}
                          className="rounded-lg px-2 py-1.5"
                          style={{ backgroundColor: `${ACCENT}07`, border: `1px solid ${ACCENT}18` }}
                        >
                          <p className="text-[10.5px] font-bold text-[var(--blue-dark)]/55">{o.label}</p>
                          <p className="text-[10.5px] leading-relaxed text-[var(--blue-dark)]/45 mt-0.5">
                            {helpComoSeRecogieronPerOption![o.value]}
                          </p>
                        </div>
                      ))}
                  </div>
                )
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
                  <p className="mb-1.5">Dijkstra con peso <Katex math="\text{route\_cost} = \ell \cdot \!\left(1 + p \cdot \dfrac{\log_{10}\ell}{144}\right)" /> donde <Katex math="p" /> es la peligrosidad del tramo.</p>
                  <table className="text-[9px] border-collapse mb-1.5 mx-auto rounded" style={{ tableLayout: 'fixed', width: '200px', outline: `1px solid ${ACCENT}20` }}>
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
                    <tbody className="text-[var(--blue-dark)]/60">
                      <tr><td className="px-1.5 py-px">Clase</td><td>cycleway</td><td className="pr-1.5 text-right">0</td></tr>
                      <tr><td /><td>resid./terc.</td><td className="pr-1.5 text-right">3</td></tr>
                      <tr><td /><td>secundaria</td><td className="pr-1.5 text-right">6</td></tr>
                      <tr><td /><td>primaria</td><td className="pr-1.5 text-right">12</td></tr>
                      <tr><td /><td>trunk</td><td className="pr-1.5 text-right">20</td></tr>
                      <tr className="border-t border-black/10"><td className="px-1.5 pt-0.5">Vel.</td><td>≤ 30 km/h</td><td className="pr-1.5 text-right">+0</td></tr>
                      <tr><td /><td>≤ 50 km/h</td><td className="pr-1.5 text-right">+8</td></tr>
                      <tr><td /><td>&gt; 50 km/h</td><td className="pr-1.5 text-right">+16</td></tr>
                      <tr className="border-t border-black/10"><td className="px-1.5 pt-0.5">Carriles</td><td>1</td><td className="pr-1.5 text-right">+0</td></tr>
                      <tr><td /><td>2</td><td className="pr-1.5 text-right">+4</td></tr>
                      <tr><td /><td>≥ 4</td><td className="pr-1.5 text-right">+16</td></tr>
                      <tr className="border-t border-black/10"><td className="px-1.5 pt-0.5 pb-1" colSpan={2}>Puente/túnel</td><td className="pr-1.5 pb-1 text-right">20</td></tr>
                    </tbody>
                  </table>
                  <p>Calibración: 100 m de carril bici → coste 100; 100 m de vía primaria 4 carriles a 50 km/h → coste ≈150.</p>
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
