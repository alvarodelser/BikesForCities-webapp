import React, { useRef, useEffect, useCallback, useState } from 'react';
import CityCard from './CityCard';
import type { CityData } from '../../constants/cities';


const ScrollableCityCards: React.FC<{ 
  cities: CityData[];
  selectedCity: string | null;
  onCitySelect?: (cityName: string) => void;
  onCityNavigate?: (cityName: string) => void;
}> = ({ cities, selectedCity, onCitySelect, onCityNavigate }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const isAnimating = useRef(false);

  // Update focused index when selectedCity changes
  useEffect(() => {
    if (selectedCity) {
      const cityIndex = cities.findIndex(city => city.name === selectedCity);
      if (cityIndex !== -1 && cityIndex !== focusedIndex) {
        setFocusedIndex(cityIndex);
      }
    }
  }, [selectedCity, focusedIndex, cities]);

  // Handle mouse wheel for horizontal scrolling
  const handleWheel = useCallback((e: WheelEvent) => {
    if (isAnimating.current) return;
    
    e.preventDefault();
    const delta = e.deltaY > 0 ? 1 : -1;
    
    isAnimating.current = true;
    const newIndex = Math.max(0, Math.min(cities.length - 1, focusedIndex + delta));
    
    if (newIndex !== focusedIndex) {
      setFocusedIndex(newIndex);
      onCitySelect?.(cities[newIndex].name);
    }
    
    setTimeout(() => {
      isAnimating.current = false;
    }, 300);
  }, [focusedIndex, onCitySelect, cities]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (isAnimating.current) return;
    
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      isAnimating.current = true;
      const newIndex = focusedIndex === 0 ? cities.length - 1 : focusedIndex - 1;
      setFocusedIndex(newIndex);
      onCitySelect?.(cities[newIndex].name);
      
      setTimeout(() => {
        isAnimating.current = false;
      }, 300);
    } else if (e.key === 'ArrowRight') {
    e.preventDefault();
      isAnimating.current = true;
      const newIndex = focusedIndex === cities.length - 1 ? 0 : focusedIndex + 1;
      setFocusedIndex(newIndex);
      onCitySelect?.(cities[newIndex].name);

      setTimeout(() => {
        isAnimating.current = false;
      }, 300);
    }
  }, [focusedIndex, onCitySelect, cities]);

  // Add event listeners
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('wheel', handleWheel, { passive: false });
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      container.removeEventListener('wheel', handleWheel);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleWheel, handleKeyDown]);

  const selectCity = (cityName: string) => {
    const cityIndex = cities.findIndex(city => city.name === cityName);
    if (cityIndex !== -1) {
      setFocusedIndex(cityIndex);
      onCitySelect?.(cityName);
    }
  };

  // Navigate to previous city
  const navigatePrevious = () => {
    if (isAnimating.current) return;
    
    isAnimating.current = true;
    const newIndex = focusedIndex === 0 ? cities.length - 1 : focusedIndex - 1;
    setFocusedIndex(newIndex);
    onCitySelect?.(cities[newIndex].name);
    
    setTimeout(() => {
      isAnimating.current = false;
    }, 300);
  };

  // Navigate to next city
  const navigateNext = () => {
    if (isAnimating.current) return;
    
    isAnimating.current = true;
    const newIndex = focusedIndex === cities.length - 1 ? 0 : focusedIndex + 1;
    setFocusedIndex(newIndex);
    onCitySelect?.(cities[newIndex].name);
    
    setTimeout(() => {
      isAnimating.current = false;
    }, 300);
  };

  return (
    <div className="w-full py-8 overflow-hidden">
      <div className="relative flex items-center justify-center">
        {/* Previous button */}
        <button
          onClick={navigatePrevious}
          className="absolute left-4 z-20 p-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-full shadow-2xl hover:bg-white/20 transition-all duration-200 hover:scale-110"
        >
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Cards container */}
        <div 
          ref={containerRef}
          className="relative h-[60vh] w-full flex items-center justify-center overflow-hidden"
        >
          {cities.map((city, index) => {
            // Calculate position with wrapping for circular carousel
            let position = index - focusedIndex;
            const totalCities = cities.length;
            
            // Handle wrapping: find the shortest path around the circle
            if (position > totalCities / 2) {
              position -= totalCities;
            } else if (position < -totalCities / 2) {
              position += totalCities;
            }
            
            // Only render cards that are reasonably close to center for performance
            if (Math.abs(position) > 6) return null;
            
            return (
              <CityCard 
                key={city.name}
                city={city}
                position={position}
                onClick={() => selectCity(city.name)}
                onCityNavigate={onCityNavigate}
              />
            );
          })}
        </div>

        {/* Next button */}
        <button
          onClick={navigateNext}
          className="absolute right-4 z-20 p-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-full shadow-2xl hover:bg-white/20 transition-all duration-200 hover:scale-110"
        >
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default ScrollableCityCards; 