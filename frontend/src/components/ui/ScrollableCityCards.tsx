import React, { useRef, useEffect, useCallback, useState } from 'react';
import CityCard from './CityCard';
import type { CityData } from '../../constants/cities';
import { initialMomentumVelocity, MOMENTUM_DECAY, MOMENTUM_THRESHOLD } from './momentum';


const ScrollableCityCards: React.FC<{
  cities: CityData[];
  selectedCity: string | null;
  onCitySelect?: (cityName: string) => void;
  onCityNavigate?: (cityName: string) => void;
  fadeColor?: string;
}> = ({ cities, selectedCity, onCitySelect, onCityNavigate }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollOffset, setScrollOffset] = useState(0);
  // isDragging suppresses the external-selection sync effect during any
  // interaction (touch or wheel). isTouchDragging additionally disables the
  // cards' CSS transition for 1:1 finger tracking — wheel scrolling keeps the
  // transition on so the motion eases instead of snapping ("blinking").
  const [isDragging, setIsDragging] = useState(false);
  const [isTouchDragging, setIsTouchDragging] = useState(false);
  const lastTouchX = useRef<number | null>(null);

  const velocity = useRef(0);
  const lastTime = useRef(0);
  const lastSelectedCityRef = useRef(selectedCity);
  const rafRef = useRef<number | null>(null);
  const wheelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Update parent and local ref continuously when the "center" city changes during scroll
  useEffect(() => {
    const total = cities.length;
    const centerIndex = ((Math.round(scrollOffset) % total) + total) % total;
    const currentCityName = cities[centerIndex]?.name;
    
    if (currentCityName && currentCityName !== lastSelectedCityRef.current) {
      lastSelectedCityRef.current = currentCityName;
      onCitySelect?.(currentCityName);
    }
  }, [scrollOffset, cities, onCitySelect]);

  // Sync scrollOffset with selectedCity only when it changes from "outside" (e.g. Map click)
  useEffect(() => {
    if (selectedCity === lastSelectedCityRef.current) return;
    if (isDragging) return;

    if (selectedCity) {
      lastSelectedCityRef.current = selectedCity;
      const cityIndex = cities.findIndex(city => city.name === selectedCity);
      
      if (cityIndex !== -1) {
        let target = cityIndex;
        const total = cities.length;
        const current = scrollOffset;
        const normalizedCurrent = ((current % total) + total) % total;
        let diff = target - normalizedCurrent;
        if (diff > total / 2) diff -= total;
        else if (diff < -total / 2) diff += total;
        setScrollOffset(current + diff);
      }
    }
  }, [selectedCity, cities, scrollOffset, isDragging]);

  // Handle snapping when not dragging
  useEffect(() => {
    if (!isDragging) {
      const snapTimer = setTimeout(() => {
        const snapped = Math.round(scrollOffset);
        if (snapped !== scrollOffset) {
          setScrollOffset(snapped);
        }
      }, 50);
      return () => clearTimeout(snapTimer);
    }
  }, [scrollOffset, isDragging]);

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    setIsDragging(true);
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    setScrollOffset(prev => prev + delta / 200);
    if (wheelTimerRef.current) clearTimeout(wheelTimerRef.current);
    wheelTimerRef.current = setTimeout(() => {
      setIsDragging(false);
    }, 200);
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setScrollOffset(prev => Math.round(prev - 1));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setScrollOffset(prev => Math.round(prev + 1));
    }
  }, []);

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

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (wheelTimerRef.current !== null) clearTimeout(wheelTimerRef.current);
    };
  }, []);

  const selectCity = (cityName: string) => {
    const cityIndex = cities.findIndex(city => city.name === cityName);
    if (cityIndex !== -1) {
      setScrollOffset(cityIndex);
      lastSelectedCityRef.current = cityName;
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
          className="absolute left-1 z-20 p-2 md:p-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-full shadow-2xl hover:bg-white/20 transition-all duration-200 hover:scale-110"
        >
          <svg className="w-5 h-5 md:w-6 md:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Cards container with Masking Fade */}
        <div
          ref={containerRef}
          data-testid="cards-container"
          className="relative h-full w-full flex items-center justify-center overflow-hidden touch-none"
          style={{
            WebkitMaskImage: 'linear-gradient(to right, transparent, black 100px, black calc(100% - 100px), transparent)',
            maskImage: 'linear-gradient(to right, transparent, black 100px, black calc(100% - 100px), transparent)'
          }}
          onTouchStart={(e) => {
            if (rafRef.current !== null) {
              cancelAnimationFrame(rafRef.current);
              rafRef.current = null;
            }
            setIsDragging(true);
            setIsTouchDragging(true);
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
            setScrollOffset(prev => prev - (deltaX / 250));
            if (deltaTime > 0) {
              velocity.current = deltaX / deltaTime;
            } else if (deltaX !== 0) {
              // Same-millisecond move: preserve sign with a nominal 0.5 px/ms velocity
              velocity.current = deltaX > 0 ? 0.5 : -0.5;
            }
            lastTouchX.current = currentX;
            lastTime.current = currentTime;
          }}
          onTouchEnd={() => {
            setIsDragging(false);
            setIsTouchDragging(false);
            lastTouchX.current = null;

            if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);

            if (Math.abs(velocity.current) > MOMENTUM_THRESHOLD) {
              let v = initialMomentumVelocity(velocity.current);

              const loop = () => {
                v *= MOMENTUM_DECAY;
                if (Math.abs(v) >= 0.05) {
                  setScrollOffset(prev => prev + v);
                  rafRef.current = requestAnimationFrame(loop);
                } else {
                  setScrollOffset(prev => Math.round(prev + v));
                  rafRef.current = null;
                }
              };

              rafRef.current = requestAnimationFrame(loop);
            }
          }}
        >
          {cities.map((city, index) => {
            const totalCities = cities.length;
            let position = ((index - scrollOffset) % totalCities);
            if (position > totalCities / 2) position -= totalCities;
            else if (position < -totalCities / 2) position += totalCities;
            if (Math.abs(position) > 6) return null;
            return (
              <CityCard
                key={city.name}
                city={city}
                position={position}
                isDragging={isTouchDragging}
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