import React from 'react';
import type { CityData } from '../../constants/cities';
import landingHeroImage from '../../assets/outline.png';
import backgroundTexture from '../../assets/background2.svg';
import { Users, Euro, Bike, Percent } from 'lucide-react';
import GlassCard from '../ui/GlassCard';

interface OverviewSectionProps {
  city: CityData;
}

const OverviewSection: React.FC<OverviewSectionProps> = ({ city }) => {

  return (
    <section 
      className="w-full flex items-center justify-center px-6 relative"
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
      
      <div className="relative w-full z-10">
        {/* Title */}
        <h1
          className="text-[6vw] font-heading font-bold leading-tight bg-gradient-to-b from-[var(--blue-dark)] to-[var(--blue)] bg-clip-text text-transparent my-[0px] mx-[120px]"
        >
          {city.name}
        </h1>

        {/* Image */}
        <div 
          className="h-[300px] bg-cover bg-center rounded-sm mx-[100px] -mt-[20px]"
          style={{
            backgroundImage: `url(${landingHeroImage})`,
            backgroundPosition: 'center center'
          }}
        ></div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-12 mb-12 mx-[100px]">
          <GlassCard
            surface="glass"
            interactive
            className="p-6 group"
          >
            <div className="flex items-center gap-3 mb-4 relative z-10">
              <div className="w-12 h-12 bg-gradient-to-r from-[var(--green)] to-[var(--green-dark)] rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                <Users className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-[var(--blue-dark)]">Population</h3>
            </div>
            <p className="text-3xl font-bold text-[var(--blue-dark)] relative z-10">
              {city.population >= 1000000 
                ? `${(city.population / 1000000).toFixed(1)}M` 
                : `${(city.population / 1000).toFixed(0)}K`
              }
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
              <h3 className="text-lg font-semibold text-[var(--blue-dark)]">Budget</h3>
            </div>
            <p className="text-3xl font-bold text-[var(--blue-dark)] relative z-10">
              {city.budget >= 1000000 
                ? `${(city.budget / 1000000).toFixed(1)}M€` 
                : `${(city.budget / 1000).toFixed(0)}K€`
              }
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
              <h3 className="text-lg font-semibold text-[var(--blue-dark)]">Cycling Network</h3>
            </div>
            <p className="text-3xl font-bold text-[var(--blue-dark)] relative z-10">{city.cyclingNetwork}km</p>
            
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
              <h3 className="text-lg font-semibold text-[var(--blue-dark)]">Coverage</h3>
            </div>
            <p className="text-3xl font-bold text-[var(--blue-dark)] relative z-10">{city.coverage}%</p>
            
          </GlassCard>
        </div>
      </div>
    </section>
  );
};

export default OverviewSection; 