import React from 'react';
import type { CityData } from '../../constants/cities';
import type { ModeStats } from '../../constants/cityStats';
import { getTrendColor, getTrendIcon } from '../../constants/cityStats';
import { Network, Route, Calendar, BarChart3, TrendingUp, Activity } from 'lucide-react';
import GlassCard from '../ui/GlassCard';
import { useMapState } from '../../hooks/useMapState';
import { MAP_MODES } from '../../constants/mapModes';
import { useLiveStats, formatMonth } from '../../hooks/useLiveStats';
import type { TrafficMode } from '../../services/api';
import MetricPill from './pills/MetricPill';

// ── Traffic computation labels (matches backend keys from TrafficLegend) ──────

const GENERATION_LABELS: Record<string, string> = {
  real: 'GPS real',
  station_based: 'Estaciones',
  buildings_population: 'Población',
};
const ALGORITHM_LABELS: Record<string, string> = {
  map_matched: 'Map-matched',
  safest: 'Ruta segura',
  shortest: 'Ruta corta',
  grouped: 'Agrupado',
};
const GENERATION_ORDER = ['real', 'station_based', 'buildings_population'];
const ALGORITHM_ORDER = ['map_matched', 'safest', 'shortest', 'grouped'];

function computationOptions(trafficModes: TrafficMode[], generation: string) {
  const gens = GENERATION_ORDER
    .filter(g => trafficModes.some(m => m.generation_type === g))
    .map(g => ({ id: g, label: GENERATION_LABELS[g] ?? g }));
  // Fall back to the first available generation when none is selected so the
  // routing panel renders algorithms on initial load instead of being empty.
  const effectiveGen = generation || gens[0]?.id || '';
  const algos = ALGORITHM_ORDER
    .filter(a => trafficModes.some(m => m.generation_type === effectiveGen && m.algorithm === a))
    .map(a => ({ id: a, label: ALGORITHM_LABELS[a] ?? a }));
  return { gens, algos };
}

// ── Computation card ──────────────────────────────────────────────────────────

interface ComputationCardProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  options: { id: string; label: string }[];
  value: string;
  defaultValue: string;
  accent: string;
  onChange: (id: string) => void;
  compact: boolean;
}

