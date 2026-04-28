import React from 'react';
import type { CityData } from '../../constants/cities';
import { useViewport } from '../../hooks/useViewport';
import { useMapState } from '../../hooks/useMapState';
import {
  Car,
  MapPin,
  Network,
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
      { id: 'traces',  label: 'Trayecto' },
      { id: 'heatmap', label: 'Calor' },
    ],
    requiresEdge: true,
  },
};

// Default viz submode per mode
const DEFAULT_SUBMODE: Partial<Record<string, string>> = {
  [MAP_MODES.STATIONS]: 'trips',
  [MAP_MODES.TRAFFIC]:  'traces',
};

const MODE_META = [
  { id: MAP_MODES.INFRASTRUCTURE, name: 'Infraestructura', color: 'var(--blue)',   icon: Network       },
  { id: MAP_MODES.TRAFFIC,        name: 'Tráfico',         color: 'var(--red)',    icon: Car           },
  { id: MAP_MODES.STATIONS,       name: 'Estaciones',      color: 'var(--green)',  icon: MapPin        },
] as const;

// ── Desktop partitioned pill ──────────────────────────────────────────────────

interface PillProps {
  modeId: MapMode;
  name: string;
  color: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  active: boolean;
  disabled: boolean;
  submode: string;
  edgeSelected: boolean;
  onModeClick: () => void;
  onSubmodeClick: (id: string) => void;
}

function ExpandingPill({
  modeId, name, color, icon: Icon,
  active, disabled, submode, edgeSelected,
  onModeClick, onSubmodeClick,
}: PillProps) {
  const viz = VIZ_SUBMODES[modeId];
  const showSubmodes = active && viz && (!viz.requiresEdge || edgeSelected);

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

      {/* Hint: traffic with no edge yet */}
      {active && modeId === MAP_MODES.TRAFFIC && viz?.requiresEdge && !edgeSelected && (
        <div
          className="relative z-10 border-t px-3 pb-2 text-[10px] italic text-center leading-tight"
          style={{ borderColor: 'rgba(0,0,0,0.08)', color: 'rgba(0,0,0,0.5)' }}
          onClick={e => e.stopPropagation()}
        >
          Selecciona un tramo
        </div>
      )}

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
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

const MapFilters: React.FC<MapFiltersProps> = ({ city, selectedMode, onModeChange, isModeAvailable, selectedEdgeId = null }) => {
  const { isMobile } = useViewport();
  const { submode, setMode, setSubmode } = useMapState();

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
              edgeSelected={selectedEdgeId !== null}
              onModeClick={() => handleModeClick(m.id)}
              onSubmodeClick={handleSubmodeClick}
            />
          ))}
      </div>
    </section>
  );
};

export default MapFilters;
