import React from 'react';
import type { CityData } from '../../../../../constants/cities';
import { useAccidentsStats } from '../../../../../hooks/useAccidentsStats';
import { useMapState } from '../../../../../hooks/useMapState';
import MetricPill from '../../../pills/MetricPill';
import StackedBarMatrix from '../../../plots/StackedBarMatrix';
import BarHistogram from '../../../plots/BarHistogram';
import CollisionHeatmap from '../../../plots/CollisionHeatmap';
import { Car, Bus, Truck, Motorcycle, PersonSimpleWalk, Bicycle, Sun, CloudRain } from '@phosphor-icons/react';


export interface AccidentsStatsProps {
  city: CityData;
  variant?: 'light' | 'darkTint';
}

const SEVERITY_LABELS = ['Ileso', 'Leve', 'Grave', 'Fatal'];
const ACCENT = '#ef4444';

// Caída sola uses Bicycle since it covers solo falls and bike-vs-bike incidents
const CYCLIST_ROW_ICONS = [
  <Car size={13} color="#6b7280" />,
  <Bus size={13} color="#f59e0b" />,
  <Truck size={13} color="#78716c" />,
  <Motorcycle size={13} color="#8b5cf6" />,
  <Bicycle size={13} color="#ef4444" />,
];

const PEDESTRIAN_ROW_ICONS = [
  <Car size={13} color="#6b7280" />,
  <Bus size={13} color="#f59e0b" />,
  <Truck size={13} color="#78716c" />,
  <Motorcycle size={13} color="#8b5cf6" />,
  <Bicycle size={13} color="#22c55e" />,
];

// ── Year timeline component ───────────────────────────────────────────────────

interface YearTimelineProps {
  years: number[];
  selected: number | null;
  onSelect: (year: number | null) => void;
}

