import * as React from 'react';
import { Network } from 'lucide-react';
import { Graph, Bicycle, Warning } from '@phosphor-icons/react';

export type Strategy = { id: string; label: string };
export type Submode = { id: string; label: string; strategies?: Strategy[] };

export type MockMode = {
  id: string;
  label: string;
  color: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  submodes: Submode[];
};

export const MOCK_MODES: MockMode[] = [
  { id: 'infrastructure', label: 'Infraestructura', color: 'var(--blue)', icon: Network, submodes: [] },
  {
    id: 'traffic',
    label: 'Modelo de Movilidad',
    color: 'var(--red)',
    icon: Graph,
    submodes: [
      {
        id: 'generation',
        label: 'Generación de viajes',
        strategies: [
          { id: 'population', label: 'Población' },
          { id: 'pois', label: 'POIs' },
          { id: 'mixed', label: 'Mixto' },
        ],
      },
      {
        id: 'routing',
        label: 'Cálculo de rutas',
        strategies: [
          { id: 'fastest', label: 'Más rápida' },
          { id: 'safest', label: 'Más segura' },
          { id: 'balanced', label: 'Equilibrada' },
        ],
      },
    ],
  },
  {
    id: 'stations',
    label: 'Servicio Bici',
    color: 'var(--green)',
    icon: Bicycle,
    submodes: [
      { id: 'trips', label: 'Demanda' },
      { id: 'downtime', label: 'Disponibilidad' },
      { id: 'reach', label: 'Cobertura' },
    ],
  },
  { id: 'accidents', label: 'Accidentalidad', color: 'var(--red)', icon: Warning, submodes: [] },
];

const themeVars: React.CSSProperties = {
  ['--green-light' as string]: '#BFDDCE',
  ['--green' as string]: '#7BA492',
  ['--green-dark' as string]: '#027A76',
  ['--blue-light' as string]: '#92BEC9',
  ['--blue' as string]: '#3A6C7F',
  ['--blue-dark' as string]: '#003849',
  ['--yellow' as string]: '#F4A24C',
  ['--orange' as string]: '#FF7F50',
  ['--red' as string]: '#AF4749',
  ['--cream' as string]: '#FBF6EF',
  ['--cream-dark' as string]: '#F9E9DC',
  ['--space-gutter' as string]: 'clamp(1rem, 4vw, 6rem)',
};

export function CreamPage({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen w-full"
      style={{ ...themeVars, backgroundColor: 'var(--cream)' }}
    >
      <div className="px-[var(--space-gutter)] py-10 space-y-6">{children}</div>
    </div>
  );
}

export function MockFilterStrip({
  activeMode,
  onModeChange,
}: {
  activeMode: string;
  onModeChange: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {MOCK_MODES.map(m => {
        const active = activeMode === m.id;
        const Icon = m.icon;
        return (
          <button
            key={m.id}
            onClick={() => onModeChange(m.id)}
            className="relative p-3 rounded-2xl border-2 transition-all duration-200"
            style={{
              backgroundColor: active ? m.color : 'rgba(255,255,255,0.7)',
              borderColor: active ? m.color : 'rgba(0,0,0,0.08)',
              boxShadow: active
                ? `0 8px 24px ${m.color}40, inset 0 1px 0 rgba(255,255,255,0.4)`
                : '0 2px 6px rgba(0,0,0,0.04)',
            }}
          >
            <div className="flex items-center gap-2 justify-center">
              <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-[var(--blue-dark)]'}`} />
              <span
                className={`text-sm font-semibold ${
                  active ? 'text-white' : 'text-[var(--blue)]'
                }`}
              >
                {m.label}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function MockCanvas({
  accent,
  children,
  height = 'h-[480px]',
}: {
  accent: string;
  children?: React.ReactNode;
  height?: string;
}) {
  return (
    <div
      className={`relative w-full ${height} rounded-2xl overflow-hidden`}
      style={{
        backgroundColor: 'rgba(255,255,255,0.6)',
        backdropFilter: 'blur(8px)',
        boxShadow: `inset 0 1px 0 ${accent}, 0 12px 36px rgba(0,0,0,0.08), 0 0 0 1px ${accent}33`,
      }}
    >
      {/* Faux map grid pattern so the canvas reads as "map area" not "empty card" */}
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            'linear-gradient(to right, #000 1px, transparent 1px), linear-gradient(to bottom, #000 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
      <div className="absolute inset-0 flex items-center justify-center text-black/25 text-xs font-mono uppercase tracking-[0.3em]">
        canvas placeholder
      </div>
      {children}
    </div>
  );
}

export function findMode(id: string) {
  return MOCK_MODES.find(m => m.id === id) ?? MOCK_MODES[0];
}
