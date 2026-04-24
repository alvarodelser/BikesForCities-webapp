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

import { MAP_MODES } from '../../constants/mapModes';

interface MapMobileProps {
  city: CityData;
}

const COLLAPSED_HEIGHT = 75; // moved 4px down (original 116)
const SNAP_THRESHOLD = 50;
const CLOSE_THRESHOLD = 50;

const modeColors: Record<string, string> = {
  [MAP_MODES.INFRASTRUCTURE]: 'var(--blue)',
  [MAP_MODES.TRAFFIC]: 'var(--red)',
  [MAP_MODES.STATIONS]: 'var(--green)',
  [MAP_MODES.TERRAIN]: 'var(--orange)',
  [MAP_MODES.INTERSECTIONS]: 'var(--yellow)',
  [MAP_MODES.ACCIDENTS]: 'var(--red)',
};

const modeShortNames: Record<string, string> = {
  [MAP_MODES.INFRASTRUCTURE]: 'Infra',
  [MAP_MODES.TRAFFIC]: 'Tráfico',
  [MAP_MODES.STATIONS]: 'Est.',
  [MAP_MODES.TERRAIN]: 'Ter.',
  [MAP_MODES.INTERSECTIONS]: 'Inter.',
  [MAP_MODES.ACCIDENTS]: 'Accid.',
};

const modeNames: Record<string, string> = {
  [MAP_MODES.INFRASTRUCTURE]: 'Infraestructura',
  [MAP_MODES.TRAFFIC]: 'Tráfico',
  [MAP_MODES.STATIONS]: 'Estaciones',
  [MAP_MODES.TERRAIN]: 'Terreno',
  [MAP_MODES.INTERSECTIONS]: 'Intersecciones',
  [MAP_MODES.ACCIDENTS]: 'Accidentes',
};

const modeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  [MAP_MODES.INFRASTRUCTURE]: Network,
  [MAP_MODES.TRAFFIC]: Car,
  [MAP_MODES.STATIONS]: MapPin,
  [MAP_MODES.TERRAIN]: Mountain,
  [MAP_MODES.INTERSECTIONS]: CircleDot,
  [MAP_MODES.ACCIDENTS]: TriangleAlert,
};

