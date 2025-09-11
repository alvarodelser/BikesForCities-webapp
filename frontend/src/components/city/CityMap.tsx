import React from 'react';
import type { CityData } from '../../constants/cities';
import { MapPin, Layers, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import GlassCard from '../ui/GlassCard';

interface CityMapProps {
  city: CityData;
  selectedMode: string;
  selectedColor?: string;
}

const CityMap: React.FC<CityMapProps> = ({ city, selectedMode, selectedColor = 'var(--blue)' }) => {
  // Convert CSS variables to actual colors with sophisticated gradients
  const getColorScheme = (colorVar: string) => {
    const colorSchemes: Record<string, { primary: string; secondary: string; accent: string; light: string }> = {
      'var(--red)': { 
        primary: '#e74c3c', 
        secondary: '#c0392b', 
        accent: '#ff6b6b',
        light: '#ffebee'
      },
      'var(--green)': { 
        primary: '#7BA492', 
        secondary: '#027A76', 
        accent: '#4ecdc4',
        light: '#e8f5e8'
      },
      'var(--blue)': { 
        primary: '#3f7aba', 
        secondary: '#2c5c8c', 
        accent: '#5dade2',
        light: '#e3f2fd'
      },
      'var(--orange)': { 
        primary: '#f4a24c', 
        secondary: '#e67e22', 
        accent: '#ffb74d',
        light: '#fff3e0'
      },
      'var(--yellow)': { 
        primary: '#f1c40f', 
        secondary: '#f39c12', 
        accent: '#fff176',
        light: '#fffde7'
      },
      'var(--blue-dark)': { 
        primary: '#2c5c8c', 
        secondary: '#1a365d', 
        accent: '#4299e1',
        light: '#e6f3ff'
      }
    };
    return colorSchemes[colorVar] || colorSchemes['var(--blue)'];
  };

  const colorScheme = getColorScheme(selectedColor);
  
  return (
    <div 
      className="w-full h-screen relative overflow-hidden"
      style={{
        background: `
          radial-gradient(circle at 20% 20%, ${colorScheme.accent}40 0%, transparent 50%),
          radial-gradient(circle at 80% 80%, ${colorScheme.light}60 0%, transparent 50%),
          linear-gradient(135deg, ${colorScheme.primary} 0%, ${colorScheme.secondary} 50%, ${colorScheme.primary}cc 100%)
        `
      }}
    >
      {/* Map Header */}
      <div className="absolute top-0 left-0 right-0 z-20 bg-white/10 backdrop-blur-md border-b border-white/20 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div 
              className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg"
              style={{
                background: `linear-gradient(135deg, ${colorScheme.primary}, ${colorScheme.secondary})`
              }}
            >
              <MapPin className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{city.name} Cycling Infrastructure</h1>
              <p className="text-white/80 capitalize">{selectedMode.replace('-', ' ')} Mode</p>
            </div>
          </div>
          
          {/* Map Controls */}
          <div className="flex items-center gap-3">
            <button 
              className="backdrop-blur-sm text-white p-3 rounded-full transition-all duration-300 hover:scale-110"
              style={{
                backgroundColor: `${colorScheme.accent}40`,
                border: `1px solid ${colorScheme.accent}60`
              }}
            >
              <Layers className="w-5 h-5" />
            </button>
            <button 
              className="backdrop-blur-sm text-white p-3 rounded-full transition-all duration-300 hover:scale-110"
              style={{
                backgroundColor: `${colorScheme.accent}40`,
                border: `1px solid ${colorScheme.accent}60`
              }}
            >
              <ZoomIn className="w-5 h-5" />
            </button>
            <button 
              className="backdrop-blur-sm text-white p-3 rounded-full transition-all duration-300 hover:scale-110"
              style={{
                backgroundColor: `${colorScheme.accent}40`,
                border: `1px solid ${colorScheme.accent}60`
              }}
            >
              <ZoomOut className="w-5 h-5" />
            </button>
            <button 
              className="backdrop-blur-sm text-white p-3 rounded-full transition-all duration-300 hover:scale-110"
              style={{
                backgroundColor: `${colorScheme.accent}40`,
                border: `1px solid ${colorScheme.accent}60`
              }}
            >
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
            <div 
              className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg"
              style={{
                background: `linear-gradient(135deg, ${colorScheme.primary}, ${colorScheme.secondary})`
              }}
            >
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
      <div className="absolute bottom-4 left-4 z-20">
        <GlassCard
          surface="glass"
          tint="rgba(255, 255, 255, 0.1)"
          className="p-4"
        >
          <h3 className="text-white font-semibold mb-3">Legend</h3>
                      <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: colorScheme.primary }}
                ></div>
                <span className="text-white/80 text-sm">Primary Data</span>
              </div>
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: colorScheme.accent }}
                ></div>
                <span className="text-white/80 text-sm">Secondary Data</span>
              </div>
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: colorScheme.secondary }}
                ></div>
                <span className="text-white/80 text-sm">Supporting Data</span>
              </div>
            </div>
        </GlassCard>
      </div>
    </div>
  );
};

export default CityMap; 