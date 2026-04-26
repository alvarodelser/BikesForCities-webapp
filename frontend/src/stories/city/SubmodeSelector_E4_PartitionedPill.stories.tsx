import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { List, Network, Route } from 'lucide-react';
import { CreamPage, MockCanvas, MOCK_MODES, findMode } from './_harness';

/**
 * E4 — Two-axis design (visualization vs computation).
 *
 *  ── Visualization submodes ──
 *    Live INSIDE the filter pill. When the mode is selected the pill
 *    partitions with a horizontal divider; the bottom half shows the
 *    submodes as a horizontal segmented row.
 *      • Stations → Viajes / Tiempo / Alcance (always visible when active)
 *      • Traffic  → Trayecto / Calor (only visible when an edge is selected)
 *    The active visualization is also echoed in the legend, compactly.
 *
 *  ── Computation options (Traffic only) ──
 *    Generation and Routing are NOT submodes — they are inputs to the
 *    underlying data. They live in CityStats as two filter-styled cards,
 *    each with an icon + label + segmented options.
 */

// ───────────────────────────────────────────────────────────────
// Filter strip with expanding pills
// ───────────────────────────────────────────────────────────────

type Visibility = 'always' | { requires: 'edge-selected' };

const VIZ_SUBMODES: Record<
  string,
  { items: { id: string; label: string }[]; visibility: Visibility } | undefined
> = {
  stations: {
    items: [
      { id: 'trips', label: 'Viajes' },
      { id: 'downtime', label: 'Tiempo' },
      { id: 'reach', label: 'Alcance' },
    ],
    visibility: 'always',
  },
  traffic: {
    items: [
      { id: 'trajectory', label: 'Trayecto' },
      { id: 'heatmap', label: 'Calor' },
    ],
    visibility: { requires: 'edge-selected' },
  },
};

