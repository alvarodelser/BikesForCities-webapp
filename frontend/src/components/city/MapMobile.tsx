import React, { useState, useRef, useEffect } from 'react';
import type { CityData } from '../../constants/cities';
import { useMapState } from '../../hooks/useMapState';
import CityMap from './CityMap';
import MapSheetContent from './MapSheetContent';

import {
  Car,
  MapPin,
  Network,
  Mountain,
  TriangleAlert,
  CircleDot,
} from 'lucide-react';

interface MapMobileProps {
  city: CityData;
}

const COLLAPSED_HEIGHT = 116; // enough room for pill + city name + hint
const SNAP_THRESHOLD = 100;
const CLOSE_THRESHOLD = 80;

const modeColors: Record<string, string> = {
  infrastructure: 'var(--blue)',
  traffic: 'var(--red)',
  stations: 'var(--green)',
  terrain: 'var(--orange)',
  intersections: 'var(--yellow)',
  accidents: 'var(--red)',
};

const modeNames: Record<string, string> = {
  infrastructure: 'Infraestructura',
  traffic: 'Tráfico',
  stations: 'Estaciones',
  terrain: 'Terreno',
  intersections: 'Intersecciones',
  accidents: 'Accidentes',
};

const modeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  infrastructure: Network,
  traffic: Car,
  stations: MapPin,
  terrain: Mountain,
  intersections: CircleDot,
  accidents: TriangleAlert,
};

export const MapMobile: React.FC<MapMobileProps> = ({ city }) => {
  const { mode, setMode } = useMapState();
  const [isOpen, setIsOpen] = useState(false);
  const [sheetHeight, setSheetHeight] = useState(COLLAPSED_HEIGHT);
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef<number>(0);
  const startHeightRef = useRef<number>(0);

  const openHeight =
    typeof window !== 'undefined'
      ? window.innerHeight - 76 /* navbar height approx */
      : 600;

  // Lock page scroll when sheet is collapsed
  useEffect(() => {
    document.documentElement.style.overflow = isOpen ? '' : 'hidden';
    if (!isOpen) setSheetHeight(COLLAPSED_HEIGHT);
    else setSheetHeight(openHeight);
    return () => {
      document.documentElement.style.overflow = '';
    };
  }, [isOpen, openHeight]);

  const onTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    startYRef.current = e.touches[0].clientY;
    startHeightRef.current = sheetHeight;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const dy = startYRef.current - e.touches[0].clientY;
    const next = Math.max(COLLAPSED_HEIGHT, Math.min(openHeight, startHeightRef.current + dy));
    setSheetHeight(next);
  };

  const onTouchEnd = () => {
    setIsDragging(false);
    if (isOpen) {
      if (openHeight - sheetHeight > CLOSE_THRESHOLD) setIsOpen(false);
      else setSheetHeight(openHeight);
    } else {
      if (sheetHeight - COLLAPSED_HEIGHT > SNAP_THRESHOLD) setIsOpen(true);
      else setSheetHeight(COLLAPSED_HEIGHT);
    }
  };

  const isModeAvailable = (m: string | null): boolean => {
    if (!m) return false;
    if (m === 'infrastructure' || m === 'traffic') return true;
    if (!modeNames[m]) return false;
    if (city.available_modes) return city.available_modes[m] === true;
    if (m === 'stations') return (city.stations_count || 0) > 0;
    return false;
  };

  const selectedColor = modeColors[mode] || 'var(--blue)';

  return (
    <div className="relative h-dvh w-full overflow-hidden">
      {/* ── MAP LAYER (full screen) ── */}
      <div className="absolute inset-0 z-0">
        <CityMap city={city} selectedColor={selectedColor} />
      </div>

      {/* ── TOP OVERLAY: just the filter pills, no container ── */}
      <div className="absolute top-0 inset-x-0 z-20 pointer-events-none">
        {/* Spacer matching the floating navbar pill height */}
        <div className="h-[var(--navbar-height,80px)]" />

        {/* Filter pills — no background container, just the pills themselves */}
        <div className="pointer-events-auto px-4 pt-2.5">
          <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {(['infrastructure', 'traffic', 'stations', 'terrain', 'intersections', 'accidents'] as const)
              .filter(id => isModeAvailable(id))
              .map(id => {
                const isActive = mode === id;
                const Icon = modeIcons[id];
                return (
                  <button
                    key={id}
                    onClick={() => setMode(id)}
                    aria-pressed={isActive}
                    style={isActive ? { backgroundColor: modeColors[id], borderColor: modeColors[id] } : {}}
                    className={`shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-all duration-200 backdrop-blur-md shadow-sm ${isActive
                        ? 'text-white border shadow-md scale-105'
                        : 'bg-[var(--cream)]/50 text-[var(--blue-dark)]/80 border border-white/30 hover:bg-[var(--cream)]/70'
                      }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {modeNames[id]}
                  </button>
                );
              })}
          </div>
        </div>
      </div>

      {/* ── BOTTOM SHEET ── */}
      <div
        className={`absolute bottom-0 inset-x-0 z-30 bg-[var(--cream)] rounded-t-[28px] shadow-[0_-8px_40px_rgba(0,0,0,0.18)] flex flex-col ${isDragging ? '' : 'transition-[height] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]'}`}
        style={{ height: `${sheetHeight}px` }}
      >
        {/* Drag handle area — always visible, touchable */}
        <div
          className="flex-shrink-0 cursor-grab active:cursor-grabbing"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {/* Pill */}
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-10 h-1 rounded-full bg-[var(--blue-dark)]/20" />
          </div>

          {/* City name + mode — always visible in collapsed state */}
          <div className="px-5 pb-3">
            <div className="flex items-baseline gap-2">
              <p className="text-base font-bold text-[var(--blue-dark)] leading-tight">
                {city.name}
              </p>
              <span className="text-xs font-semibold text-[var(--blue)]/70 uppercase tracking-wide">
                {modeNames[mode] || mode}
              </span>
            </div>
            {!isOpen && (
              <p className="text-[11px] text-[var(--blue-dark)]/50 mt-0.5">
                Desliza hacia arriba para ver el análisis
              </p>
            )}
          </div>
        </div>

        {/* Scrollable sheet content — only accessible when open */}
        <div
          className={`flex-1 overflow-y-auto transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        >
          <div className="px-4 pt-1 pb-24">
            <MapSheetContent city={city} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapMobile;
