import React, { useState, useEffect } from 'react';
import type { CityData } from '../../constants/cities';
import { useViewport } from '../../hooks/useViewport';
import { useMapState } from '../../hooks/useMapState';
import { fetchAccidentsSummary } from '../../services/api';
import {
  Car,
  MapPin,
  Network,
  Mountain,
  TriangleAlert,
  CircleDot,
} from 'lucide-react';
import { MAP_MODES } from '../../constants/mapModes';
import type { MapMode } from '../../constants/mapModes';

interface MapFiltersProps {
  city: CityData;
  selectedMode: MapMode;
  onModeChange: (mode: MapMode) => void;
  isModeAvailable: (mode: MapMode) => boolean;
  selectedEdgeId?: number | null;
}

interface VizSubmode { id: string; label: string }

// Viz submodes per mode, with optional condition
const VIZ_SUBMODES: Partial<Record<string, { items: VizSubmode[]; requiresEdge?: boolean }>> = {
  [MAP_MODES.STATIONS]: {
    items: [
      { id: 'trips',    label: 'Viajes' },
      { id: 'downtime', label: 'Tiempo' },
      { id: 'reach',    label: 'Alcance' },
    ],
  },
  [MAP_MODES.TRAFFIC]: {
    items: [
      { id: 'rutas', label: 'Rutas' },
      { id: 'od',    label: 'Origen-Destino' },
    ],
  },
};

// Default viz submode per mode
const DEFAULT_SUBMODE: Partial<Record<string, string>> = {
  [MAP_MODES.STATIONS]: 'trips',
  [MAP_MODES.TRAFFIC]:  'rutas',
};

const MODE_META = [
  { id: MAP_MODES.INFRASTRUCTURE, name: 'Infraestructura', color: '#027A76', icon: Network },
  { id: MAP_MODES.TRAFFIC,        name: 'Tráfico',         color: '#3A6C7F', icon: Car     },
  { id: MAP_MODES.STATIONS,       name: 'Servicios Bici',  color: '#ffa585', icon: MapPin  },
  { id: MAP_MODES.TERRAIN,        name: 'Terreno',         color: 'var(--orange)', icon: Mountain },
  { id: MAP_MODES.INTERSECTIONS,  name: 'Intersecciones',  color: 'var(--yellow)', icon: CircleDot },
  { id: MAP_MODES.ACCIDENTS,      name: 'Accidentes',      color: 'var(--red)', icon: TriangleAlert },
] as const;

const ACCIDENT_ACCENT = '#ef4444';

// ── Compact year timeline for accidents pill ──────────────────────────────────

interface CompactYearTimelineProps {
  cityId: number;
  selectedYear: string;
  onYearSelect: (year: string) => void;
}