function ExpandingPill({
  modeId,
  active,
  vizSubmodeId,
  edgeSelected,
  onModeClick,
  onVizChange,
}: {
  modeId: string;
  active: boolean;
  vizSubmodeId: string | undefined;
  edgeSelected: boolean;
  onModeClick: () => void;
  onVizChange: (id: string) => void;
}) {
  const mode = findMode(modeId);
  const Icon = mode.icon;
  const viz = VIZ_SUBMODES[modeId];
  const showSubmodes =
    active &&
    viz &&
    (viz.visibility === 'always' ||
      (typeof viz.visibility === 'object' &&
        viz.visibility.requires === 'edge-selected' &&
        edgeSelected));

  return (
    <div
      onClick={onModeClick}
      className="relative rounded-2xl border-2 transition-all duration-200 cursor-pointer overflow-hidden"
      style={{
        backgroundColor: active ? mode.color : 'rgba(255,255,255,0.7)',
        borderColor: active ? mode.color : 'rgba(0,0,0,0.08)',
        boxShadow: active
          ? `0 8px 24px ${mode.color}40, inset 0 1px 0 rgba(255,255,255,0.4)`
          : '0 2px 6px rgba(0,0,0,0.04)',
      }}
    >
      {/* Top half: mode label */}
      <div className="flex items-center gap-2 justify-center px-3 py-2.5">
        <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-[var(--blue-dark)]'}`} />
        <span
          className={`text-sm font-semibold ${
            active ? 'text-white' : 'text-[var(--blue)]'
          }`}
        >
          {mode.label}
        </span>
      </div>

      {/* Bottom half: viz submodes (only when active and conditions met) */}
      {showSubmodes && (
        <div
          className="border-t flex"
          style={{ borderColor: 'rgba(255,255,255,0.35)' }}
          onClick={e => e.stopPropagation()}
        >
          {viz!.items.map((s, i) => {
            const isActive = vizSubmodeId === s.id;
            return (
              <button
                key={s.id}
                onClick={() => onVizChange(s.id)}
                className="flex-1 px-2 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors"
                style={{
                  backgroundColor: isActive ? 'rgba(255,255,255,0.22)' : 'transparent',
                  color: isActive ? 'white' : 'rgba(255,255,255,0.7)',
                  borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.25)' : undefined,
                }}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Hint when traffic active but no edge selected */}
      {active &&
        modeId === 'traffic' &&
        !edgeSelected && (
          <div
            className="border-t px-3 py-1.5 text-[10px] italic text-center"
            style={{
              borderColor: 'rgba(255,255,255,0.35)',
              color: 'rgba(255,255,255,0.7)',
            }}
            onClick={e => e.stopPropagation()}
          >
            Selecciona un tramo para ver opciones
          </div>
        )}
    </div>
  );
}

function E4FilterStrip({
  activeMode,
  onModeChange,
  vizSubmodeId,
  onVizChange,
  edgeSelected,
}: {
  activeMode: string;
  onModeChange: (id: string) => void;
  vizSubmodeId: string | undefined;
  onVizChange: (id: string) => void;
  edgeSelected: boolean;
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 items-start">
      {MOCK_MODES.map(m => (
        <ExpandingPill
          key={m.id}
          modeId={m.id}
          active={activeMode === m.id}
          vizSubmodeId={activeMode === m.id ? vizSubmodeId : undefined}
          edgeSelected={edgeSelected}
          onModeClick={() => onModeChange(m.id)}
          onVizChange={onVizChange}
        />
      ))}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────
// Discreet legend echo of the active viz submode
// ───────────────────────────────────────────────────────────────

function E4LegendPanel({
  modeId,
  vizSubmodeId,
  edgeSelected,
}: {
  modeId: string;
  vizSubmodeId: string | undefined;
  edgeSelected: boolean;
}) {
  const mode = findMode(modeId);
  const viz = VIZ_SUBMODES[modeId];
  const showViz =
    viz &&
    (viz.visibility === 'always' ||
      (typeof viz.visibility === 'object' &&
        viz.visibility.requires === 'edge-selected' &&
        edgeSelected));
  const activeViz = showViz ? viz!.items.find(s => s.id === vizSubmodeId) : undefined;

  return (
    <div
      className="absolute bottom-6 left-6 z-10 w-[240px] rounded-2xl border bg-white/90 backdrop-blur-sm shadow-xl"
      style={{ borderColor: 'rgba(0,0,0,0.08)' }}
    >
      <div className="flex items-center justify-between px-4 py-2 border-b border-black/5">
        <div className="flex items-center gap-2">
          <List className="w-4 h-4 text-black/50" />
          <span className="text-[11px] uppercase tracking-wider font-black text-black/50">
            Leyenda
          </span>
        </div>
        {activeViz && (
          <span
            className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
            style={{ backgroundColor: `${mode.color}22`, color: mode.color }}
          >
            {activeViz.label}
          </span>
        )}
      </div>
      <div className="px-4 py-3 space-y-2">
        <div className="flex items-center gap-2">
          <div
            className="w-4 h-1 rounded-full"
            style={{ background: `linear-gradient(to right, ${mode.color}33, ${mode.color})` }}
          />
          <span className="text-xs text-black/60">Bajo → Alto</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-[#ead5c5]" />
          <span className="text-xs text-black/60">Edificios</span>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────
// CityStats computation cards (Traffic-only)
// ───────────────────────────────────────────────────────────────

const GENERATION_STRATEGIES = [
  { id: 'population', label: 'Población' },
  { id: 'pois', label: 'POIs' },
  { id: 'mixed', label: 'Mixto' },
];

const ROUTING_STRATEGIES = [
  { id: 'fastest', label: 'Más rápida' },
  { id: 'safest', label: 'Más segura' },
  { id: 'balanced', label: 'Equilibrada' },
];

function ComputationCard({
  icon: Icon,
  title,
  description,
  options,
  value,
  onChange,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
  accent: string;
}) {
  return (
    <div
      className="rounded-2xl border bg-white/80 backdrop-blur-sm overflow-hidden"
      style={{
        borderColor: 'rgba(0,0,0,0.08)',
        boxShadow: `inset 0 1px 0 ${accent}, 0 4px 16px rgba(0,0,0,0.04)`,
      }}
    >
      <div className="flex items-center gap-3 px-5 pt-5 pb-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{
            background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
            boxShadow: `0 4px 12px ${accent}55`,
          }}
        >
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <h3 className="text-base font-bold text-[var(--blue-dark)]">{title}</h3>
          <p className="text-xs text-[var(--blue)] opacity-70 truncate">{description}</p>
        </div>
      </div>
      <div className="px-5 pb-5">
        <div className="grid grid-cols-3 gap-2">
          {options.map(opt => {
            const active = value === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => onChange(opt.id)}
                className="px-2 py-2 rounded-xl text-xs font-semibold transition-all border"
                style={{
                  backgroundColor: active ? accent : 'white',
                  borderColor: active ? accent : 'rgba(0,0,0,0.08)',
                  color: active ? 'white' : 'var(--blue-dark)',
                  boxShadow: active ? `0 4px 12px ${accent}40` : undefined,
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MockCityStats({
  modeId,
  generationId,
  routingId,
  onGenerationChange,
  onRoutingChange,
}: {
  modeId: string;
  generationId: string;
  routingId: string;
  onGenerationChange: (id: string) => void;
  onRoutingChange: (id: string) => void;
}) {
  const mode = findMode(modeId);
  const showComputation = modeId === 'traffic';

  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-2xl font-bold text-[var(--blue-dark)]">
          Estadísticas de {mode.label}
        </h2>
        <p className="text-sm text-[var(--blue)] opacity-80">
          Análisis detallado y opciones de cómputo
        </p>
      </header>

      {showComputation && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ComputationCard
            icon={Network}
            title="Generación de viajes"
            description="Cómo se estima la demanda origen→destino"
            options={GENERATION_STRATEGIES}
            value={generationId}
            onChange={onGenerationChange}
            accent={mode.color}
          />
          <ComputationCard
            icon={Route}
            title="Cálculo de rutas"
            description="Algoritmo para asignar las rutas a la red"
            options={ROUTING_STRATEGIES}
            value={routingId}
            onChange={onRoutingChange}
            accent={mode.color}
          />
        </div>
      )}

      {/* Placeholder for the rest of the stats area */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {['Viajes/día', 'Cobertura', 'Red', 'Score'].map(label => (
          <div
            key={label}
            className="rounded-2xl bg-white/70 backdrop-blur-sm border border-black/10 p-4"
          >
            <p className="text-[10px] uppercase tracking-widest text-black/40 font-bold">
              {label}
            </p>
            <p className="text-xl font-bold text-[var(--blue-dark)] mt-1">—</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ───────────────────────────────────────────────────────────────
// Story
// ───────────────────────────────────────────────────────────────

const meta: Meta = {
  title: 'City/Submode Selector / E4 — Partitioned Pill + Computation',
  parameters: { layout: 'fullscreen' },
};
export default meta;
type Story = StoryObj;

function defaultViz(modeId: string) {
  return VIZ_SUBMODES[modeId]?.items[0]?.id;
}

function Playground({
  initialMode,
  initialEdgeSelected = false,
}: {
  initialMode: string;
  initialEdgeSelected?: boolean;
}) {
  const [modeId, setModeId] = React.useState(initialMode);
  const [vizId, setVizId] = React.useState<string | undefined>(defaultViz(initialMode));
  const [edgeSelected, setEdgeSelected] = React.useState(initialEdgeSelected);
  const [generationId, setGenerationId] = React.useState(GENERATION_STRATEGIES[0].id);
  const [routingId, setRoutingId] = React.useState(ROUTING_STRATEGIES[0].id);

  React.useEffect(() => {
    setVizId(defaultViz(modeId));
  }, [modeId]);

  const mode = findMode(modeId);

  return (
    <CreamPage>
      <E4FilterStrip
        activeMode={modeId}
        onModeChange={setModeId}
        vizSubmodeId={vizId}
        onVizChange={setVizId}
        edgeSelected={edgeSelected}
      />

      {modeId === 'traffic' && (
        <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-white/50 border border-dashed border-black/15 text-xs">
          <span className="font-bold text-[var(--blue-dark)]">Demo:</span>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={edgeSelected}
              onChange={e => setEdgeSelected(e.target.checked)}
              style={{ accentColor: mode.color }}
            />
            <span className="text-[var(--blue-dark)]">Simular tramo seleccionado</span>
          </label>
        </div>
      )}

      <MockCanvas accent={mode.color}>
        <E4LegendPanel
          modeId={modeId}
          vizSubmodeId={vizId}
          edgeSelected={edgeSelected}
        />
      </MockCanvas>

      <MockCityStats
        modeId={modeId}
        generationId={generationId}
        routingId={routingId}
        onGenerationChange={setGenerationId}
        onRoutingChange={setRoutingId}
      />
    </CreamPage>
  );
}

export const Stations: Story = { render: () => <Playground initialMode="stations" /> };
export const Traffic_NoEdge: Story = {
  name: 'Traffic — no edge selected',
  render: () => <Playground initialMode="traffic" />,
};
export const Traffic_EdgeSelected: Story = {
  name: 'Traffic — edge selected',
  render: () => <Playground initialMode="traffic" initialEdgeSelected />,
};
export const Infrastructure: Story = {
  render: () => <Playground initialMode="infrastructure" />,
};
