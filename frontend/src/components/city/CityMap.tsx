import React from 'react';
import type { CityData } from '../../constants/cities';
import { MapPin, Layers, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface CityMapProps {
  city: CityData;
  selectedMode: string;
}

const CityMap: React.FC<CityMapProps> = ({ city, selectedMode }) => {
  return (
    <div className="w-full h-screen bg-gradient-to-br from-[var(--blue)] to-[var(--blue-dark)] relative overflow-hidden">
      {/* Map Header */}
      <div className="absolute top-0 left-0 right-0 z-20 bg-white/10 backdrop-blur-md border-b border-white/20 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-r from-[var(--green)] to-[var(--green-dark)] rounded-full flex items-center justify-center shadow-lg">
              <MapPin className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{city.name} Cycling Infrastructure</h1>
              <p className="text-white/80 capitalize">{selectedMode.replace('-', ' ')} Mode</p>
            </div>
          </div>
          
          {/* Map Controls */}
          <div className="flex items-center gap-3">
            <button className="bg-white/20 backdrop-blur-sm border border-white/30 text-white p-3 rounded-full hover:bg-white/30 transition-all duration-300">
              <Layers className="w-5 h-5" />
            </button>
            <button className="bg-white/20 backdrop-blur-sm border border-white/30 text-white p-3 rounded-full hover:bg-white/30 transition-all duration-300">
              <ZoomIn className="w-5 h-5" />
            </button>
            <button className="bg-white/20 backdrop-blur-sm border border-white/30 text-white p-3 rounded-full hover:bg-white/30 transition-all duration-300">
              <ZoomOut className="w-5 h-5" />
            </button>
            <button className="bg-white/20 backdrop-blur-sm border border-white/30 text-white p-3 rounded-full hover:bg-white/30 transition-all duration-300">
              <RotateCcw className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Map Container */}
      <div className="w-full h-full pt-20">
        {/* Map Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent"></div>
        </div>

        {/* Map Content */}
        <div className="relative w-full h-full flex items-center justify-center">
          {/* Map Placeholder */}
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-8 text-center max-w-2xl mx-8">
            <div className="w-24 h-24 bg-gradient-to-r from-[var(--green)] to-[var(--green-dark)] rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
              <MapPin className="w-12 h-12 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-4">Interactive Map</h2>
            <p className="text-xl text-white/80 mb-6">
              {selectedMode === 'traffic' && 'Real-time traffic flow visualization'}
              {selectedMode === 'stations' && 'Bike sharing stations and availability'}
              {selectedMode === 'network' && 'Cycling infrastructure network analysis'}
              {selectedMode === 'topography' && 'Elevation and terrain mapping'}
              {selectedMode === 'usage' && 'Cycling usage patterns and analytics'}
              {selectedMode === 'demographics' && 'Population density and demographics'}
            </p>
            <div className="bg-white/10 rounded-xl p-4 border border-white/20">
              <p className="text-white/70">
                Map integration coming soon... This will display an interactive map of {city.name} 
                with {selectedMode.replace('-', ' ')} data overlay.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Map Legend */}
      <div className="absolute bottom-4 left-4 z-20 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-4">
        <h3 className="text-white font-semibold mb-3">Legend</h3>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-[var(--green)] rounded-full"></div>
            <span className="text-white/80 text-sm">Cycling Routes</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-[var(--yellow)] rounded-full"></div>
            <span className="text-white/80 text-sm">Bike Stations</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-[var(--blue)] rounded-full"></div>
            <span className="text-white/80 text-sm">Traffic Data</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CityMap; 