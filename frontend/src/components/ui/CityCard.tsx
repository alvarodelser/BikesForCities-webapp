import React from 'react';
import type { CityData } from '../../constants/cities';
import { GlassCard } from './GlassCard';
import { FlatCard } from './FlatCard';
import { formatPopulation, formatCurrency, formatDistance, formatPercentage } from '../../utils/formatters';

interface CityCardProps {
  city: CityData;
  /**
   * position: carousel offset index (0 = center, ±1, ±2 …)
   * When used inside SideCardTail pass position={0} and panel={true} to opt out of carousel transforms.
   */
  position: number;
  /** If true the card fills its container with no carousel transforms (for use in SideCardTail). */
  panel?: boolean;
  onClick?: () => void;
  onCityNavigate?: (cityName: string) => void;
}

const CityCard: React.FC<CityCardProps> = ({ 
  city, 
  position,
  panel = false,
  onClick,
  onCityNavigate
}) => {
  const distance = Math.abs(position);
  
  // Calculate scale based on distance from center (carousel mode only)
  const getScale = () => {
    if (distance === 0) return 1;
    if (distance === 1) return 0.8;
    if (distance === 2) return 0.7;
    return 0.6;
  };

  // Calculate opacity based on distance from center (carousel mode only)
  const getOpacity = () => {
    if (distance === 0) return 1;
    if (distance === 1) return 0.9;
    if (distance === 2) return 0.7;
    if (distance <= 4) return 0.4;
    return 0;
  };

  const scale = getScale();
  const opacity = getOpacity();

  // ── Panel mode (used in SideCardTail desktop connector card) ─────────────
  if (panel) {
    return (
      <GlassCard
        surface="glass"
        interactive
        size="lg"
        tint="rgba(255, 255, 255, 0.18)"
        blurStrength="lg"
        shadow="lg"
        className="w-full flex flex-col border-white/30"
        onClick={onClick}
      >
        {/* City name */}
        <h2 className="font-bold text-white text-xl text-center relative z-10 drop-shadow-lg mb-4">
          {city.name}
        </h2>

        {/* Stats grid */}
        <div className="grid grid-rows-2 grid-cols-2 gap-3 relative z-10 flex-1 mb-4">
          <GlassCard surface="inset" size="sm" depth="lg" className="text-center">
            <h3 className="font-semibold text-white/90 mb-1 text-xs">Población</h3>
            <p className="font-bold text-white text-sm">{formatPopulation(city.population)}</p>
          </GlassCard>

          <GlassCard surface="inset" size="sm" depth="lg" className="text-center">
            <h3 className="font-semibold text-white/90 mb-1 text-xs">Presupuesto</h3>
            <p className="font-bold text-white text-sm">{formatCurrency(city.budget)}</p>
          </GlassCard>

          <GlassCard surface="inset" size="sm" depth="lg" className="text-center">
            <h3 className="font-semibold text-white/90 mb-1 text-xs">Red Ciclista</h3>
            <p className="font-bold text-white text-sm">{formatDistance(city.cyclingNetwork)} km</p>
          </GlassCard>

          <GlassCard surface="inset" size="sm" depth="lg" className="text-center">
            <h3 className="font-semibold text-white/90 mb-1 text-xs">Cobertura</h3>
            <p className="font-bold text-white text-sm">{formatPercentage(city.coverage)}%</p>
          </GlassCard>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 relative z-10">
          <FlatCard
            onClick={() => onCityNavigate?.(city.name)}
            interactive
            gradient={{ from: 'var(--green)', to: 'var(--green-dark)', direction: 'b' }}
            size="sm"
            shadow="sm"
            border="none"
            hoverBorderColor="var(--red)"
            className="flex-1 cursor-pointer flex items-center justify-center"
          >
            <span className="text-white font-bold">Mapa</span>
          </FlatCard>
          <FlatCard
            onClick={() => { /* Compare */ }}
            interactive
            gradient={{ from: 'var(--blue)', to: 'var(--blue-dark)', direction: 'b' }}
            size="sm"
            shadow="sm"
            border="none"
            className="flex-1 cursor-pointer flex items-center justify-center"
          >
            <span className="text-white font-bold">Compara</span>
          </FlatCard>
        </div>
      </GlassCard>
    );
  }

  // ── Carousel mode ─────────────────────────────────────────────────────────
  return (
    <div 
      onClick={onClick}
      className="absolute top-0 flex-shrink-0 cursor-pointer select-none transition-all duration-500 ease-out transform-gpu perspective-1000"
      style={{ 
        transform: `translateX(${position * 290}px) translateY(2vh) scale(${scale})`,
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
          w-[270px] h-[340px] flex flex-col
          ${distance === 0 ? 'border-[var(--green)]/40 shadow-[0_0_30px_rgba(63,122,186,0.3)]' : ''}
        `}
      >
        
        <h2 className={`font-bold text-white text-center relative z-10 drop-shadow-lg mb-3 ${
          distance === 0 ? 'text-xl' : distance === 1 ? 'text-lg' : 'text-base'
        }`}>
          {city.name}
        </h2>
        
        <div className="grid grid-rows-2 grid-cols-2 gap-3 relative z-10 flex-1 mb-3">
          <GlassCard surface="inset" size="sm" depth="lg" className="text-center h-[65px]">
            <h3 className="font-semibold text-white/95 mb-1 drop-shadow-lg text-[10px]">
              Población
            </h3>
            <p className="font-bold text-white drop-shadow-lg text-sm">
              {formatPopulation(city.population)}
            </p>
          </GlassCard>

          <GlassCard surface="inset" size="sm" depth="lg" className="text-center h-[65px]">
            <h3 className="font-semibold text-white/95 mb-1 drop-shadow-lg text-[10px]">
              Presupuesto
            </h3>
            <p className="font-bold text-white drop-shadow-lg text-sm">
              {formatCurrency(city.budget)}
            </p>
          </GlassCard>
          
          <GlassCard surface="inset" size="sm" depth="lg" className="text-center h-[65px]">
            <h3 className="font-semibold text-white/95 mb-1 drop-shadow-lg text-[10px]">
              Red Ciclista
            </h3>
            <p className="font-bold text-white drop-shadow-lg text-sm">
              {formatDistance(city.cyclingNetwork)}km
            </p>
          </GlassCard>

          <GlassCard surface="inset" size="sm" depth="lg" className="text-center h-[65px]">
            <h3 className="font-semibold text-white/95 mb-1 drop-shadow-lg text-[10px]">
              Cobertura
            </h3>
            <p className="font-bold text-white drop-shadow-lg text-sm">
              {formatPercentage(city.coverage)}%
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