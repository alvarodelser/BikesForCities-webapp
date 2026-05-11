import React, { useState, useEffect } from 'react';
import { Navigation, Users, TrendingUp, Activity, Calendar, Network, Route } from 'lucide-react';
import type { CityData } from '../../../../../constants/cities';
import type { TrafficOptions } from '../../../../../hooks/useTrafficStats';
import { useTrafficStats } from '../../../../../hooks/useTrafficStats';
import { fetchTrafficInfraCoverage, fetchTrafficResolve } from '../../../../../services/api';
import { useMapState } from '../../../../../hooks/useMapState';
import MetricPill from '../../../pills/MetricPill';
import LineAreaChart from '../../../plots/LineAreaChart';

export interface TrafficStatsProps {
  city: CityData;
  variant?: 'light' | 'darkTint';
}

const GENERATION_OPTIONS: { value: string; label: string }[] = [
  { value: 'real', label: 'GPS real' },
  { value: 'station_based', label: 'Estaciones' },
  { value: 'buildings_population', label: 'Población' },
];

const ALGORITHM_OPTIONS: { value: string; label: string }[] = [
  { value: 'map_matched', label: 'Map-matched' },
  { value: 'shortest', label: 'Ruta corta' },
  { value: 'safest', label: 'Ruta segura' },
];

function fmt(value: number | null, decimals: number, suffix: string): string {
  if (value === null) return '—';
  return suffix ? `${value.toFixed(decimals)} ${suffix}` : value.toFixed(decimals);
}

const ACCENT = '#3A6C7F';

interface FilterCardProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  options: { value: string; label: string; disabled?: boolean }[];
  activeValue: string | undefined;
  onSelect: (v: string) => void;
}

