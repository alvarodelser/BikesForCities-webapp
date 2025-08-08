import React from 'react';
import type { CityData } from '../../constants/cities';
import { 
  Car, 
  MapPin, 
  Network, 
  Mountain,
  Users, 
  TrendingUp
} from 'lucide-react';

interface MapFiltersProps {
  city: CityData;
  selectedMode: string;
  onModeChange: (mode: string) => void;
}

interface FilterMode {
  id: string;
  name: string;
  icon: React.ComponentType<any>;
  description: string;
  stats: {
    label: string;
    value: string | number;
    unit?: string;
  }[];
  available: boolean;
  color: string;
}

const MapFilters: React.FC<MapFiltersProps> = ({ city, selectedMode, onModeChange }) => {
  // Define available modes and their stats based on city data
  const filterModes: FilterMode[] = [
    {
      id: 'traffic',
      name: 'Traffic Mode',
      icon: Car,
      description: 'Real-time traffic flow and congestion analysis',
      stats: [
        { label: 'Congestion Level', value: 'Medium', unit: '' },
        { label: 'Peak Hours', value: '7-9 AM', unit: '' },
        { label: 'Average Speed', value: 25, unit: 'km/h' }
      ],
      available: true,
      color: 'var(--red)'
    },
    {
      id: 'stations',
      name: 'Bike Stations',
      icon: MapPin,
      description: 'Public bicycle sharing stations and availability',
      stats: [
        { label: 'Total Stations', value: 45, unit: '' },
        { label: 'Available Bikes', value: 320, unit: '' },
        { label: 'Coverage Area', value: 85, unit: '%' }
      ],
      available: true,
      color: 'var(--green)'
    },
    {
      id: 'network',
      name: 'Network Builder',
      icon: Network,
      description: 'Cycling infrastructure planning and optimization',
      stats: [
        { label: 'Current Network', value: city.cyclingNetwork, unit: 'km' },
        { label: 'Planned Extensions', value: 12, unit: 'km' },
        { label: 'Connectivity Score', value: 78, unit: '%' }
      ],
      available: true,
      color: 'var(--blue)'
    },
    {
      id: 'topography',
      name: 'Topography',
      icon: Mountain,
      description: 'Elevation data and terrain analysis',
      stats: [
        { label: 'Average Elevation', value: 650, unit: 'm' },
        { label: 'Max Gradient', value: 8, unit: '%' },
        { label: 'Difficulty Level', value: 'Moderate', unit: '' }
      ],
      available: true,
      color: 'var(--orange)'
    },
    {
      id: 'usage',
      name: 'Usage Analytics',
      icon: TrendingUp,
      description: 'Cycling patterns and user behavior data',
      stats: [
        { label: 'Daily Riders', value: 12500, unit: '' },
        { label: 'Peak Usage', value: '6-8 PM', unit: '' },
        { label: 'Growth Rate', value: 15, unit: '%' }
      ],
      available: true,
      color: 'var(--yellow)'
    },
    {
      id: 'demographics',
      name: 'Demographics',
      icon: Users,
      description: 'Population density and demographic analysis',
      stats: [
        { label: 'Population Density', value: 5200, unit: '/km²' },
        { label: 'Age Distribution', value: '25-45', unit: '' },
        { label: 'Car Ownership', value: 65, unit: '%' }
      ],
      available: true,
      color: 'var(--blue-dark)'
    }
  ];

  const selectedModeData = filterModes.find(mode => mode.id === selectedMode);

  return (
    <section className="w-full px-6 relative">
      <div className="mx-[100px]">
        {/* Section Header */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-[var(--blue-dark)] mb-2">Map Analysis Tools</h2>
          <p className="text-lg text-[var(--blue)] opacity-80">Select a mode to analyze different aspects of {city.name}'s cycling infrastructure</p>
        </div>

        {/* Filter Modes Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          {filterModes.map((mode) => (
            <button
              key={mode.id}
              onClick={() => onModeChange(mode.id)}
              disabled={!mode.available}
              className={`
                relative p-4 rounded-2xl border-2 transition-all duration-300 group
                ${selectedMode === mode.id 
                  ? 'border-[var(--green)] bg-white/90 shadow-lg scale-105' 
                  : 'border-[var(--green)]/20 bg-white/60 hover:border-[var(--green)]/40 hover:bg-white/80 hover:scale-102'
                }
                ${!mode.available ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              {/* Glass reflection effect */}
              <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent rounded-t-2xl pointer-events-none" />
              
              <div className="relative z-10 text-center">
                <div className={`
                  w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center
                  ${selectedMode === mode.id 
                    ? 'bg-gradient-to-r from-[var(--green)] to-[var(--green-dark)] shadow-lg' 
                    : 'bg-white/80 border border-[var(--green)]/30'
                  }
                  group-hover:scale-110 transition-transform duration-300
                `}>
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
                  <span className="text-xs text-[var(--red)] mt-1 block">Coming Soon</span>
                )}
              </div>
              
              {/* Bottom highlight */}
              <div className={`absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[var(--green)]/30 to-transparent ${
                selectedMode === mode.id ? 'opacity-100' : 'opacity-0'
              }`} />
            </button>
          ))}
        </div>

      </div>
    </section>
  );
};

export default MapFilters; 