function YearTimeline({ years, selected, onSelect }: YearTimelineProps) {
  if (years.length === 0) return null;

  const sorted = [...years].sort((a, b) => a - b);

  return (
    <div
      className="rounded-2xl border bg-white/80 backdrop-blur-sm overflow-hidden"
      style={{ borderColor: 'rgba(0,0,0,0.08)', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT}cc)`, boxShadow: `0 4px 12px ${ACCENT}55` }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--blue-dark)]">Período</h3>
            <p className="text-[10px] text-[var(--blue)] opacity-70">
              {selected != null ? `Mostrando año ${selected}` : 'Todos los años'}
            </p>
          </div>
        </div>
        {selected != null && (
          <button
            onClick={() => onSelect(null)}
            className="text-[10px] font-bold px-2 py-1 rounded-lg transition-all"
            style={{ color: ACCENT, backgroundColor: `${ACCENT}15`, border: `1px solid ${ACCENT}30` }}
          >
            Ver todos
          </button>
        )}
      </div>

      {/* Timeline */}
      <div className="px-4 pb-4">
        <div className="relative">
          {/* Connecting line */}
          <div
            className="absolute top-[11px] left-3 right-3 h-[2px]"
            style={{ backgroundColor: 'rgba(0,0,0,0.08)' }}
          />
          {/* Active segment overlay */}
          {selected != null && (() => {
            const idx = sorted.indexOf(selected);
            if (idx < 0 || sorted.length <= 1) return null;
            const leftPct = (idx / (sorted.length - 1)) * 100;
            return (
              <div
                className="absolute top-[11px] h-[2px]"
                style={{
                  left: `calc(${leftPct}% + 12px - ${leftPct / 100 * 24}px)`,
                  width: 0,
                  backgroundColor: ACCENT,
                }}
              />
            );
          })()}

          {/* Dots */}
          <div className="relative flex justify-between">
            {sorted.map((yr) => {
              const isActive = selected === yr;
              return (
                <button
                  key={yr}
                  onClick={() => onSelect(isActive ? null : yr)}
                  className="flex flex-col items-center gap-1.5 group"
                  style={{ minWidth: 0 }}
                >
                  {/* Dot */}
                  <div
                    className="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200"
                    style={{
                      backgroundColor: isActive ? ACCENT : 'white',
                      borderColor: isActive ? ACCENT : 'rgba(0,0,0,0.15)',
                      boxShadow: isActive ? `0 0 0 3px ${ACCENT}25, 0 4px 8px ${ACCENT}40` : '0 1px 3px rgba(0,0,0,0.1)',
                      transform: isActive ? 'scale(1.2)' : 'scale(1)',
                    }}
                  >
                    {isActive && (
                      <div className="w-2 h-2 rounded-full bg-white" />
                    )}
                  </div>
                  {/* Year label */}
                  <span
                    className="text-[9px] font-bold transition-all duration-200"
                    style={{
                      color: isActive ? ACCENT : 'rgba(0,0,0,0.4)',
                      transform: isActive ? 'scale(1.1)' : 'scale(1)',
                    }}
                  >
                    {yr}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const AccidentsStats: React.FC<AccidentsStatsProps> = ({ city, variant }) => {
  const { submode, setSubmode, period, setPeriod } = useMapState();

  // period stores the selected year as a string (same param as traffic mode)
  const selectedYear = period ? parseInt(period, 10) : undefined;
  const handleYearSelect = (yr: number | null) => setPeriod(yr != null ? String(yr) : '');

  const {
    totalAccidents,
    cyclistAccidents,
    latestYear,
    availableYears,
    cyclistVehicleMatrix,
    pedestrianVehicleMatrix,
    epacWeatherBars,
    collisionMatrix,
    hasAllAccidentData,
    loading,
  } = useAccidentsStats(city.id ?? null, selectedYear);

  // Default to bike when no submode is in the URL.
  const activeLayer: 'all' | 'bike' = submode === 'all' ? 'all' : 'bike';

  function handleLayerToggle(layer: 'all' | 'bike') {
    setSubmode(layer);
  }

  const fmt = (n: number) => (loading ? '—' : n.toLocaleString('es'));

  return (
    <div className="w-full flex flex-col gap-6">

      {/* ── Header with toggle ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-1">
        <div>
          <h2 className={`text-2xl font-bold ${variant === 'darkTint' ? 'text-[var(--blue-dark)]' : 'text-white'}`}>Siniestralidad Vial</h2>
        </div>

        <div className="flex items-center gap-1 bg-gray-100/50 p-1 rounded-xl border border-black/5">
          <button
            onClick={() => handleLayerToggle('bike')}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center gap-2 ${
              activeLayer === 'bike'
                ? 'bg-white text-red-600 shadow-sm'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <div className={`w-2 h-2 rounded-full ${activeLayer === 'bike' ? 'bg-red-500 animate-pulse' : 'bg-red-200'}`} />
            BICICLETA ({fmt(cyclistAccidents)})
          </button>
          <button
            onClick={() => handleLayerToggle('all')}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center gap-2 ${
              activeLayer === 'all'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <div className={`w-2 h-2 rounded-full ${activeLayer === 'all' ? 'bg-gray-400' : 'bg-gray-200'}`} />
            TODOS ({fmt(totalAccidents)})
          </button>
        </div>
      </div>

      {/* ── Year timeline ──────────────────────────────────────────────────── */}
      <YearTimeline
        years={availableYears}
        selected={selectedYear ?? null}
        onSelect={handleYearSelect}
      />

      {/* ── Stat pills ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MetricPill
          value={fmt(totalAccidents)}
          label="Total accidentes"
          accent={ACCENT}
          variant={variant}
          helpContent="Número total de accidentes registrados en el municipio para el período seleccionado."
        />
        <MetricPill
          value={fmt(cyclistAccidents)}
          label="Accidentes con bici"
          accent={ACCENT}
          variant={variant}
          helpContent="Accidentes donde al menos un vehículo implicado era una bicicleta."
        />
        <MetricPill
          value={totalAccidents > 0 ? `${((cyclistAccidents / totalAccidents) * 100).toFixed(1)} %` : '—'}
          label="Incidencia ciclista"
          accent={ACCENT}
          variant={variant}
        />
        <MetricPill
          value={loading ? '—' : (selectedYear != null ? String(selectedYear) : latestYear != null ? String(latestYear) : '—')}
          label="Año de datos"
          accent="#6b7280"
          variant={variant}
        />
      </div>

      {/* ── Matrices ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StackedBarMatrix
          rows={cyclistVehicleMatrix}
          segmentLabels={SEVERITY_LABELS}
          title="Severidad ciclista"
          subtitle="Por tipo de vehículo implicado"
          rowIcons={CYCLIST_ROW_ICONS}
        />
        <StackedBarMatrix
          rows={pedestrianVehicleMatrix}
          segmentLabels={SEVERITY_LABELS}
          title="Severidad peatonal"
          subtitle={hasAllAccidentData ? 'Por tipo de vehículo implicado' : 'Selecciona un año para ver los datos'}
          rowIcons={PEDESTRIAN_ROW_ICONS}
        />
      </div>

      {/* ── History/Weather ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1">
        <BarHistogram
          data={epacWeatherBars.map(d => ({
            ...d,
            icon: d.label.includes('lluvia') ? CloudRain : Sun,
          }))}
          accent={ACCENT}
          title="Bicicleta y EPAC: seco vs lluvia"
          subtitle="Accidentes ciclistas según condiciones meteorológicas"
        />
      </div>

      {/* ── Collision matrix ───────────────────────────────────────────────── */}
      {hasAllAccidentData && collisionMatrix.length > 0 ? (
        <CollisionHeatmap
          data={collisionMatrix}
          title="Matriz de colisiones"
          subtitle="Accidentes por par de vehículos · color = gravedad media"
        />
      ) : (
        <div
          className="rounded-2xl border bg-white/50 backdrop-blur-sm p-5 text-center"
          style={{ borderColor: 'rgba(0,0,0,0.08)' }}
        >
          <p className="text-sm font-bold text-gray-400">Matriz de colisiones</p>
          <p className="text-[11px] text-gray-400 mt-1">Selecciona un año para ver la matriz entre tipos de vehículo</p>
        </div>
      )}
    </div>
  );
};

export default AccidentsStats;
