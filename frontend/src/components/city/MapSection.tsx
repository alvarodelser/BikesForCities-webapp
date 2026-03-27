import React from 'react';
import { useSearchParams } from 'react-router';
import type { CityData } from '../../constants/cities';
import { getModeStats } from '../../constants/cityStats';
import MapFilters from './MapFilters';
import CityMap from './CityMap';
import CityStats from './CityStats';

interface MapSectionProps {
  city: CityData;
}

const MapSection: React.FC<MapSectionProps> = ({ city }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Define the mode names for validation
  const modeNames: Record<string, string> = {
    'infrastructure': 'Infraestructura',
    'traffic': 'Tráfico',
    'stations': 'Estaciones',
    'terrain': 'Terreno',
    'intersections': 'Intersecciones',
    'accidents': 'Accidentes'
  };

  // Get and validate mode from URL
  const modeParam = searchParams.get('mode');
  const selectedMode = (modeParam && modeNames[modeParam]) ? modeParam : 'infrastructure';

  const handleModeChange = (newMode: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('mode', newMode);
      return next;
    }, { replace: true });
  };

  // Define the mode colors (matching MapFilters)
  const modeColors: Record<string, string> = {
    'infrastructure': 'var(--blue)',
    'traffic': 'var(--red)',
    'stations': 'var(--green)',
    'terrain': 'var(--orange)',
    'intersections': 'var(--yellow)',
    'accidents': 'var(--red)'
  };

  // Get the stats data for the selected mode
  const modeStats = getModeStats(selectedMode, city);
  const modeName = modeNames[selectedMode] || selectedMode;
  const title = `Estadísticas de ${modeName}`;
  const subtitle = `Análisis detallado de datos de ${modeName.toLowerCase()} en ${city.name}`;
  const selectedColor = modeColors[selectedMode] || 'var(--blue)';

  return (
    <div className="w-full">
      {/* Map Filters */}
      <MapFilters 
        city={city} 
        selectedMode={selectedMode} 
        onModeChange={handleModeChange} 
      />
      
      {/* Map */}
      <CityMap 
        city={city} 
        selectedMode={selectedMode}
        selectedColor={selectedColor}
      />
      
      {/* Statistics */}
      <CityStats 
        title={title}
        subtitle={subtitle}
        modeStats={modeStats}
      />
    </div>
  );
};

export default MapSection; 