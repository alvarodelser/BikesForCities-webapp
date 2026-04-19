import React from 'react';
import type { CityData } from '../../constants/cities';
import backgroundTexture from '../../assets/background2.svg';
import { Users, Euro, Bike, Percent } from 'lucide-react';
import GlassCard from '../ui/GlassCard';
import { formatPopulation, formatDistance, formatPercentage, formatCurrency } from '../../utils/formatters';

interface OverviewSectionProps {
  city: CityData;
}

const OverviewSection: React.FC<OverviewSectionProps> = ({ city }) => {

  return (
    <section
      className="w-full flex items-center justify-center px-[var(--space-gutter)] py-[var(--space-section-y)] relative"
      style={{
        backgroundColor: 'var(--cream)',
      }}
    >
      {/* Background texture extending upward to cover navbar */}
      <div
        className="absolute pointer-events-none"
        style={{
          backgroundImage: `url(${backgroundTexture})`,
          backgroundSize: '600px 600px',
          backgroundPosition: 'top left',
          backgroundRepeat: 'repeat',
          top: -145, // Extend upward to cover navbar
          left: 0,
          right: 0,
          bottom: 0,
          opacity: 0.07
        }}
      />

      <div className="relative w-full z-10 mt-32 md:mt-[80px]">
        {/* Title */}
        <h1
          className="text-[6vw] font-heading font-bold leading-tight bg-gradient-to-b from-[var(--blue-dark)] to-[var(--blue)] bg-clip-text text-transparent my-[0px]"
        >
          {city.name}
        </h1>

        {/* Image */}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-12 mb-12">
          <GlassCard
            surface="glass"
            interactive
            className="p-6 group"
          >
            <div className="flex items-center gap-3 mb-4 relative z-10">
              <div className="w-12 h-12 bg-gradient-to-r from-[var(--green)] to-[var(--green-dark)] rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                <Users className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-[var(--blue-dark)]">Población</h3>
            </div>
            <p className="text-3xl font-bold text-[var(--blue-dark)] relative z-10">
              {formatPopulation(city.population)}
            </p>

          </GlassCard>

          <GlassCard
            surface="glass"
            interactive
            className="p-6 group"
          >
            <div className="flex items-center gap-3 mb-4 relative z-10">
              <div className="w-12 h-12 bg-gradient-to-r from-[var(--yellow)] to-[var(--orange)] rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                <Euro className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-[var(--blue-dark)]">Presupuesto</h3>
            </div>
            <p className="text-3xl font-bold text-[var(--blue-dark)] relative z-10">
              {formatCurrency(city.budget)}
            </p>

          </GlassCard>

          <GlassCard
            surface="glass"
            interactive
            className="p-6 group"
          >
            <div className="flex items-center gap-3 mb-4 relative z-10">
              <div className="w-12 h-12 bg-gradient-to-r from-[var(--green)] to-[var(--green-dark)] rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                <Bike className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-[var(--blue-dark)]">Red Ciclista</h3>
            </div>
            <p className="text-3xl font-bold text-[var(--blue-dark)] relative z-10">{formatDistance(city.cyclingNetwork)}km</p>

          </GlassCard>

          <GlassCard
            surface="glass"
            interactive
            className="p-6 group"
          >
            <div className="flex items-center gap-3 mb-4 relative z-10">
              <div className="w-12 h-12 bg-gradient-to-r from-[var(--yellow)] to-[var(--orange)] rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                <Percent className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-[var(--blue-dark)]">Cobertura</h3>
            </div>
            <p className="text-3xl font-bold text-[var(--blue-dark)] relative z-10">{formatPercentage(city.coverage)}%</p>

          </GlassCard>
        </div>
      </div>
    </section>
  );
};

export default OverviewSection; 