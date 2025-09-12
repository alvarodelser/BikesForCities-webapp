import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { CITIES } from '../../constants/cities';
import SpainMap from './SpainMap';
import ScrollableCityCards from '../ui/ScrollableCityCards';
import WaveBackground from '../ui/WaveBackground';

const MapSelector: React.FC = () => {
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [expandedCity, setExpandedCity] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleCitySelect = (cityName: string) => {
    setSelectedCity(cityName);
    setExpandedCity(cityName); // Expand the pin when city is selected
  };

  const handleCityNavigate = (cityName: string) => {
    // Find the city data to get the path
    const city = CITIES.find(c => c.name === cityName);
    if (city) {
      navigate(city.path);
    }
  };

  return (
    <div 
      id="map-selector" 
      className="relative w-full min-h-screen flex flex-col items-center overflow-hidden"
      style={{ height: '120vh' }} // More height for the container
    >
      {/* Wave Background - Full coverage behind all elements */}
      <WaveBackground 
        color={0x3A6C7F} // Deep blue-teal base color
        specularColor={0x7BA492} // Green-teal specular highlights
        shininess={8}
        waveHeight={20}
        waveSpeed={0.5}
        zoom={5}
        // Camera positioning for full coverage
        cameraFov={90}
        cameraY={300}
        cameraZ={100}
        targetY={-50}
        className="absolute inset-0 w-full h-full -z-10 pointer-events-auto"
      />

      {/* D3.js Spain Map with Coordinate System - Positioned 1/3 up */}
      <div 
        className="absolute z-10 flex items-center justify-center w-full"
        style={{ 
          top: '-8%', // Position 1/3 from top
          height: '70%'   // Give it good height for the map
        }}
      >
        <SpainMap
          width={900}
          height={700}
          onCityClick={handleCitySelect}
          onCityNavigate={handleCityNavigate}
          selectedCity={selectedCity}
          expandedCity={expandedCity}
          className=""
        />
      </div>

      

      {/* Scrollable City Cards */}
      <div className="absolute left-0 right-0 z-20 w-full mx-0 px-4" style={{ bottom: '1vh' }}>
        <ScrollableCityCards 
          cities={CITIES}
          selectedCity={selectedCity} 
          onCitySelect={handleCitySelect}
          onCityNavigate={handleCityNavigate}
        />
      </div>
    </div>
  );
};

export default MapSelector;