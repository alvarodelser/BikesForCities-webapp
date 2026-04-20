import React, { useRef, useEffect, useCallback, useState } from 'react';
import CityCard from './CityCard';
import type { CityData } from '../../constants/cities';


const ScrollableCityCards: React.FC<{
  cities: CityData[];
  selectedCity: string | null;
  onCitySelect?: (cityName: string) => void;
  onCityNavigate?: (cityName: string) => void;
  fadeColor?: string;
}> = ({ cities, selectedCity, onCitySelect, onCityNavigate, fadeColor = "transparent" }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const lastTouchX = useRef<number | null>(null);

  const velocity = useRef(0);
  const lastTime = useRef(0);

  // Sync scrollOffset with selectedCity when it changes from props
  useEffect(() => {
    if (selectedCity && !isDragging) {
      const cityIndex = cities.findIndex(city => city.name === selectedCity);
      if (cityIndex !== -1 && Math.abs(scrollOffset - cityIndex) > 0.01) {
        // Find shortest path for circular scroll
        let target = cityIndex;
        const total = cities.length;
        const current = scrollOffset;
        
        // Normalize current offset to [0, total)
        const normalizedCurrent = ((current % total) + total) % total;
        let diff = target - normalizedCurrent;
        
        if (diff > total / 2) diff -= total;
        else if (diff < -total / 2) diff += total;
        
        setScrollOffset(current + diff);
      }
    }
  }, [selectedCity, cities, isDragging]);

  // Handle snapping when not dragging
  useEffect(() => {
    if (!isDragging) {
      const snapTimer = setTimeout(() => {
        const snapped = Math.round(scrollOffset);
        if (snapped !== scrollOffset) {
          setScrollOffset(snapped);
          // Notify parent of new selection
          const total = cities.length;
          const index = ((snapped % total) + total) % total;
          onCitySelect?.(cities[index].name);
        }
      }, 100);
      return () => clearTimeout(snapTimer);
    }
  }, [scrollOffset, isDragging, cities, onCitySelect]);

  // Handle mouse wheel for horizontal scrolling
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setScrollOffset(prev => prev + e.deltaY / 150); // Sensitivity
    
    // Clear dragging state after a short silence
    const timer = (window as any)._wheelTimer;
    if (timer) clearTimeout(timer);
    (window as any)._wheelTimer = setTimeout(() => {
      setIsDragging(false);
    }, 150);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setScrollOffset(prev => Math.round(prev - 1));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setScrollOffset(prev => Math.round(prev + 1));
    }
  }, []);

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
      setScrollOffset(cityIndex);
      onCitySelect?.(cityName);
    }
  };

  const navigatePrevious = () => {
    setScrollOffset(prev => Math.round(prev - 1));
  };

  const navigateNext = () => {
    setScrollOffset(prev => Math.round(prev + 1));
  };

  return (
    <div className="w-full h-full py-2 overflow-hidden">
      <div className="relative h-full flex items-center justify-center">
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
          className="relative h-full w-full flex items-center justify-center overflow-hidden touch-none"
          onTouchStart={(e) => {
            setIsDragging(true);
            lastTouchX.current = e.targetTouches[0].clientX;
            lastTime.current = Date.now();
            velocity.current = 0;
          }}
          onTouchMove={(e) => {
            if (lastTouchX.current === null) return;
            const currentX = e.targetTouches[0].clientX;
            const currentTime = Date.now();
            const deltaX = currentX - lastTouchX.current;
            const deltaTime = currentTime - lastTime.current;
            
            // Update offset (290px is card spacing)
            setScrollOffset(prev => prev - (deltaX / 290));
            
            if (deltaTime > 0) {
              velocity.current = deltaX / deltaTime;
            }
            
            lastTouchX.current = currentX;
            lastTime.current = currentTime;
          }}
          onTouchEnd={() => {
            setIsDragging(false);
            lastTouchX.current = null;
            
            // Simple momentum
            if (Math.abs(velocity.current) > 0.5) {
              const momentum = -velocity.current * 2;
              setScrollOffset(prev => prev + momentum);
            }
          }}
        >
          {/* Edge Fades */}
          <div 
            className="absolute left-0 top-0 bottom-0 w-10 z-10 pointer-events-none transition-opacity duration-300"
            style={{
              background: `linear-gradient(to right, ${fadeColor} 0%, color-mix(in srgb, ${fadeColor}, transparent 70%) 4px, transparent 8px)`,
              opacity: fadeColor === "transparent" ? 0 : 1
            }}
          />
          <div 
            className="absolute right-0 top-0 bottom-0 w-10 z-10 pointer-events-none transition-opacity duration-300"
            style={{
              background: `linear-gradient(to left, ${fadeColor} 0%, color-mix(in srgb, ${fadeColor}, transparent 70%) 4px, transparent 8px)`,
              opacity: fadeColor === "transparent" ? 0 : 1
            }}
          />

          {cities.map((city, index) => {
            const totalCities = cities.length;
            
            // Normalize position within [-totalCities/2, totalCities/2]
            let position = ((index - scrollOffset) % totalCities);
            
            // Adjust for JS modulo and wrapping
            if (position > totalCities / 2) position -= totalCities;
            else if (position < -totalCities / 2) position += totalCities;

            // Only render cards that are reasonably close to center for performance
            if (Math.abs(position) > 6) return null;

            return (
              <CityCard
                key={city.name}
                city={city}
                position={position}
                isDragging={isDragging}
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