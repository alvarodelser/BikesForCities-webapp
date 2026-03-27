import React, { useRef, useState } from 'react';
import type { CityData } from '../../constants/cities';
import type { CityCanvasHandle } from './CityCanvas';
import CityCanvas from './CityCanvas';
import MapLegend from './MapLegend';
import MapControls from './MapControls';
import { MapPin } from 'lucide-react';

interface CityMapProps {
  city: CityData;
  selectedMode: string;
  selectedColor?: string;
}

const CityMap: React.FC<CityMapProps> = ({ city, selectedMode, selectedColor = 'var(--blue)' }) => {
  const canvasRef = useRef<CityCanvasHandle>(null);
  const [showBikePathBuildings, setShowBikePathBuildings] = useState(true);

  const getColorScheme = (colorVar: string) => {
    const colorSchemes: Record<string, { primary: string; secondary: string; accent: string; light: string }> = {
      'var(--red)': { primary: '#e74c3c', secondary: '#c0392b', accent: '#ff6b6b', light: '#ffebee' },
      'var(--green)': { primary: '#7BA492', secondary: '#027A76', accent: '#4ecdc4', light: '#e8f5e8' },
      'var(--blue)': { primary: '#3f7aba', secondary: '#2c5c8c', accent: '#5dade2', light: '#e3f2fd' },
      'var(--orange)': { primary: '#f4a24c', secondary: '#e67e22', accent: '#ffb74d', light: '#fff3e0' },
      'var(--yellow)': { primary: '#f1c40f', secondary: '#f39c12', accent: '#fff176', light: '#fffde7' },
      'var(--blue-dark)': { primary: '#2c5c8c', secondary: '#1a365d', accent: '#4299e1', light: '#e6f3ff' },
    };
    return colorSchemes[colorVar] || colorSchemes['var(--blue)'];
  };

  const colorScheme = getColorScheme(selectedColor);

  return (
    <div
      className="w-full h-screen relative overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${colorScheme.primary}22 0%, ${colorScheme.secondary}11 50%, ${colorScheme.accent}22 100%), #FBF6EF`
      }}
    >
      {/* Floating Header */}
      <div className="absolute top-0 left-0 right-0 z-20 bg-white/10 backdrop-blur-md border-b border-white/20 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg"
              style={{ background: `linear-gradient(135deg, ${colorScheme.primary}, ${colorScheme.secondary})` }}
            >
              <MapPin className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold" style={{ color: colorScheme.secondary }}>
                {city.name} — Infraestructura Ciclista
              </h1>
              <p className="text-sm capitalize" style={{ color: `${colorScheme.secondary}99` }}>
                Modo: {selectedMode.replace('-', ' ')}
              </p>
            </div>
          </div>

          {/* Map Controls */}
          <MapControls
            colorScheme={colorScheme}
            onZoomIn={() => canvasRef.current?.zoomIn()}
            onZoomOut={() => canvasRef.current?.zoomOut()}
            onReset={() => canvasRef.current?.reset()}
            onToggleBackground={(show) => canvasRef.current?.toggleBackground(show)}
          />
        </div>
      </div>

      {/* Full-width/height map with padding under the header */}
      <div className="absolute inset-0 pt-24 pb-4 px-4">
        <div
          className="w-full h-full rounded-2xl overflow-hidden shadow-2xl border-2 transition-colors duration-500"
          style={{ borderColor: colorScheme.primary }}
        >
          <CityCanvas
            ref={canvasRef}
            city={city}
            selectedMode={selectedMode}
            colorScheme={colorScheme}
            showBikePathBuildings={showBikePathBuildings}
          />
        </div>
      </div>

      {/* Floating Legend */}
      <MapLegend 
        showBikePathBuildings={showBikePathBuildings}
        onToggleBikePathBuildings={() => setShowBikePathBuildings(!showBikePathBuildings)}
      />
    </div>
  );
};

export default CityMap;