function ComputationCard({
  icon: Icon, title, description, options, value, defaultValue, accent, onChange, compact,
}: ComputationCardProps) {
  const active = value || defaultValue;
  return (
    <div
      className="rounded-2xl border bg-white/80 backdrop-blur-sm overflow-hidden"
      style={{
        borderColor: 'rgba(0,0,0,0.08)',
        boxShadow: `inset 0 1px 0 ${accent}, 0 4px 16px rgba(0,0,0,0.04)`,
      }}
    >
      <div className={`flex items-center gap-3 ${compact ? 'px-4 pt-4 pb-2' : 'px-5 pt-5 pb-3'}`}>
        <div
          className={`${compact ? 'w-8 h-8' : 'w-10 h-10'} rounded-xl flex items-center justify-center flex-shrink-0`}
          style={{
            background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
            boxShadow: `0 4px 12px ${accent}55`,
          }}
        >
          <Icon className={`${compact ? 'w-4 h-4' : 'w-5 h-5'} text-white`} />
        </div>
        <div className="min-w-0">
          <h3 className={`${compact ? 'text-sm' : 'text-base'} font-bold text-[var(--blue-dark)]`}>{title}</h3>
          <p className={`${compact ? 'text-[10px]' : 'text-xs'} text-[var(--blue)] opacity-70 truncate`}>{description}</p>
        </div>
      </div>
      <div className={`${compact ? 'px-4 pb-4' : 'px-5 pb-5'}`}>
        <div className={`grid gap-1.5`} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
          {options.map(opt => {
            const isActive = active === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => onChange(opt.id)}
                className={`${compact ? 'px-2 py-1.5 text-[10px]' : 'px-2 py-2 text-xs'} rounded-xl font-semibold transition-all border`}
                style={{
                  backgroundColor: isActive ? accent : 'white',
                  borderColor: isActive ? accent : 'rgba(0,0,0,0.08)',
                  color: isActive ? 'white' : 'var(--blue-dark)',
                  boxShadow: isActive ? `0 4px 12px ${accent}40` : undefined,
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Stat card skeleton ────────────────────────────────────────────────────────

function StatSkeleton({ compact }: { compact: boolean }) {
  return (
    <div
      className={`${compact ? 'p-3' : 'p-6'} rounded-2xl border border-black/5 bg-white/40 animate-pulse`}
      style={{ minHeight: compact ? 90 : 140 }}
    />
  );
}

// ── Grid column class by stat count ──────────────────────────────────────────

function gridCols(n: number): string {
  if (n <= 3) return 'grid-cols-1 sm:grid-cols-3';
  if (n === 5) return 'grid-cols-2 md:grid-cols-3 lg:grid-cols-5';
  return 'grid-cols-2 md:grid-cols-2 lg:grid-cols-4';
}

// ── Main component ────────────────────────────────────────────────────────────

interface CityStatsProps {
  city: CityData;
  title?: string;
  subtitle?: string;
  modeStats?: ModeStats;
  compact?: boolean;
  theme?: 'light' | 'dark';
}

const CityStats: React.FC<CityStatsProps> = ({ city, title, subtitle, modeStats, compact = false, theme = 'light' }) => {
  const { mode, generation, routing, period, setGeneration, setRouting, setPeriod } = useMapState();
  const { insights = { primary: '', secondary: '' }, recommendations = { primary: '', secondary: '' } } = modeStats || {};
  const isTraffic = mode === MAP_MODES.TRAFFIC;
  const isInfra = mode === MAP_MODES.INFRASTRUCTURE;
  const accent = '#3A6C7F';

  const { stats: liveStats, trafficModes, availablePeriods, loading } = useLiveStats(city, mode, generation, routing, period);
  const { gens, algos } = computationOptions(trafficModes, generation);

  const handleSetGeneration = (gen: string) => {
    setGeneration(gen);
    const algosForGen = ALGORITHM_ORDER.filter(a =>
      trafficModes.some(m => m.generation_type === gen && m.algorithm === a)
    );
    if (algosForGen.length > 0 && !algosForGen.includes(routing)) {
      setRouting(algosForGen[0]);
    }
  };

  const showLiveStats = liveStats.length > 0;
  const statsToRender = showLiveStats ? liveStats : (modeStats?.stats || []);
  const colClass = showLiveStats ? gridCols(liveStats.length) : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4';

  return (
    <div className={`w-full ${compact ? 'bg-transparent' : ''}`}>
      <div className={`max-w-7xl mx-auto ${compact ? 'px-0 py-4' : 'py-4'}`}>

        {/* Header */}
        <div className={`${compact ? 'mb-4' : 'mb-8'}`}>
          <h2 className={`${compact ? 'text-xl' : 'text-3xl'} font-bold ${theme === 'dark' ? 'text-white' : 'text-[var(--blue-dark)]'} mb-1`}>{title}</h2>
          <p className={`${theme === 'dark' ? 'text-white/80' : 'text-[var(--blue)] opacity-80'} ${compact ? 'text-xs' : 'text-base'}`}>{subtitle}</p>
        </div>

        {/* Traffic computation cards — dynamic options from backend */}
        {isTraffic && gens.length > 0 && (
          <div className={`grid grid-cols-1 md:grid-cols-3 ${compact ? 'gap-3 mb-4' : 'gap-4 mb-8'}`}>
            <ComputationCard
              icon={Calendar}
              title="Período de datos"
              description="Mes/período de datos disponibles"
              options={availablePeriods.map(p => ({ id: p, label: formatMonth(p) }))}
              value={period}
              defaultValue={availablePeriods[0] ?? ''}
              accent={accent}
              onChange={setPeriod}
              compact={compact}
            />
            <ComputationCard
              icon={Network}
              title="Generación de viajes"
              description="Cómo se estima la demanda origen→destino"
              options={gens}
              value={generation}
              defaultValue={gens[0]?.id ?? ''}
              accent={accent}
              onChange={handleSetGeneration}
              compact={compact}
            />
            <ComputationCard
              icon={Route}
              title="Cálculo de rutas"
              description="Algoritmo para asignar rutas a la red"
              options={algos}
              value={routing}
              defaultValue={algos[0]?.id ?? ''}
              accent={accent}
              onChange={setRouting}
              compact={compact}
            />
          </div>
        )}
        {/* Infrastructure special pills */}
        {isInfra && (
          <div className="mb-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricPill
                value={liveStats[0]?.value || `${city.cyclingNetwork.toFixed(1)} km`}
                label="Longitud total"
                sublabel="Red ciclista"
                icon={BarChart3}
                helpContent="Longitud total de la red de carriles bici e infraestructura ciclista detectada en la ciudad."
              />
              <MetricPill
                value={liveStats[3]?.value || `${(city.coverage * 100).toFixed(1)} %`}
                label="Cobertura poblacional"
                sublabel="Accesibilidad"
                icon={TrendingUp}
                helpContent="Porcentaje de la población que vive a menos de 150 metros de un carril bici."
              />
              <MetricPill
                value={liveStats[4]?.value || '—'}
                label="Cobertura GCC"
                sublabel="Conectividad"
                icon={Network}
                helpContent="Cobertura de la 'Gran Componente Conexa' (GCC). Indica el porcentaje de población servido por la red continua más grande, sin saltos."
              />
              <MetricPill
                value={liveStats[2]?.value || '—'}
                label="Eficiencia presupuestaria"
                sublabel="Inversión"
                icon={Activity}
                helpContent="Kilómetros de infraestructura por cada millón de euros invertido en el programa de Vías Públicas."
              />
            </div>
          </div>
        )}

        {/* Statistics Grid */}
        {!isInfra && (
          <div className={`grid ${colClass} ${compact ? 'gap-2.5' : 'gap-3'}`}>
            {loading
              ? Array.from({ length: 4 }).map((_, i) => <StatSkeleton key={i} compact={compact} />)
              : statsToRender.map((stat, index) => {
                const isLive = showLiveStats;
                const comingSoon = isLive && (stat as any).comingSoon;
                const trend = (stat as any).trend ?? 'neutral';
                const TrendIcon = getTrendIcon(trend);
                return (
                  <div
                    key={index}
                    className={`rounded-xl border border-white/20 bg-white/10 backdrop-blur-sm overflow-hidden transition-all hover:bg-white/15 hover:border-white/30 ${compact ? 'p-2.5' : 'p-3'} group ${comingSoon ? 'opacity-50' : ''}`}
                  >
                    <div className={`flex items-center justify-between ${compact ? 'mb-1.5' : 'mb-2'}`}>
                      <div className={`${compact ? 'w-6 h-6' : 'w-7 h-7'} rounded-lg flex items-center justify-center flex-shrink-0 ${comingSoon ? 'bg-white/5' : 'bg-white/15'}`}>
                        <stat.icon className={`${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} ${comingSoon ? 'text-white/30' : 'text-white'}`} />
                      </div>
                      {!comingSoon && (
                        <TrendIcon className={`w-3 h-3 ${getTrendColor(trend).replace('flex', '').trim()}`} />
                      )}
                    </div>
                    <h3 className={`${compact ? 'text-xs' : 'text-sm'} font-semibold ${comingSoon ? 'text-white/40' : 'text-white/90'} mb-0.5 leading-tight`}>
                      {stat.label}
                    </h3>
                    {comingSoon ? (
                      <p className={`${compact ? 'text-xs' : 'text-xs'} text-white/30 italic`}>Pronto</p>
                    ) : (
                      <p className={`${compact ? 'text-base' : 'text-lg'} font-bold text-white leading-tight`}>{stat.value}</p>
                    )}
                  </div>
                );
              })}
          </div>
        )}

        {/* Insights + Recommendations */}
        <div className={`${compact ? 'mt-4' : 'mt-8'} grid grid-cols-1 lg:grid-cols-2 ${compact ? 'gap-3' : 'gap-6'}`}>
          <GlassCard surface="glass" tint="rgba(255, 255, 255, 0.8)" className={`${compact ? 'p-4' : 'p-6'}`}>
            <h3 className={`${compact ? 'text-base' : 'text-xl'} font-bold text-[var(--blue-dark)] mb-3`}>Conclusiones Clave</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-[var(--green)] rounded-full mt-2 flex-shrink-0" />
                <p className={`text-[var(--blue)] ${compact ? 'text-sm' : 'text-base'}`}>{insights.primary}</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-[var(--yellow)] rounded-full mt-2 flex-shrink-0" />
                <p className={`text-[var(--blue)] ${compact ? 'text-sm' : 'text-base'}`}>{insights.secondary}</p>
              </div>
            </div>
          </GlassCard>

          <GlassCard surface="glass" tint="rgba(255, 255, 255, 0.8)" className={`${compact ? 'p-4' : 'p-6'}`}>
            <h3 className={`${compact ? 'text-base' : 'text-xl'} font-bold text-[var(--blue-dark)] mb-3`}>Recomendaciones</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-[var(--blue)] rounded-full mt-2 flex-shrink-0" />
                <p className={`text-[var(--blue)] ${compact ? 'text-sm' : 'text-base'}`}>{recommendations.primary}</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-[var(--orange)] rounded-full mt-2 flex-shrink-0" />
                <p className={`text-[var(--blue)] ${compact ? 'text-sm' : 'text-base'}`}>{recommendations.secondary}</p>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
};

export default CityStats;
