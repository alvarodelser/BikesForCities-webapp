import React, { useRef } from 'react';
import type { CityData } from '../../constants/cities';
import type { CityCanvasHandle } from './CityCanvas';
import CityCanvas from './CityCanvas';
import MapHeader from './MapHeader';
import MapLegend from './MapLegend';

interface CityMapProps {
  city: CityData;
  selectedMode: string;
  selectedColor?: string;
}

const CityMap: React.FC<CityMapProps> = ({ city, selectedMode, selectedColor = 'var(--blue)' }) => {
  const canvasRef = useRef<CityCanvasHandle>(null);

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
      <MapHeader
        city={city}
        selectedMode={selectedMode}
        colorScheme={colorScheme}
        onZoomIn={() => canvasRef.current?.zoomIn()}
        onZoomOut={() => canvasRef.current?.zoomOut()}
        onReset={() => canvasRef.current?.reset()}
        onToggleBackground={(show) => canvasRef.current?.toggleBackground(show)}
      />

      {/* Map Container */}
      <div className="w-full h-full pt-20">
        {/* Map Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent"></div>
        </div>

        {/* Map Content */}
        <div className="relative w-full h-full flex items-center justify-center">
          <CityCanvas
            ref={canvasRef}
            city={city}
            selectedMode={selectedMode}
            colorScheme={colorScheme}
          />
        </div>
      </div>

      <MapLegend />
    </div>
  );
};

export default CityMap;
