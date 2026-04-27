import React from 'react';
import type { CityData } from '../../constants/cities';
import CityStats from './CityStats';
import { useMapState } from '../../hooks/useMapState';
import { getModeStats } from '../../constants/cityStats';
import { Users, Euro, Bike, Percent } from 'lucide-react';
import GlassCard from '../ui/GlassCard';
import { formatPopulation, formatDistance, formatPercentage, formatCurrency } from '../../utils/formatters';

import { MAP_MODES } from '../../constants/mapModes';

interface MapSheetContentProps {
  city: CityData;
}

const modeNames: Record<string, string> = {
  [MAP_MODES.INFRASTRUCTURE]: 'Infraestructura',
  [MAP_MODES.TRAFFIC]:        'Tráfico',
  [MAP_MODES.STATIONS]:       'Estaciones',
  [MAP_MODES.TERRAIN]:        'Terreno',
  [MAP_MODES.INTERSECTIONS]:  'Intersecciones',
  [MAP_MODES.ACCIDENTS]:      'Accidentes',
};

export const MapSheetContent: React.FC<MapSheetContentProps> = ({ city }) => {
  const { mode } = useMapState();

  const modeStats = getModeStats(mode, city);
  const modeName  = modeNames[mode] || mode;
  const title    = `Estadísticas de ${modeName}`;
  const subtitle = `Análisis detallado de datos de ${modeName.toLowerCase()} en ${city.name}`;

  return (
    <div className="flex flex-col gap-4">
      {/* Quick city stats — compact cards */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { icon: Users, label: 'Población', value: formatPopulation(city.population), gradient: 'from-[var(--green)] to-[var(--green-dark)]' },
          { icon: Euro, label: 'Presupuesto', value: formatCurrency(city.budget), gradient: 'from-[var(--yellow)] to-[var(--orange)]' },
          { icon: Bike, label: 'Red Ciclista', value: `${formatDistance(city.cyclingNetwork)} km`, gradient: 'from-[var(--green)] to-[var(--green-dark)]' },
          { icon: Percent, label: 'Cobertura', value: `${formatPercentage(city.coverage)}%`, gradient: 'from-[var(--yellow)] to-[var(--orange)]' },
        ].map(({ icon: Icon, label, value, gradient }) => (
          <GlassCard
            key={label}
            surface="glass"
            className="p-3 flex items-center gap-3"
          >
            <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center shadow-sm flex-shrink-0`}>
              <Icon className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-widest text-[var(--blue-dark)]/50 font-bold">{label}</p>
              <p className="text-sm font-bold text-[var(--blue-dark)] leading-tight">{value}</p>
            </div>
          </GlassCard>
        ))}
      </div>

      {/* Mode-specific stats */}
      <CityStats city={city} title={title} subtitle={subtitle} modeStats={modeStats} compact={true} />
    </div>
  );
};

export default MapSheetContent;
