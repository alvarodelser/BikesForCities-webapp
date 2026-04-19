import React from 'react';
import type { CityData } from '../../constants/cities';
import { useViewport } from '../../hooks/useViewport';
import {
  Car,
  MapPin,
  Network,
  Mountain,
  TriangleAlert,
  CircleDot,
} from 'lucide-react';

interface MapFiltersProps {
  city: CityData;
  selectedMode: string;
  onModeChange: (mode: string) => void;
  isModeAvailable: (mode: string) => boolean;
}

interface FilterMode {
  id: string;
  name: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  available: boolean;
  color: string;
}

const filterModes: FilterMode[] = [
  {
    id: 'infrastructure',
    name: 'Infraestructura',
    shortLabel: 'Infra',
    icon: Network,
    description: 'Red de carriles bici y rutas ciclistas',
    available: true,
    color: 'var(--blue)'
  },
  {
    id: 'traffic',
    name: 'Tráfico',
    shortLabel: 'Tráfico',
    icon: Car,
    description: 'Análisis de flujo de tráfico y congestión',
    available: true,
    color: 'var(--red)'
  },
  {
    id: 'stations',
    name: 'Estaciones',
    shortLabel: 'Est.',
    icon: MapPin,
    description: 'Estaciones de bicicletas compartidas',
    available: true,
    color: 'var(--green)'
  },
  {
    id: 'terrain',
    name: 'Terreno',
    shortLabel: 'Ter.',
    icon: Mountain,
    description: 'Datos de elevación y análisis del terreno',
    available: true,
    color: 'var(--orange)'
  },
  {
    id: 'intersections',
    name: 'Intersecciones',
    shortLabel: 'Inter.',
    icon: CircleDot,
    description: 'Cruces y puntos de conflicto vial',
    available: true,
    color: 'var(--yellow)'
  },
  {
    id: 'accidents',
    name: 'Accidentes',
    shortLabel: 'Accid.',
    icon: TriangleAlert,
    description: 'Siniestralidad vial y puntos negros',
    available: true,
    color: 'var(--red)'
  },
];

const MapFilters: React.FC<MapFiltersProps> = ({ city, selectedMode, onModeChange, isModeAvailable }) => {
  const { isMobile } = useViewport();

  if (isMobile) {
    return (
      <div className="flex gap-2 overflow-x-auto px-[var(--space-gutter)] py-2 bg-black/[0.03] border-b border-black/10">
        {filterModes
          .filter(mode => isModeAvailable(mode.id))
          .map(mode => {
            const isActive = selectedMode === mode.id;
            return (
              <button
                key={mode.id}
                onClick={() => onModeChange(mode.id)}
                disabled={!mode.available}
                aria-pressed={isActive}
                className={`shrink-0 flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-semibold whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-[#3a6c7f] text-white border-transparent'
                    : 'bg-white border-black/10 text-black/70'
                }`}
              >
                <mode.icon className="w-3.5 h-3.5" />
                {mode.name}
              </button>
            );
          })}
      </div>
    );
  }

  return (
    <section className="w-full px-[var(--space-gutter)] relative">
      <div>
        {/* Section Header */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-[var(--blue-dark)] mb-2">Herramientas de Análisis</h2>
          <p className="text-lg text-[var(--blue)] opacity-80">Selecciona un modo para analizar diferentes aspectos de la infraestructura ciclista de {city.name}</p>
        </div>

        {/* Filter Modes Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          {filterModes
            .filter(mode => isModeAvailable(mode.id))
            .map((mode) => (
            <button
              key={mode.id}
              onClick={() => onModeChange(mode.id)}
              disabled={!mode.available}
              className={`
                relative p-4 rounded-2xl border-2 transition-all duration-300 group
                ${selectedMode === mode.id 
                  ? `bg-white/90 shadow-lg scale-105` 
                  : 'border-gray-300/40 bg-white/60 hover:bg-white/80 hover:scale-102'
                }
                ${!mode.available ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
              style={{
                borderColor: selectedMode === mode.id ? mode.color : undefined,
                boxShadow: selectedMode === mode.id ? `0 0 20px ${mode.color}40` : undefined
              }}
            >
              {/* Glass reflection effect */}
              <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent rounded-t-2xl pointer-events-none" />
              
              <div className="relative z-10 text-center">
                <div 
                  className={`
                    w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center
                    ${selectedMode === mode.id 
                      ? 'shadow-lg' 
                      : 'bg-white/80 border border-gray-300/50'
                    }
                    group-hover:scale-110 transition-transform duration-300
                  `}
                  style={{
                    background: selectedMode === mode.id ? mode.color : undefined
                  }}
                >
                  <mode.icon 
                    className={`w-6 h-6 ${
                      selectedMode === mode.id ? 'text-white' : 'text-[var(--blue-dark)]'
                    }`} 
                  />
                </div>
                <h3 className={`font-semibold text-sm ${
                  selectedMode === mode.id ? 'text-[var(--blue-dark)]' : 'text-[var(--blue)]'
                }`}>
                  {mode.name}
                </h3>
                {!mode.available && (
                  <span className="text-xs text-[var(--red)] mt-1 block">Próximamente</span>
                )}
              </div>
              
              {/* Bottom highlight */}
              <div 
                className={`absolute bottom-0 left-0 right-0 h-px ${
                  selectedMode === mode.id ? 'opacity-100' : 'opacity-0'
                }`}
                style={{
                  background: selectedMode === mode.id 
                    ? `linear-gradient(to right, transparent, ${mode.color}60, transparent)`
                    : undefined
                }}
              />
            </button>
          ))}
        </div>

      </div>
    </section>
  );
};

export default MapFilters;