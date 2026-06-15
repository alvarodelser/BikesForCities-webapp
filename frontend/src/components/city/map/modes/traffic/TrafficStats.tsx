import React, { useState, useEffect, useMemo } from 'react';
import { Navigation, Users, TrendingUp, Activity, Network, Route, HelpCircle, X, ChevronDown, ChevronUp } from 'lucide-react';
import type { CityData } from '../../../../../constants/cities';
import type { TrafficOptions } from '../../../../../hooks/useTrafficStats';
import { useTrafficStats } from '../../../../../hooks/useTrafficStats';
import { fetchTrafficInfraCoverage, fetchTrafficEvolution } from '../../../../../services/api';
import { useMapState } from '../../../../../hooks/useMapState';
import MetricPill from '../../../pills/MetricPill';
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
  helpComoSeRecogieronPerOption?: Record<string, string>;
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
                            aria-label={othersExpanded ? 'Ver otros' : `Ver otros (${otherOptions.length})`}
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
                            {otherOptions.map((o, i) => (
                              <div key={o.value} className={i > 0 ? 'border-t border-black/[0.06] pt-2' : ''}>
                                <p className="text-[10.5px] font-bold text-[var(--blue-dark)]/65">{o.label}</p>
                                <p className="text-[10.5px] leading-relaxed text-[var(--blue-dark)]/55">
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
                      .map((o, i) => (
                        <div key={o.value} className={i > 0 ? 'border-t border-black/[0.06] pt-2' : ''}>
                          <p className="text-[10.5px] font-bold text-[var(--blue-dark)]/65">{o.label}</p>
                          <p className="text-[10.5px] leading-relaxed text-[var(--blue-dark)]/55">
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
            real: 'Trayectos GPS del sistema de bici pública proyectados al nodo más cercano de la red (tolerancia 150 m).',
            station_based: 'Viajes sintetizados a partir de flujos de entrada/salida por estación.',
            buildings_population: 'Modelo de gravedad donde la probabilidad de viaje es proporcional a la densidad de edificios del origen, la densidad de población del destino e inversamente proporcional a la distancia.',
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
              map_matched: 'Cada viaje GPS se ancla a los nodos más cercanos a inicio y fin (tolerancia 150 m); la ruta se resuelve por distancia mínima.',
              shortest: 'Dijkstra con peso = longitud en metros.',
              safest: 'Dijkstra con route_cost = length × (1 + peligrosidad × ln(max(length,1)) / 144); la peligrosidad depende del tipo de vía, velocidad máxima y número de carriles.',
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
