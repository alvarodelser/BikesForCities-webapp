import React from 'react';
import type { ModeStats } from '../../constants/cityStats';
import { getTrendColor, getTrendIcon } from '../../constants/cityStats';
import { BarChart3 } from 'lucide-react';
import GlassCard from '../ui/GlassCard';

interface CityStatsProps {
  title: string;
  subtitle: string;
  modeStats: ModeStats;
  compact?: boolean;
}

const CityStats: React.FC<CityStatsProps> = ({ title, subtitle, modeStats, compact = false }) => {
  const { stats, insights, recommendations, overallScore } = modeStats;

  return (
    <div className={`w-full ${compact ? 'bg-transparent' : 'bg-white/95 backdrop-blur-md border-t border-[var(--green)]/20'} ${compact ? 'py-0' : ''}`}>
      <div className={`max-w-7xl mx-auto ${compact ? 'px-0 py-4' : 'px-6 py-8'}`}>
        {/* Header */}
        <div className={`flex items-center justify-between ${compact ? 'mb-4' : 'mb-8'}`}>
          <div>
            <h2 className={`${compact ? 'text-xl' : 'text-3xl'} font-bold text-[var(--blue-dark)] mb-1`}>{title}</h2>
            <p className={`text-[var(--blue)] opacity-80 ${compact ? 'text-xs' : 'text-base'}`}>{subtitle}</p>
          </div>
          
          {/* Summary Card */}
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

        {/* Additional Insights */}
        <div className={`${compact ? 'mt-4' : 'mt-8'} grid grid-cols-1 lg:grid-cols-2 ${compact ? 'gap-3' : 'gap-6'}`}>
          <GlassCard
            surface="glass"
            tint="rgba(255, 255, 255, 0.8)"
            className={`${compact ? 'p-4' : 'p-6'}`}
          >
            <h3 className={`${compact ? 'text-base' : 'text-xl'} font-bold text-[var(--blue-dark)] mb-3`}>Conclusiones Clave</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-[var(--green)] rounded-full mt-2 flex-shrink-0"></div>
                <p className={`text-[var(--blue)] ${compact ? 'text-sm' : 'text-base'}`}>{insights.primary}</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-[var(--yellow)] rounded-full mt-2 flex-shrink-0"></div>
                <p className={`text-[var(--blue)] ${compact ? 'text-sm' : 'text-base'}`}>{insights.secondary}</p>
              </div>
            </div>
          </GlassCard>

          <GlassCard
            surface="glass"
            tint="rgba(255, 255, 255, 0.8)"
            className={`${compact ? 'p-4' : 'p-6'}`}
          >
            <h3 className={`${compact ? 'text-base' : 'text-xl'} font-bold text-[var(--blue-dark)] mb-3`}>Recomendaciones</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-[var(--blue)] rounded-full mt-2 flex-shrink-0"></div>
                <p className={`text-[var(--blue)] ${compact ? 'text-sm' : 'text-base'}`}>{recommendations.primary}</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-[var(--orange)] rounded-full mt-2 flex-shrink-0"></div>
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