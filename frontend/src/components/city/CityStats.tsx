import React from 'react';
import type { ModeStats } from '../../constants/cityStats';
import { getTrendColor, getTrendIcon } from '../../constants/cityStats';
import { BarChart3 } from 'lucide-react';
import GlassCard from '../ui/GlassCard';

interface CityStatsProps {
  title: string;
  subtitle: string;
  modeStats: ModeStats;
}

const CityStats: React.FC<CityStatsProps> = ({ title, subtitle, modeStats }) => {
  const { stats, insights, recommendations, overallScore } = modeStats;

  return (
    <div className="w-full bg-white/95 backdrop-blur-md border-t border-[var(--green)]/20">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold text-[var(--blue-dark)] mb-2">{title}</h2>
            <p className="text-[var(--blue)] opacity-80">{subtitle}</p>
          </div>
          
          {/* Summary Card */}
          <GlassCard
            surface="glass"
            tint="rgba(123, 164, 146, 0.9)"
            className="p-6 text-white shadow-lg"
          >
            <div className="flex items-center gap-3 mb-2">
              <BarChart3 className="w-6 h-6" />
              <h3 className="font-semibold">Overall Score</h3>
            </div>
            <p className="text-3xl font-bold">{overallScore.score}/100</p>
            <p className="text-sm opacity-90">{overallScore.label}</p>
          </GlassCard>
        </div>

        {/* Statistics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, index) => {
            const TrendIcon = getTrendIcon(stat.trend);
            return (
              <GlassCard 
                key={index}
                surface="glass"
                interactive
                tint="rgba(255, 255, 255, 0.8)"
                className="p-6 group"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-[var(--green)]/20 rounded-full flex items-center justify-center">
                    <stat.icon className="w-6 h-6 text-[var(--green)]" />
                  </div>
                  <div className={`flex items-center gap-1 ${getTrendColor(stat.trend)}`}>
                    <TrendIcon className="w-4 h-4" />
                  </div>
                </div>
                
                <h3 className="text-lg font-semibold text-[var(--blue-dark)] mb-2">{stat.label}</h3>
                <p className="text-3xl font-bold text-[var(--blue-dark)]">{stat.value}</p>
                
              </GlassCard>
            );
          })}
        </div>

        {/* Additional Insights */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <GlassCard
            surface="glass"
            tint="rgba(255, 255, 255, 0.8)"
            className="p-6"
          >
            <h3 className="text-xl font-bold text-[var(--blue-dark)] mb-4">Key Insights</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-[var(--green)] rounded-full mt-2 flex-shrink-0"></div>
                <p className="text-[var(--blue)]">{insights.primary}</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-[var(--yellow)] rounded-full mt-2 flex-shrink-0"></div>
                <p className="text-[var(--blue)]">{insights.secondary}</p>
              </div>
            </div>
          </GlassCard>

          <GlassCard
            surface="glass"
            tint="rgba(255, 255, 255, 0.8)"
            className="p-6"
          >
            <h3 className="text-xl font-bold text-[var(--blue-dark)] mb-4">Recommendations</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-[var(--blue)] rounded-full mt-2 flex-shrink-0"></div>
                <p className="text-[var(--blue)]">{recommendations.primary}</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-[var(--orange)] rounded-full mt-2 flex-shrink-0"></div>
                <p className="text-[var(--blue)]">{recommendations.secondary}</p>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
};

export default CityStats; 