function FilterCard({ icon: Icon, title, description, options, activeValue, onSelect }: FilterCardProps) {
  return (
    <div
      className="rounded-2xl border bg-white/80 backdrop-blur-sm overflow-hidden"
      style={{ borderColor: 'rgba(0,0,0,0.08)', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}
    >
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT}cc)`, boxShadow: `0 4px 12px ${ACCENT}55` }}
        >
          <Icon className="w-4 h-4 text-white" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-[var(--blue-dark)]">{title}</h3>
          <p className="text-[10px] text-[var(--blue)] opacity-70 truncate">{description}</p>
        </div>
      </div>
      <div className="px-4 pb-4 flex flex-wrap gap-1.5">
        {options.map(opt => {
          const isActive = activeValue === opt.value;
          const isDisabled = opt.disabled === true;
          return (
            <button
              key={opt.value}
              onClick={() => !isDisabled && onSelect(opt.value)}
              disabled={isDisabled}
              className="px-3 py-1 rounded-xl text-xs font-bold transition-all border"
              style={{
                backgroundColor: isActive ? ACCENT : 'white',
                borderColor: isActive ? ACCENT : 'rgba(0,0,0,0.08)',
                color: isActive ? 'white' : isDisabled ? 'rgba(0,0,0,0.25)' : 'var(--blue-dark)',
                boxShadow: isActive ? `0 4px 12px ${ACCENT}40` : undefined,
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                opacity: isDisabled ? 0.45 : 1,
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface PeriodDropdownProps {
  periods: string[];
  value: string | undefined;
  onChange: (v: string) => void;
}

function PeriodDropdown({ periods, value, onChange }: PeriodDropdownProps) {
  return (
    <div
      className="rounded-2xl border bg-white/80 backdrop-blur-sm overflow-hidden"
      style={{ borderColor: 'rgba(0,0,0,0.08)', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}
    >
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT}cc)`, boxShadow: `0 4px 12px ${ACCENT}55` }}
        >
          <Calendar className="w-4 h-4 text-white" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-[var(--blue-dark)]">Período</h3>
          <p className="text-[10px] text-[var(--blue)] opacity-70 truncate">Mes / período de datos</p>
        </div>
      </div>
      <div className="px-4 pb-4">
        <select
          value={value ?? ''}
          onChange={e => onChange(e.target.value)}
          className="w-full px-3 py-1.5 rounded-xl text-xs font-bold border transition-all appearance-none cursor-pointer"
          style={{
            borderColor: value ? ACCENT : 'rgba(0,0,0,0.08)',
            color: 'var(--blue-dark)',
            backgroundColor: 'white',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%233A6C7F' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 10px center',
            paddingRight: '28px',
          }}
        >
          {periods.length === 0 && <option value="">—</option>}
          {periods.map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

type Combo = { generation_type: string; algorithm: string };

const TrafficStats: React.FC<TrafficStatsProps> = ({ city, variant }) => {
  // Shared state via URL params — TrafficLayer reads/writes the same values
  const { generation, routing, period, setGeneration, setRouting, setPeriod } = useMapState();

  const combos = (city?.available_modes?.traffic_combinations as Combo[] | undefined) ?? [];

  // Which generation types have any data for this city
  const availableGenerations = new Set(combos.map(c => c.generation_type));

  // Which algorithms are valid for the currently-selected generation (or all if none selected)
  const availableAlgorithms = generation
    ? new Set(combos.filter(c => c.generation_type === generation).map(c => c.algorithm))
    : new Set(combos.map(c => c.algorithm));

  const handleGenerationSelect = (v: string) => {
    setGeneration(v);
    // If current routing is not valid for the new generation, pick the first valid one
    const validAlgos = new Set(combos.filter(c => c.generation_type === v).map(c => c.algorithm));
    if (routing && !validAlgos.has(routing)) {
      const firstValid = combos.find(c => c.generation_type === v)?.algorithm;
      if (firstValid) setRouting(firstValid);
    }
  };

  const options: TrafficOptions = {
    period: period || undefined,
    generationType: (generation || undefined) as TrafficOptions['generationType'],
    algorithm: (routing || undefined) as TrafficOptions['algorithm'],
  };

  const { tripsPerMonth, tripsPerThousandHab, maxVolume, maxEdgeName, availablePeriods, loading } =
    useTrafficStats(city.id ?? null, options, city.population);

  const [infraFraction, setInfraFraction] = useState<number | null>(null);
  useEffect(() => {
    if (!city.id) return;
    let cancelled = false;
    fetchTrafficInfraCoverage(city.id, generation || undefined, routing || undefined, period || undefined)
      .then(cov => { if (!cancelled) setInfraFraction(cov?.infra_fraction ?? null); })
      .catch(() => { if (!cancelled) setInfraFraction(null); });
    return () => { cancelled = true; };
  }, [city.id, generation, routing, period]);

  const [evolutionData, setEvolutionData] = useState<Record<string, unknown>[]>([]);
  useEffect(() => {
    if (!city.id || availablePeriods.length === 0) return;
    let cancelled = false;

    // Fetch periods sequentially to avoid flooding the single-worker API
    // with 17 parallel requests that queue up and stall everything else.
    async function loadEvolution() {
      const points: { period: string; tripsPerMonth: number }[] = [];
      for (const p of availablePeriods) {
        if (cancelled) return;
        try {
          const t = await fetchTrafficResolve(city.id!, generation || undefined, routing || undefined, p);
          points.push({ period: p, tripsPerMonth: t.edge_count ?? 0 });
        } catch {
          // skip failed periods
        }
      }
      if (!cancelled) setEvolutionData([...points].sort((a, b) => a.period.localeCompare(b.period)));
    }

    loadEvolution();
    return () => { cancelled = true; };
  }, [city.id, availablePeriods, generation, routing]);

  const tripsStr = loading ? '—' : fmt(tripsPerMonth, 0, '');
  const tphStr = loading ? '—' : fmt(tripsPerThousandHab, 1, '');
  const infraFractionStr = loading ? '—' : (infraFraction !== null ? `${(infraFraction * 100).toFixed(1)}%` : '—');
  const maxVolumeStr = loading ? '—' : fmt(maxVolume, 0, '');

  return (
    <div className="w-full flex flex-col gap-4">

      {/* Header */}
      <div>
        <h2 className={`text-2xl font-bold ${variant === 'darkTint' ? 'text-[var(--blue-dark)]' : 'text-white'}`}>Tráfico Ciclista</h2>
      </div>

      {/* ── Filter cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <PeriodDropdown
          periods={availablePeriods}
          value={period || undefined}
          onChange={v => setPeriod(v)}
        />
        <FilterCard
          icon={Network}
          title="Generación"
          description="Estimación de la demanda"
          options={GENERATION_OPTIONS.map(o => ({ ...o, disabled: !availableGenerations.has(o.value) }))}
          activeValue={generation || undefined}
          onSelect={handleGenerationSelect}
        />
        <FilterCard
          icon={Route}
          title="Enrutamiento"
          description="Algoritmo de asignación de rutas"
          options={ALGORITHM_OPTIONS.map(o => ({ ...o, disabled: !availableAlgorithms.has(o.value) }))}
          activeValue={routing || undefined}
          onSelect={v => setRouting(v)}
        />
      </div>

      {/* ── Row 1: Viajes + Tráfico en carril ───────────────────────────── */}
      <div className="grid grid-cols-2 gap-4">
        <MetricPill
          loading={loading}
          value={tripsStr}
          label="Viajes / mes"
          sublabel="Rutas estimadas en el período"
          icon={Navigation}
          accent={ACCENT}
          variant={variant}
          helpContent="Número total de rutas estimadas para el período y configuración seleccionados. Cada ruta representa un viaje en bicicleta modelado a partir de la fuente de generación elegida."
        />
        <MetricPill
          loading={loading}
          value={infraFractionStr}
          label="Tráfico en carril"
          sublabel="% rutas sobre infra. ciclista"
          icon={TrendingUp}
          accent={ACCENT}
          variant={variant}
          helpContent="Porcentaje de los viajes generados que discurren por carriles bici existentes. Un valor alto indica que la infraestructura está bien alineada con los flujos de demanda."
        />
      </div>

      {/* ── Row 2: Uso relativo + Tramo más cargado ──────────────────────── */}
      <div className="grid grid-cols-2 gap-4">
        <MetricPill
          loading={loading}
          value={tphStr}
          label="Uso relativo"
          sublabel="Viajes / 1.000 hab."
          icon={Users}
          accent={ACCENT}
          variant={variant}
          helpContent="Viajes estimados por cada 1.000 habitantes. Permite comparar la intensidad del uso ciclista entre ciudades de distinto tamaño."
        />
        <MetricPill
          loading={loading}
          value={maxVolumeStr}
          label="Tramo más cargado"
          sublabel={loading ? 'Cargando…' : (maxEdgeName ?? 'Sin nombre')}
          icon={Activity}
          accent={ACCENT}
          variant={variant}
          helpContent="Número máximo de viajes que pasan por un único tramo de la red ciclista, identificando el corredor de mayor demanda."
        />
      </div>

      {/* ── Charts ───────────────────────────────────────────────────────── */}
      {evolutionData.length > 0 && (
        <LineAreaChart
          data={evolutionData}
          xKey="period"
          title="Evolución de viajes"
          subtitle="Total de rutas generadas por mes"
          series={[
            {
              key: 'tripsPerMonth',
              label: 'Viajes/mes',
              color: '#4b749f',
              type: 'area',
            },
          ]}
          helpContent={
            <p>
              Evolución mensual del número total de rutas estimadas en bicicleta para la configuración seleccionada.
              Permite identificar tendencias de crecimiento o estacionalidad en la demanda ciclista.
            </p>
          }
        />
      )}
    </div>
  );
};

export default TrafficStats;
