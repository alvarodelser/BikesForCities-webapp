import React from 'react';
import type { CityData } from '../../constants/cities';
import { useViewport } from '../../hooks/useViewport';
import { useMapState } from '../../hooks/useMapState';
import { RoadHorizon, Graph, Bicycle, Warning, Eye } from '@phosphor-icons/react';
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

const VIZ_SUBMODES: Partial<Record<string, { items: VizSubmode[]; requiresEdge?: boolean }>> = {
  [MAP_MODES.STATIONS]: {
    items: [
      { id: 'trips',    label: 'Demanda' },
      { id: 'downtime', label: 'Disponibilidad' },
      { id: 'reach',    label: 'Cobertura' },
    ],
  },
  [MAP_MODES.TRAFFIC]: {
    items: [
      { id: 'rutas', label: 'Trayectos' },
      { id: 'od',    label: 'Desplazamientos' },
    ],
  },
};

const DEFAULT_SUBMODE: Partial<Record<string, string>> = {
  [MAP_MODES.STATIONS]: 'trips',
  [MAP_MODES.TRAFFIC]:  'rutas',
};

const MODE_META = [
  { id: MAP_MODES.INFRASTRUCTURE, name: 'Infraestructura',     color: '#027A76',      icon: RoadHorizon },
  { id: MAP_MODES.TRAFFIC,        name: 'Modelo de Movilidad', color: '#3A6C7F',      icon: Graph       },
  { id: MAP_MODES.STATIONS,       name: 'Servicio Bici',       color: '#ffa585',      icon: Bicycle     },
  { id: MAP_MODES.ACCIDENTS,      name: 'Accidentes',          color: 'var(--red)',   icon: Warning     },
  { id: MAP_MODES.TRANSPARENCY,   name: 'Transparencia',       color: '#3A6C7F',      icon: Eye         },
] as const;

// Context copy keyed by mode or mode/submode
const CONTEXT_COPY: Partial<Record<string, { title: string; body: string }>> = {
  [MAP_MODES.INFRASTRUCTURE]: {
    title: 'Carriles bici de la ciudad',
    body:  'Explora los carriles bici, vías ciclistas y zonas de velocidad reducida. El mapa muestra el tipo y estado de cada tramo de la red. Compara qué barrios están bien conectados y cuáles quedan fuera de la red.',
  },
  [`${MAP_MODES.TRAFFIC}/rutas`]: {
    title: 'Por dónde circulan los ciclistas',
    body:  'Visualiza las rutas que toman los ciclistas. Cada tramo muestra la intensidad de uso: cuántas personas pasan por ahí. Útil para identificar qué corredores concentran más flujo ciclista y dónde la falta de infraestructura frena el uso.',
  },
  [`${MAP_MODES.TRAFFIC}/od`]: {
    title: 'Origen y destino de los desplazamientos ciclistas',
    body:  'Muestra los pares origen-destino de los viajes: qué zonas generan más desplazamientos y hacia dónde se dirigen. Las líneas representan la demanda real de movilidad; donde hay una línea intensa, hay necesidad de infraestructura.',
  },
  [MAP_MODES.TRAFFIC]: {
    title: 'Por dónde circulan los ciclistas',
    body:  'Visualiza las rutas que toman los ciclistas. Cada tramo muestra la intensidad de uso: cuántas personas pasan por ahí.',
  },
  [`${MAP_MODES.STATIONS}/trips`]: {
    title: 'Uso y demanda por estación bici',
    body:  'Muestra la demanda de cada estación: número de usos, entradas y salidas. Identifica las estaciones más saturadas; que más necesitan ampliación de flota o nuevos puntos cercanos, y las que apenas se utilizan.',
  },
  [`${MAP_MODES.STATIONS}/downtime`]: {
    title: 'Disponibilidad horaria del servicio',
    body:  'Analiza la disponibilidad de bicicletas por horas, fines de semana y laborables. El momento crítico del servicio es cuando un usuario llega y no encuentra bici: aquí puedes ver cuándo y dónde ocurre con más frecuencia.',
  },
  [`${MAP_MODES.STATIONS}/reach`]: {
    title: 'Alcance de cada estación',
    body:  'Calcula el área de alcance de cada estación siguiendo el trazado real y las reglas de circulación. Muestra la diferencia entre la cobertura óptima y la situación real, donde una red viaria diseñada para el coche, especialmente las calles de sentido único, limita el acceso en bici.',
  },
  [MAP_MODES.STATIONS]: {
    title: 'Uso y demanda por estación bici',
    body:  'Muestra la demanda de cada estación: número de usos, entradas y salidas.',
  },
  [MAP_MODES.ACCIDENTS]: {
    title: 'Dónde ocurren los accidentes y por qué',
    body:  'Localiza los puntos de mayor siniestralidad ciclista en la ciudad. Cada incidente muestra el tipo de vehículo implicado, la gravedad y el tipo de vía. Los tramos sin infraestructura ciclista concentran accidentes graves. La severidad repercute en los usuarios vulnerables de la vía.',
  },
  [MAP_MODES.TRANSPARENCY]: {
    title: 'Presupuesto y gobierno municipal',
    body:  'Explora cómo el ayuntamiento gestiona sus recursos. Compara lo presupuestado con lo ejecutado por área de gasto, y consulta el historial de mandatos municipales. Los datos provienen de los presupuestos municipales publicados.',
  },
};

// ── Desktop partitioned pill ──────────────────────────────────────────────────

interface PillProps {
  modeId: MapMode;
  name: string;
  color: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties; size?: number }>;
  active: boolean;
  disabled: boolean;
  submode: string;
  edgeSelected: boolean;
  onModeClick: () => void;
  onSubmodeClick: (id: string) => void;
}

function ExpandingPill({
  modeId, name, color, icon: Icon,
  active, disabled, submode,
  onModeClick, onSubmodeClick,
}: PillProps) {
  const viz = VIZ_SUBMODES[modeId];
  const showSubmodes = active && !!viz;

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
      <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent rounded-t-2xl pointer-events-none" />

      <div className="relative z-10 flex items-center gap-2 justify-center px-3 py-3">
        <Icon size={16} style={{ color: active ? color : 'white' }} />
        <span className="text-sm font-semibold" style={{ color: active ? color : 'white' }}>
          {name}
        </span>
      </div>

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
                className="flex-1 py-1.5 text-[11px] font-semibold transition-colors cursor-pointer"
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

  // ── Mobile: horizontal pill strip ──
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
                <Icon size={14} />
                {m.name}
              </button>
            );
          })}
      </div>
    );
  }

  // ── Desktop: expanding pills grid ──
  const contextKey = submode ? `${selectedMode}/${submode}` : selectedMode;
  const context = CONTEXT_COPY[contextKey] ?? CONTEXT_COPY[selectedMode];

  return (
    <section className="w-full">
      <div className="mb-4 flex items-baseline gap-3 flex-wrap">
        <h2 className="text-lg font-bold text-white whitespace-nowrap">Capas de análisis</h2>
        <p className="text-sm text-white/65">
          Selecciona un modo para visualizar {city.name} desde diferentes perspectivas
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

      {context && (
        <div className="mt-5">
          <p className="text-sm font-bold text-white">{context.title}</p>
          <p className="text-sm text-white/75 mt-1 leading-relaxed">{context.body}</p>
        </div>
      )}
    </section>
  );
};

export default MapFilters;
