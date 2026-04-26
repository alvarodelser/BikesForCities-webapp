import React from 'react';
import type { ModeStats } from '../../constants/cityStats';
import { getTrendColor, getTrendIcon } from '../../constants/cityStats';
import { BarChart3, Network, Route } from 'lucide-react';
import GlassCard from '../ui/GlassCard';
import { useMapState } from '../../hooks/useMapState';
import { MAP_MODES } from '../../constants/mapModes';

interface CityStatsProps {
  title: string;
  subtitle: string;
  modeStats: ModeStats;
  compact?: boolean;
}

// ── Traffic computation options ───────────────────────────────────────────────

const GENERATION_OPTIONS = [
  { id: 'population', label: 'Población'  },
  { id: 'pois',       label: 'POIs'       },
  { id: 'mixed',      label: 'Mixto'      },
];

const ROUTING_OPTIONS = [
  { id: 'fastest',  label: 'Más rápida'  },
  { id: 'safest',   label: 'Más segura'  },
  { id: 'balanced', label: 'Equilibrada' },
];

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
      className={`rounded-2xl border bg-white/80 backdrop-blur-sm overflow-hidden transition-all duration-300 ${compact ? '' : ''}`}
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
        <div className="grid grid-cols-3 gap-1.5">
          {options.map(opt => {
            const isActive = active === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => onChange(opt.id)}
                className={`${compact ? 'px-2 py-1.5 text-[10px]' : 'px-2 py-2 text-xs'} rounded-xl font-semibold transition-all border`}
                style={{
                  backgroundColor: isActive ? accent : 'white',
                  borderColor:     isActive ? accent : 'rgba(0,0,0,0.08)',
                  color:           isActive ? 'white' : 'var(--blue-dark)',
                  boxShadow:       isActive ? `0 4px 12px ${accent}40` : undefined,
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

// ── Main component ────────────────────────────────────────────────────────────

const CityStats: React.FC<CityStatsProps> = ({ title, subtitle, modeStats, compact = false }) => {
  const { stats, insights, recommendations, overallScore } = modeStats;
  const { mode, generation, routing, setGeneration, setRouting } = useMapState();
  const isTraffic = mode === MAP_MODES.TRAFFIC;
  const accent = '#AF4749'; // var(--red) resolved

  return (
    <div className={`w-full ${compact ? 'bg-transparent' : ''}`}>
      <div className={`max-w-7xl mx-auto ${compact ? 'px-0 py-4' : 'py-4'}`}>
        {/* Header */}
        <div className={`flex items-center justify-between ${compact ? 'mb-4' : 'mb-8'}`}>
          <div>
            <h2 className={`${compact ? 'text-xl' : 'text-3xl'} font-bold text-[var(--blue-dark)] mb-1`}>{title}</h2>
            <p className={`text-[var(--blue)] opacity-80 ${compact ? 'text-xs' : 'text-base'}`}>{subtitle}</p>
          </div>

          <GlassCard
            surface="glass"
            tint="rgba(123, 164, 146, 0.9)"
            className={`${compact ? 'p-3' : 'p-6'} text-white shadow-lg`}
          >
            <div className={`flex items-center ${compact ? 'gap-2 mb-1' : 'gap-3 mb-2'}`}>
              <BarChart3 className={`${compact ? 'w-4 h-4' : 'w-6 h-6'}`} />
              <h3 className={`${compact ? 'text-xs' : 'text-base'} font-semibold`}>Puntuación</h3>
            </div>
            <p className={`${compact ? 'text-xl' : 'text-3xl'} font-bold`}>{overallScore.score}/100</p>
            <p className={`${compact ? 'text-[10px]' : 'text-sm'} opacity-90`}>{overallScore.label}</p>
          </GlassCard>
        </div>

        {/* Traffic computation cards */}
        {isTraffic && (
          <div className={`grid grid-cols-1 md:grid-cols-2 ${compact ? 'gap-3 mb-4' : 'gap-4 mb-8'}`}>
            <ComputationCard
              icon={Network}
              title="Generación de viajes"
              description="Cómo se estima la demanda origen→destino"
              options={GENERATION_OPTIONS}
              value={generation}
              defaultValue={GENERATION_OPTIONS[0].id}
              accent={accent}
              onChange={setGeneration}
              compact={compact}
            />
            <ComputationCard
              icon={Route}
              title="Cálculo de rutas"
              description="Algoritmo para asignar rutas a la red"
              options={ROUTING_OPTIONS}
              value={routing}
              defaultValue={ROUTING_OPTIONS[0].id}
              accent={accent}
              onChange={setRouting}
              compact={compact}
            />
          </div>
        )}

        {/* Statistics Grid */}
        <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 ${compact ? 'gap-3' : 'gap-6'}`}>
          {stats.map((stat, index) => {
            const TrendIcon = getTrendIcon(stat.trend);
            return (
              <GlassCard
                key={index}
                surface="glass"
                interactive
                tint="rgba(255, 255, 255, 0.8)"
                className={`${compact ? 'p-3' : 'p-6'} group`}
              >
                <div className={`flex items-center justify-between ${compact ? 'mb-2' : 'mb-4'}`}>
                  <div className={`${compact ? 'w-8 h-8' : 'w-12 h-12'} bg-[var(--green)]/20 rounded-full flex items-center justify-center`}>
                    <stat.icon className={`${compact ? 'w-4 h-4' : 'w-6 h-6'} text-[var(--green)]`} />
                  </div>
                  <div className={`flex items-center gap-1 ${getTrendColor(stat.trend)}`}>
                    <TrendIcon className={`${compact ? 'w-3 h-3' : 'w-4 h-4'}`} />
                  </div>
                </div>
                <h3 className={`${compact ? 'text-sm' : 'text-lg'} font-semibold text-[var(--blue-dark)] mb-1`}>{stat.label}</h3>
                <p className={`${compact ? 'text-xl' : 'text-3xl'} font-bold text-[var(--blue-dark)]`}>{stat.value}</p>
              </GlassCard>
            );
          })}
        </div>

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
