import React, { useState } from 'react';
import { CITIES } from '../../constants/cities';
import SpainMap from '../../assets/es.svg';
import ScrollableCityCards from '../ui/ScrollableCityCards';

const MapSelector: React.FC = () => {
  const [selectedCity, setSelectedCity] = useState<string | null>(null);

  const handleCitySelect = (cityName: string) => {
    setSelectedCity(cityName);
    
    // Find and highlight the corresponding map pin
    const mapPin = document.querySelector(`[data-city="${cityName}"]`);
    if (mapPin) {
      // Remove any existing active pins
      document.querySelectorAll('.map-pin').forEach(pin => 
        pin.classList.remove('active-pin')
      );
      
      // Add active class to selected pin
      mapPin.classList.add('active-pin');
    }
  };

  return (
    <div 
      id="map-selector" 
      className="relative w-full h-screen bg-[var(--blue)] flex flex-col items-center"
    >
      {/* Spain Map SVG */}
      <div className="absolute inset-0 opacity-20">
        <img 
          src={SpainMap} 
          alt="Spain Map" 
          className="w-full h-full object-contain"
        />
      </div>

      {/* City Pins */}
      <div className="absolute inset-0">
        {CITIES.map((city) => (
          <div 
            key={city.name}
            data-city={city.name}
            className={`map-pin absolute cursor-pointer group`}
            style={{ 
              left: `${city.mapCoords.x}px`, 
              top: `${city.mapCoords.y}px` 
            }}
            onClick={() => handleCitySelect(city.name)}
          >
            <div className="w-4 h-4 bg-[var(--green)] rounded-full 
              group-hover:scale-125 transition-transform duration-300
              relative z-10
              ${selectedCity === city.name ? 'ring-4 ring-[var(--yellow)]' : ''}"
            >
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 
                bg-white/80 backdrop-blur-sm px-2 py-1 rounded-md 
                opacity-0 group-hover:opacity-100 transition-opacity duration-300
                text-xs text-gray-800"
              >
                {city.name}
              </div>
            </div>
          </div>
        ))}
      </div>

      

      {/* Scrollable City Cards */}
      <div className="absolute bottom-8 left-0 right-0 z-20 w-full  mx-0 px-4">
        <ScrollableCityCards 
          cities={CITIES}
          selectedCity={selectedCity} 
          onCitySelect={handleCitySelect} 
        />
      </div>
    </div>
  );
};

export default MapSelector;