export const MapMobile: React.FC<MapMobileProps> = ({ city }) => {
  const { mode, setMode } = useMapState();
  const [isOpen, setIsOpen] = useState(false);
  const [sheetHeight, setSheetHeight] = useState(COLLAPSED_HEIGHT);
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef<number>(0);
  const startHeightRef = useRef<number>(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const openHeight =
    typeof window !== 'undefined'
      ? window.innerHeight - 90 /* navbar height approx (increased by 4px to move top down) */
      : 600;

  // Lock page scroll when sheet is collapsed and handle overscroll behavior
  useEffect(() => {
    // 1. Handle overscroll behavior to prevent page refresh when tab is open
    // and allow it only when tab is closed over the map.
    if (isOpen) {
      document.documentElement.style.overscrollBehaviorY = 'none';
      document.body.style.overscrollBehaviorY = 'none';
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.documentElement.style.overscrollBehaviorY = 'auto';
      document.body.style.overscrollBehaviorY = 'auto';
      document.documentElement.style.overflow = ''; // Allow scroll/refresh on map
    }

    // 2. Binary state enforcement: snap to exact heights when not dragging
    if (!isDragging) {
      setSheetHeight(isOpen ? openHeight : COLLAPSED_HEIGHT);
    }

    return () => {
      document.documentElement.style.overscrollBehaviorY = 'auto';
      document.body.style.overscrollBehaviorY = 'auto';
      document.documentElement.style.overflow = '';
    };
  }, [isOpen, openHeight, isDragging]);

  const onDragStart = (y: number) => {
    setIsDragging(true);
    startYRef.current = y;
    startHeightRef.current = sheetHeight;
  };

  const onDragMove = (y: number) => {
    if (!isDragging) return;
    const dy = startYRef.current - y;
    const next = startHeightRef.current + dy;

    // Allow dragging slightly ABOVE openHeight for visual feedback (bounce effect)
    // but keep it within reasonable bounds.
    setSheetHeight(Math.max(COLLAPSED_HEIGHT - 20, Math.min(openHeight + 40, next)));
  };

  const onDragEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    
    // Binary snap logic
    if (isOpen) {
      // If pulled down far enough, close it. Otherwise snap back to open.
      if (openHeight - sheetHeight > CLOSE_THRESHOLD) {
        setIsOpen(false);
      } else {
        setSheetHeight(openHeight);
      }
    } else {
      // If pulled up far enough, open it. Otherwise snap back to closed.
      if (sheetHeight - COLLAPSED_HEIGHT > SNAP_THRESHOLD) {
        setIsOpen(true);
      } else {
        setSheetHeight(COLLAPSED_HEIGHT);
      }
    }
  };

  const isModeAvailable = (m: string | null): boolean => {
    if (!m) return false;
    if (m === MAP_MODES.INFRASTRUCTURE || m === MAP_MODES.TRAFFIC) return true;
    if (!modeNames[m]) return false;
    if (city.available_modes) return city.available_modes[m] === true;
    if (m === MAP_MODES.STATIONS) return (city.stations_count || 0) > 0;
    return false;
  };

  const selectedColor = modeColors[mode] || 'var(--blue)';

  return (
    <div className="relative h-dvh w-full overflow-hidden">
      {/* ── MAP LAYER (full screen) ── */}
      <div className="absolute inset-0 z-0">
        <CityMap city={city} selectedColor={selectedColor} bottomOffset={sheetHeight} />
      </div>

      {/* ── TOP OVERLAY: just the filter pills, no container ── */}
      <div className="absolute top-0 inset-x-0 z-20 pointer-events-none">
        {/* Spacer matching the floating navbar pill height */}
        <div className="h-[var(--navbar-height,80px)]" />

        {/* Filter pills — aligned with navbar logo (px-10 = 40px) */}
        <div className="pointer-events-auto px-10 pt-2.5">
          <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {Object.values(MAP_MODES)
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
                    {modeShortNames[id]}
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
          onTouchStart={(e) => onDragStart(e.touches[0].clientY)}
          onTouchMove={(e) => onDragMove(e.touches[0].clientY)}
          onTouchEnd={onDragEnd}
          onMouseDown={(e) => onDragStart(e.clientY)}
          onMouseMove={(e) => onDragMove(e.clientY)}
          onMouseUp={onDragEnd}
          onMouseLeave={() => isDragging && onDragEnd()}
        >
          {/* Pill */}
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-10 h-1 rounded-full bg-[var(--blue-dark)]/20" />
          </div>

          {/* City name + mode — always visible in collapsed state */}
          <div className="px-5 pb-3">
            <div className="flex items-baseline gap-2">
              <p className="text-xl font-bold text-[var(--blue-dark)] leading-tight">
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
          ref={scrollRef}
          className={`flex-1 overflow-y-auto transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          onTouchStart={(e) => {
            if (scrollRef.current && scrollRef.current.scrollTop <= 0) {
              startYRef.current = e.touches[0].clientY;
            }
          }}
          onTouchMove={(e) => {
            if (!scrollRef.current || !isOpen) return;
            const y = e.touches[0].clientY;
            const dy = startYRef.current - y;
            // If at the top and pulling DOWN (dy < 0)
            if (scrollRef.current.scrollTop <= 0 && dy < 0) {
              if (!isDragging) {
                setIsDragging(true);
                startYRef.current = y;
                startHeightRef.current = sheetHeight;
              }
              onDragMove(y);
              if (e.cancelable) e.preventDefault();
            }
          }}
          onTouchEnd={onDragEnd}
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
