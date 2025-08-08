import React, { useState } from 'react';
import type { CityData } from '../../constants/cities';
import { getModeStats } from '../../constants/cityStats';
import MapFilters from './MapFilters';
import CityMap from './CityMap';
import CityStats from './CityStats';

interface MapSectionProps {
  city: CityData;
}

const MapSection: React.FC<MapSectionProps> = ({ city }) => {
  const [selectedMode, setSelectedMode] = useState<string>('traffic');

  // Get the stats data for the selected mode
  const modeStats = getModeStats(selectedMode, city);
  const title = `${selectedMode.charAt(0).toUpperCase() + selectedMode.slice(1).replace('-', ' ')} Statistics`;
  const subtitle = `Detailed analytics for ${city.name}'s ${selectedMode.replace('-', ' ')} data`;

  return (
    <div className="w-full">
      {/* Map Filters */}
      <MapFilters 
        city={city} 
        selectedMode={selectedMode} 
        onModeChange={setSelectedMode} 
      />
      
      {/* Map */}
      <CityMap 
        city={city} 
        selectedMode={selectedMode} 
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