function CompactYearTimeline({ cityId, selectedYear, onYearSelect }: CompactYearTimelineProps) {
  const [years, setYears] = useState<number[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchAccidentsSummary(cityId)
      .then(s => { if (!cancelled) setYears((s.available_years ?? []).slice().sort((a, b) => a - b)); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [cityId]);

  if (years.length === 0) return null;

  const selectedNum = selectedYear ? parseInt(selectedYear, 10) : null;

  return (
    <div
      className="relative z-10 border-t px-3 pb-3 pt-2.5"
      style={{ borderColor: 'rgba(0,0,0,0.08)' }}
      onClick={e => e.stopPropagation()}
    >
      <span
        className="block text-[8px] font-black uppercase tracking-widest mb-2"
        style={{ color: 'rgba(0,0,0,0.3)' }}
      >
        Año
      </span>

      {/* Timeline track */}
      <div className="relative flex items-start justify-between">
        {/* Connecting line */}
        <div
          className="absolute top-[9px] left-2.5 right-2.5 h-[1.5px]"
          style={{ backgroundColor: 'rgba(0,0,0,0.08)' }}
        />

        {years.map((yr) => {
          const isActive = selectedNum === yr;
          return (
            <button
              key={yr}
              onClick={() => onYearSelect(isActive ? '' : String(yr))}
              className="relative flex flex-col items-center gap-1 group"
              style={{ minWidth: 0 }}
            >
              {/* Dot */}
              <div
                className="w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center transition-all duration-200 relative z-10"
                style={{
                  backgroundColor: isActive ? ACCIDENT_ACCENT : 'white',
                  borderColor: isActive ? ACCIDENT_ACCENT : 'rgba(0,0,0,0.15)',
                  boxShadow: isActive
                    ? `0 0 0 2px ${ACCIDENT_ACCENT}30, 0 2px 6px ${ACCIDENT_ACCENT}50`
                    : '0 1px 2px rgba(0,0,0,0.1)',
                  transform: isActive ? 'scale(1.15)' : 'scale(1)',
                }}
              >
                {isActive && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
              {/* Year label */}
              <span
                className="text-[8px] font-bold transition-all duration-200 whitespace-nowrap"
                style={{
                  color: isActive ? ACCIDENT_ACCENT : 'rgba(0,0,0,0.35)',
                  transform: isActive ? 'scale(1.05)' : 'scale(1)',
                }}
              >
                {yr}
              </span>
            </button>
          );
        })}
      </div>

      {/* "All years" pill */}
      {selectedNum != null && (
        <button
          className="mt-2 w-full py-1 rounded-lg text-[9px] font-bold transition-all"
          style={{
            color: ACCIDENT_ACCENT,
            backgroundColor: `${ACCIDENT_ACCENT}10`,
            border: `1px solid ${ACCIDENT_ACCENT}25`,
          }}
          onClick={() => onYearSelect('')}
        >
          Ver todos los años
        </button>
      )}
    </div>
  );
}

// ── Desktop partitioned pill ──────────────────────────────────────────────────

interface PillProps {
  modeId: MapMode;
  name: string;
  color: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  active: boolean;
  disabled: boolean;
  submode: string;
  period: string;
  edgeSelected: boolean;
  cityId: number;
  onModeClick: () => void;
  onSubmodeClick: (id: string) => void;
  onPeriodChange: (v: string) => void;
}

function ExpandingPill({
  modeId, name, color, icon: Icon,
  active, disabled, submode, period,
  cityId, onModeClick, onSubmodeClick, onPeriodChange,
}: PillProps) {
  const viz = VIZ_SUBMODES[modeId];
  const showSubmodes = active && !!viz;
  const showAccidentsTimeline = active && modeId === MAP_MODES.ACCIDENTS;

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-pressed={active}
      aria-disabled={disabled}
      onClick={disabled ? undefined : onModeClick}
      onKeyDown={disabled ? undefined : (e) => (e.key === 'Enter' || e.key === ' ') && onModeClick()}
      className={`relative rounded-2xl border-2 transition-all duration-300 overflow-hidden text-left w-full ${
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
      }`}
      style={{
        backgroundColor: active ? 'white' : 'rgba(255,255,255,0.15)',
        borderColor:     active ? 'white' : 'rgba(255,255,255,0.2)',
        boxShadow: active
          ? `0 8px 24px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.5)`
          : '0 2px 6px rgba(0,0,0,0.04)',
      }}
    >
      {/* Glass reflection */}
      <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent rounded-t-2xl pointer-events-none" />

      {/* Top half: icon + label */}
      <div className="relative z-10 flex items-center gap-2 justify-center px-3 py-3">
        <Icon className="w-4 h-4" style={{ color: active ? color : 'white' }} />
        <span className="text-sm font-semibold" style={{ color: active ? color : 'white' }}>
          {name}
        </span>
      </div>

      {/* Bottom half: viz submode row */}
      {showSubmodes && (
        <div
          className="relative z-10 flex border-t"
          style={{ borderColor: 'rgba(0,0,0,0.08)' }}
          onClick={e => e.stopPropagation()}
        >
          {viz!.items.map((s, i) => {
            const isActive = (submode || DEFAULT_SUBMODE[modeId]) === s.id;
            return (
              <button
                key={s.id}
                onClick={() => onSubmodeClick(s.id)}
                className="flex-1 py-1.5 text-[11px] font-bold uppercase tracking-wide transition-colors cursor-pointer"
                style={{
                  backgroundColor: isActive ? 'rgba(0,0,0,0.06)' : 'transparent',
                  color:           isActive ? color : 'rgba(0,0,0,0.45)',
                  borderLeft: i > 0 ? '1px solid rgba(0,0,0,0.08)' : undefined,
                }}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Accidents: year timeline */}
      {showAccidentsTimeline && (
        <CompactYearTimeline
          cityId={cityId}
          selectedYear={period}
          onYearSelect={onPeriodChange}
        />
      )}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

const MapFilters: React.FC<MapFiltersProps> = ({ city, selectedMode, onModeChange, isModeAvailable, selectedEdgeId = null }) => {
  const { isMobile } = useViewport();
  const { submode, period, setMode, setSubmode, setPeriod } = useMapState();

  const handleModeClick = (id: MapMode) => {
    const defaultSub = DEFAULT_SUBMODE[id] ?? '';
    setMode(id, defaultSub || undefined);
  };

  const handleSubmodeClick = (id: string) => {
    setSubmode(id);
  };

  // ── Mobile: horizontal pill strip (unchanged layout, no expansion) ──
  if (isMobile) {
    return (
      <div className="flex gap-2 overflow-x-auto px-[var(--space-gutter)] py-2 bg-black/[0.03] border-b border-black/10">
        {MODE_META
          .filter(m => isModeAvailable(m.id))
          .map(m => {
            const isActive = selectedMode === m.id;
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                onClick={() => onModeChange(m.id)}
                disabled={!isModeAvailable(m.id)}
                aria-pressed={isActive}
                style={isActive ? { backgroundColor: m.color, borderColor: m.color } : {}}
                className={`shrink-0 flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-semibold whitespace-nowrap transition-colors ${
                  isActive
                    ? 'text-white border-transparent'
                    : 'bg-white border-black/10 text-black/70'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {m.name}
              </button>
            );
          })}
      </div>
    );
  }

  // ── Desktop: expanding pills grid ──
  return (
    <section className="w-full">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-1">Herramientas de Análisis</h2>
        <p className="text-base text-white/80">
          Selecciona un modo para analizar la infraestructura ciclista de {city.name}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 items-start">
        {MODE_META
          .filter(m => isModeAvailable(m.id))
          .map(m => (
            <ExpandingPill
              key={m.id}
              modeId={m.id}
              name={m.name}
              color={m.color}
              icon={m.icon}
              active={selectedMode === m.id}
              disabled={!isModeAvailable(m.id)}
              submode={selectedMode === m.id ? submode : ''}
              period={selectedMode === m.id ? period : ''}
              edgeSelected={selectedEdgeId !== null}
              cityId={city.id ?? 0}
              onModeClick={() => handleModeClick(m.id)}
              onSubmodeClick={handleSubmodeClick}
              onPeriodChange={setPeriod}
            />
          ))}
      </div>
    </section>
  );
};

export default MapFilters;
