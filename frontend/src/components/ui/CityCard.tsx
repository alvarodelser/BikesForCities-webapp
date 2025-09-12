import React from 'react';
import type { CityData } from '../../constants/cities';
import { GlassCard } from './GlassCard';
import { FlatCard } from './FlatCard';

interface CityCardProps {
  city: CityData;
  position: number;
  onClick?: () => void;
  onCityNavigate?: (cityName: string) => void;
}

const CityCard: React.FC<CityCardProps> = ({ 
  city, 
  position,
  onClick,
  onCityNavigate
}) => {
  const distance = Math.abs(position);
  
  // Calculate scale based on distance from center
  const getScale = () => {
    if (distance === 0) return 1; // center card
    if (distance === 1) return 0.8; // adjacent cards
    if (distance === 2) return 0.7; // second tier
    return 0.6; // distant cards
  };

  // Calculate opacity based on distance from center
  const getOpacity = () => {
    if (distance === 0) return 1; // center card
    if (distance === 1) return 0.9; // adjacent cards
    if (distance === 2) return 0.7; // second tier
    if (distance <= 4) return 0.4; // visible but faded
    return 0; // hidden
  };

  const scale = getScale();
  const opacity = getOpacity();

  // Format numbers for display
  const formatPopulation = (pop: number) => {
    if (pop >= 1000000) return `${(pop / 1000000).toFixed(1)}M`;
    if (pop >= 1000) return `${(pop / 1000).toFixed(0)}K`;
    return pop.toString();
  };

  const formatBudget = (budget: number) => {
    if (budget >= 1000000) return `${(budget / 1000000).toFixed(1)}M€`;
    if (budget >= 1000) return `${(budget / 1000).toFixed(0)}K€`;
    return `${budget}€`;
  };

  return (
    <div 
      onClick={onClick}
      className="absolute top-0 flex-shrink-0 cursor-pointer select-none transition-all duration-500 ease-out transform-gpu perspective-1000"
      style={{ 
        transform: `translateX(${position * 320}px) translateY(10vh) scale(${scale})`,
        opacity: opacity,
        zIndex: distance === 0 ? 10 : 10 - distance,
        willChange: 'transform, opacity',
        backfaceVisibility: 'hidden',
        transformStyle: 'preserve-3d'
      }}
    >
      <GlassCard 
        surface="glass"
        interactive
        size="lg"
        tint={distance === 0 ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.15)'}
        blurStrength="md"
        shadow="lg"
        className={`
          w-[300px] h-[400px] flex flex-col
          ${distance === 0 ? 'border-[var(--green)]/40 shadow-[0_0_30px_rgba(63,122,186,0.3)]' : ''}
        `}
      >
        
        <h2 className={`font-bold text-white text-center relative z-10 drop-shadow-lg mb-4 ${
          distance === 0 ? 'text-2xl' : distance === 1 ? 'text-xl' : 'text-lg'
        }`}>
          {city.name}
        </h2>
        
        <div className="grid grid-rows-2 grid-cols-2 gap-4 relative z-10 flex-1 mb-4">
          <GlassCard surface="inset" size="sm" depth="lg" className="text-center h-[80px]">
            <h3 className="font-semibold text-white/95 mb-2 drop-shadow-lg text-xs">
              Población
            </h3>
            <p className="font-bold text-white drop-shadow-lg text-base">
              {formatPopulation(city.population)}
            </p>
          </GlassCard>

          <GlassCard surface="inset" size="sm" depth="lg" className="text-center h-[80px]">
            <h3 className="font-semibold text-white/95 mb-2 drop-shadow-lg text-xs">
              Presupuesto
            </h3>
            <p className="font-bold text-white drop-shadow-lg text-base">
              {formatBudget(city.budget)}
            </p>
          </GlassCard>
          
          <GlassCard surface="inset" size="sm" depth="lg" className="text-center h-[80px]">
            <h3 className="font-semibold text-white/95 mb-2 drop-shadow-lg text-xs">
              Red Ciclista
            </h3>
            <p className="font-bold text-white drop-shadow-lg text-base">
              {city.cyclingNetwork}km
            </p>
          </GlassCard>

          <GlassCard surface="inset" size="sm" depth="lg" className="text-center h-[80px]">
            <h3 className="font-semibold text-white/95 mb-2 drop-shadow-lg text-xs">
              Cobertura
            </h3>
            <p className="font-bold text-white drop-shadow-lg text-base">
              {city.coverage}%
            </p>
          </GlassCard>
        </div>

        {/* Buttons */}
        <div className="flex gap-4 relative z-10">
          <FlatCard 
            onClick={() => {
              onCityNavigate?.(city.name);
            }}
            interactive
            gradient={{
              from: 'var(--green)',
              to: 'var(--green-dark)',
              direction: 'b'
            }}
            size="sm"
            shadow="sm"
            border="none"
            hoverBorderColor='var(--red)'
            className="flex-1 cursor-pointer flex items-center justify-center"
          >
            <span className="text-white font-bold">Mapa</span>
          </FlatCard>
          <FlatCard 
            onClick={() => {
              // Compare functionality to be implemented
            }}
            interactive
            gradient={{
              from: 'var(--blue)',
              to: 'var(--blue-dark)',
              direction: 'b'
            }}
            size="sm"
            shadow="sm"
            border="none"
            className="flex-1 cursor-pointer flex items-center justify-center"
          >
            <span className="text-white font-bold">Compara</span>
          </FlatCard>
        </div>
      </GlassCard>
    </div>
  );
};

export default CityCard; 