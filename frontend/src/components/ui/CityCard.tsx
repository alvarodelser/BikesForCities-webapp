import React from 'react';
import { useNavigate } from 'react-router';
import type { CityData } from '../../constants/cities';

interface CityCardProps {
  city: CityData;
  position: number;
  onClick?: () => void;
}

const CityCard: React.FC<CityCardProps> = ({ 
  city, 
  position,
  onClick 
}) => {
  const navigate = useNavigate();
  const distance = Math.abs(position);
  
  // Calculate scale based on distance from center
  const getScale = () => {
    if (distance === 0) return 1.1; // center card
    if (distance === 1) return 0.95; // adjacent cards
    if (distance === 2) return 0.8; // second tier
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
      className="absolute top-0 flex-shrink-0 cursor-pointer select-none transition-all duration-500 ease-out"
      style={{ 
        transform: `translateX(${position * 320}px) translateY(10vh) scale(${scale})`,
        opacity: opacity,
        zIndex: distance === 0 ? 10 : 10 - distance
      }}
    >
      <div className={`
        w-[300px] h-[40vh] 
        bg-white/10 backdrop-blur-md
        border border-white/20
        rounded-2xl shadow-2xl 
        p-6 
        flex flex-col 
        hover:bg-white/15
        hover:border-white/30
        relative overflow-hidden
        ${distance === 0 ? 'border-[var(--green)]/40 shadow-[0_0_30px_rgba(63,122,186,0.3)] bg-white/20' : ''}
      `}>
        {/* Glass reflection effect */}
        <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent rounded-t-2xl pointer-events-none" />
        
        <h2 className={`font-bold text-white text-center relative z-10 drop-shadow-lg mb-4 ${
          distance === 0 ? 'text-2xl' : distance === 1 ? 'text-xl' : 'text-lg'
        }`}>
          {city.name}
        </h2>
        
        <div className="grid grid-rows-2 grid-cols-2 gap-4 relative z-10 flex-1 mb-4">
          <div className="border border-white/20 p-4 rounded-2xl transition-all duration-300"
               style={{
                 boxShadow: 'inset 1px 1px 4px rgba(0,0,0,0.2), inset -1px -1px 4px rgba(255,255,255,0.05)'
               }}>
            <h3 className={`font-semibold text-white/95 mb-2 drop-shadow-lg ${
              distance === 0 ? 'text-sm' : 'text-xs'
            }`}>
              Población
            </h3>
            <p className={`font-bold text-white drop-shadow-lg ${
              distance === 0 ? 'text-lg' : 'text-base'
            }`}>
              {formatPopulation(city.population)}
            </p>
          </div>

          <div className="border border-white/20 p-4 rounded-2xl transition-all duration-300"
               style={{
                 boxShadow: 'inset 1px 1px 4px rgba(0,0,0,0.2), inset -1px -1px 4px rgba(255,255,255,0.05)'
               }}>
            <h3 className={`font-semibold text-white/95 mb-2 drop-shadow-lg ${
              distance === 0 ? 'text-sm' : 'text-xs'
            }`}>
              Presupuesto
            </h3>
            <p className={`font-bold text-white drop-shadow-lg ${
              distance === 0 ? 'text-lg' : 'text-base'
            }`}>
              {formatBudget(city.budget)}
            </p>
          </div>
          
          <div className="border border-white/20 p-4 rounded-2xl transition-all duration-300"
               style={{
                 boxShadow: 'inset 1px 1px 4px rgba(0,0,0,0.2), inset -1px -1px 4px rgba(255,255,255,0.05)'
               }}>
            <h3 className={`font-semibold text-white/95 mb-2 drop-shadow-lg ${
              distance === 0 ? 'text-sm' : 'text-xs'
            }`}>
              Red Ciclista
            </h3>
            <p className={`font-bold text-white drop-shadow-lg ${
              distance === 0 ? 'text-lg' : 'text-base'
            }`}>
              {city.cyclingNetwork}km
            </p>
          </div>

          <div className="border border-white/20 p-4 rounded-2xl transition-all duration-300"
               style={{
                 boxShadow: 'inset 1px 1px 4px rgba(0,0,0,0.2), inset -1px -1px 4px rgba(255,255,255,0.05)'
               }}>
            <h3 className={`font-semibold text-white/95 mb-2 drop-shadow-lg ${
              distance === 0 ? 'text-sm' : 'text-xs'
            }`}>
              Cobertura
            </h3>
            <p className={`font-bold text-white drop-shadow-lg ${
              distance === 0 ? 'text-lg' : 'text-base'
            }`}>
              {city.coverage}%
            </p>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-4 relative z-10">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              navigate(city.path);
            }}
            className="flex-1 bg-[var(--green)]/60 hover:bg-[var(--green)]/70 border border-[var(--green)]/80 hover:border-[var(--green)]/90 text-white font-bold py-3 px-6 rounded-2xl transition-all duration-300 backdrop-blur-lg shadow-lg hover:shadow-xl hover:scale-105 relative overflow-hidden group"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white/15 to-transparent opacity-50 group-hover:opacity-70 transition-opacity duration-300 rounded-2xl"></div>
            <span className="relative z-10 drop-shadow-lg">Entrar</span>
          </button>
          <button className="flex-1 bg-[var(--yellow)]/60 hover:bg-[var(--yellow)]/70 border border-[var(--yellow)]/80 hover:border-[var(--yellow)]/90 text-white font-bold py-3 px-6 rounded-2xl transition-all duration-300 backdrop-blur-lg shadow-lg hover:shadow-xl hover:scale-105 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-r from-white/15 to-transparent opacity-50 group-hover:opacity-70 transition-opacity duration-300 rounded-2xl"></div>
            <span className="relative z-10 drop-shadow-lg">Comparar</span>
          </button>
        </div>


        {/* Bottom glass highlight */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
      </div>
    </div>
  );
};

export default CityCard; 