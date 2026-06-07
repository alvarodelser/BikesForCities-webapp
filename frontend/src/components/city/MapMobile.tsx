import React, { useState, useRef, useEffect } from 'react';
import type { CityData } from '../../constants/cities';
import { useMapState } from '../../hooks/useMapState';
import CityMap from './CityMap';
import MapSheetContent from './MapSheetContent';
import BudgetSunburst from './plots/BudgetSunburst';
import { buildSunburstTree } from '../../utils/budget';
import { fetchCityBudgets, fetchCityContext } from '../../services/api';
import type { BudgetYear, MayorTerm } from '../../services/api';

import { RoadHorizon, Graph, Bicycle, Warning, Eye } from '@phosphor-icons/react';

import { MAP_MODES } from '../../constants/mapModes';

interface MapMobileProps {
  city: CityData;
}

const COLLAPSED_HEIGHT = 75;

const modeColors: Record<string, string> = {
  [MAP_MODES.INFRASTRUCTURE]: '#027A76',
  [MAP_MODES.TRAFFIC]: '#3A6C7F',
  [MAP_MODES.STATIONS]: '#ffa585',
  [MAP_MODES.ACCIDENTS]: 'var(--red)',
  [MAP_MODES.TRANSPARENCY]: '#475569',
};

const modeShortNames: Record<string, string> = {
  [MAP_MODES.INFRASTRUCTURE]: 'Infra',
  [MAP_MODES.TRAFFIC]: 'Movilidad',
  [MAP_MODES.STATIONS]: 'Est.',
  [MAP_MODES.ACCIDENTS]: 'Accid.',
  [MAP_MODES.TRANSPARENCY]: 'Transp.',
};

const modeNames: Record<string, string> = {
  [MAP_MODES.INFRASTRUCTURE]: 'Infraestructura',
  [MAP_MODES.TRAFFIC]: 'Modelo de Movilidad',
  [MAP_MODES.STATIONS]: 'Servicio Bici',
  [MAP_MODES.ACCIDENTS]: 'Accidentes',
  [MAP_MODES.TRANSPARENCY]: 'Transparencia',
};

const modeIcons: Record<string, React.ComponentType<{ className?: string; size?: number }>> = {
  [MAP_MODES.INFRASTRUCTURE]: RoadHorizon,
  [MAP_MODES.TRAFFIC]: Graph,
  [MAP_MODES.STATIONS]: Bicycle,
  [MAP_MODES.ACCIDENTS]: Warning,
  [MAP_MODES.TRANSPARENCY]: Eye,
};

export const MapMobile: React.FC<MapMobileProps> = ({ city }) => {
  const { mode, setMode } = useMapState();
  const [isOpen, setIsOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number>(0);

  // Transparency / budget state
  const [budgetYears, setBudgetYears] = useState<BudgetYear[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(0);
  const [budgetType, setBudgetType] = useState<'planned' | 'executed'>('planned');
  const [mayors, setMayors] = useState<MayorTerm[]>([]);

  useEffect(() => {
    if (!city.id) return;
    Promise.all([
      fetchCityBudgets(city.id).catch(() => [] as BudgetYear[]),
      fetchCityContext(city.id).catch(() => ({ mayors: [] as MayorTerm[], budget_year: null, budget_categories: {} })),
    ]).then(([budgets, context]) => {
      setBudgetYears(budgets);
      if (budgets.length > 0) setSelectedYear(budgets[0].year);
      setMayors(context.mayors ?? []);
    });
  }, [city.id]);

  const openHeight =
    typeof window !== 'undefined'
      ? window.innerHeight - 90
      : 600;

  const currentHeight = isOpen ? openHeight : COLLAPSED_HEIGHT;

  // Lock page scroll for the mobile experience
  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    };
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const currentY = e.touches[0].clientY;
    const dy = touchStartY.current - currentY;
    if (!isOpen && dy > 30) {
      setIsOpen(true);
    } else if (isOpen && dy < -30) {
      if (contentRef.current && contentRef.current.scrollTop <= 0) {
        setIsOpen(false);
      }
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!isOpen && e.deltaY > 10) {
      setIsOpen(true);
    } else if (isOpen && e.deltaY < -10) {
      if (contentRef.current && contentRef.current.scrollTop <= 0) {
        setIsOpen(false);
      }
    }
  };

  const isModeAvailable = (m: string | null): boolean => {
    if (!m) return false;
    if (!modeNames[m]) return false;
    if (m === MAP_MODES.TRANSPARENCY) {
      return city.available_modes?.transparency === true || city.budget != null;
    }
    if (city.available_modes) return city.available_modes[m] === true;
    if (m === MAP_MODES.STATIONS) return (city.stations_count || 0) > 0;
    return false;
  };

  const selectedColor = modeColors[mode] || 'var(--blue)';
  const isTransparency = mode === MAP_MODES.TRANSPARENCY;
  const showSunburst = isTransparency && budgetYears.length > 0 && selectedYear > 0;

  const transparencyData = {
    budgetYears,
    selectedYear,
    onYearChange: setSelectedYear,
    budgetType,
    onBudgetTypeChange: setBudgetType,
    mayors,
  };

  return (
    <div className="relative h-dvh w-full overflow-hidden">
      {/* ── MAP LAYER (full screen, locked in transparency mode) ── */}
      <div className="absolute inset-0 z-0">
        <CityMap
          city={city}
          selectedColor={selectedColor}
          bottomOffset={currentHeight}
          locked={isTransparency}
        />
      </div>

      {/* ── SUNBURST OVERLAY (transparency mode only) ── */}
      {showSunburst && (
        <div
          className="absolute inset-x-0 pointer-events-none z-10 flex items-center justify-center"
          style={{ top: 0, bottom: currentHeight }}
        >
          <div className="pointer-events-auto w-full px-4 max-w-[420px]">
            <BudgetSunburst
              data={buildSunburstTree(budgetYears, selectedYear, budgetType)}
              year={selectedYear}
              budgetType={budgetType}
              onBudgetTypeChange={setBudgetType}
              showToggle={false}
            />
          </div>
        </div>
      )}

      {/* ── TOP OVERLAY: Filter pills ── */}
      <div className="absolute top-0 inset-x-0 z-20 pointer-events-none">
        <div className="h-[var(--navbar-height,80px)]" />
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
        className="absolute bottom-0 inset-x-0 z-30 bg-[var(--cream)] rounded-t-[28px] shadow-[0_-8px_40px_rgba(0,0,0,0.18)] flex flex-col transition-[height] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{ height: `${currentHeight}px` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onWheel={handleWheel}
      >
        {/* Drag handle area */}
        <div className="flex-shrink-0 cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-10 h-1 rounded-full bg-[var(--blue-dark)]/20" />
          </div>
          <div className="px-5 pb-3">
            <div className="flex items-baseline gap-2">
              <p className="text-xl font-bold text-[var(--blue-dark)] leading-tight">{city.name}</p>
              <span className="text-xs font-semibold text-[var(--blue)]/70 uppercase tracking-wide">
                {modeNames[mode] || mode}
              </span>
            </div>
            {city.altName && (
              <p className="text-[12px] font-medium text-[var(--blue-dark)]/60 italic leading-tight">
                ({city.altName})
              </p>
            )}
            {!isOpen && !city.altName && (
              <p className="text-[11px] text-[var(--blue-dark)]/50 mt-0.5">
                Desliza hacia arriba para ver el análisis
              </p>
            )}
            {!isOpen && city.altName && (
              <p className="text-[10px] text-[var(--blue-dark)]/40 mt-1">Desliza para ver más</p>
            )}
          </div>
        </div>

        {/* Scrollable sheet content */}
        <div
          ref={contentRef}
          className={`flex-1 overflow-y-auto transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        >
          <div className="px-4 pt-1 pb-24">
            <MapSheetContent city={city} transparencyData={transparencyData} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapMobile;
