import React, { useState, useEffect } from 'react';
import { Navigation, Users, TrendingUp, Activity, Calendar, Network, Route } from 'lucide-react';
import type { CityData } from '../../../../../constants/cities';
import type { TrafficOptions } from '../../../../../hooks/useTrafficStats';
import { useTrafficStats } from '../../../../../hooks/useTrafficStats';
import { fetchTrafficResolve, fetchTrafficInfraCoverage } from '../../../../../services/api';
import MetricPill from '../../../pills/MetricPill';
import RouteHistograms from '../../../plots/RouteHistograms';
import LineAreaChart from '../../../plots/LineAreaChart';

export interface TrafficStatsProps {
  city: CityData;
}

const GENERATION_OPTIONS: { value: TrafficOptions['generationType']; label: string }[] = [
  { value: 'real', label: 'GPS real' },
  { value: 'station_based', label: 'Estaciones' },
  { value: 'buildings_population', label: 'Población' },
];

const ALGORITHM_OPTIONS: { value: TrafficOptions['algorithm']; label: string }[] = [
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
  options: { value: string | undefined; label: string }[];
  activeValue: string | undefined;
  onSelect: (v: string | undefined) => void;
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
          return (
            <button
              key={String(opt.value)}
              onClick={() => onSelect(opt.value)}
              className="px-3 py-1 rounded-xl text-xs font-bold transition-all border"
              style={{
                backgroundColor: isActive ? ACCENT : 'white',
                borderColor: isActive ? ACCENT : 'rgba(0,0,0,0.08)',
                color: isActive ? 'white' : 'var(--blue-dark)',
                boxShadow: isActive ? `0 4px 12px ${ACCENT}40` : undefined,
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

const TrafficStats: React.FC<TrafficStatsProps> = ({ city }) => {
  const [selectedPeriod, setSelectedPeriod] = useState<string | undefined>(undefined);
  const [generationType, setGenerationType] = useState<TrafficOptions['generationType']>(undefined);
  const [algorithm, setAlgorithm] = useState<TrafficOptions['algorithm']>(undefined);

  const options: TrafficOptions = { period: selectedPeriod, generationType, algorithm };

  const { tripsPerMonth, tripsPerThousandHab, maxVolume, maxEdgeName, availablePeriods, loading } =
    useTrafficStats(city.id ?? null, options, city.population);

  const [infraFraction, setInfraFraction] = useState<number | null>(null);
  useEffect(() => {
    if (!city.id) return;
    let cancelled = false;
    fetchTrafficInfraCoverage(city.id, generationType, algorithm, selectedPeriod)
      .then(cov => { if (!cancelled) setInfraFraction(cov?.infra_fraction ?? null); })
      .catch(() => { if (!cancelled) setInfraFraction(null); });
    return () => { cancelled = true; };
  }, [city.id, generationType, algorithm, selectedPeriod]);

  useEffect(() => {
    if (availablePeriods.length > 0 && !selectedPeriod) {
      setSelectedPeriod(availablePeriods[0]);
    }
  }, [availablePeriods, selectedPeriod]);

  const [evolutionData, setEvolutionData] = useState<Record<string, unknown>[]>([]);
  useEffect(() => {
    if (!city.id || availablePeriods.length === 0) return;
    let cancelled = false;
    Promise.allSettled(
      availablePeriods.map(period =>
        fetchTrafficResolve(city.id!, generationType, algorithm, period).then(t => ({
          period,
          tripsPerMonth: t.edge_count ?? 0,
        })),
      ),
    ).then(results => {
      if (cancelled) return;
      const points = results
        .filter(r => r.status === 'fulfilled')
        .map(r => (r as PromiseFulfilledResult<{ period: string; tripsPerMonth: number }>).value)
        .sort((a, b) => a.period.localeCompare(b.period));
      setEvolutionData(points);
    });
    return () => { cancelled = true; };
  }, [city.id, availablePeriods, generationType, algorithm]);

  const tripsStr = loading ? '—' : fmt(tripsPerMonth, 0, '');
  const tphStr = loading ? '—' : fmt(tripsPerThousandHab, 1, '');
  const infraFractionStr = loading ? '—' : (infraFraction !== null ? `${(infraFraction * 100).toFixed(1)}%` : '—');
  const maxVolumeStr = loading ? '—' : fmt(maxVolume, 0, '');

  return (
    <div className="w-full flex flex-col gap-4">

      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">Tráfico Ciclista</h2>
      </div>

      {/* ── Filter cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <FilterCard
          icon={Calendar}
          title="Período"
          description="Mes / período de datos"
          options={availablePeriods.map(p => ({ value: p, label: p }))}
          activeValue={selectedPeriod}
          onSelect={v => setSelectedPeriod(v)}
        />
        <FilterCard
          icon={Network}
          title="Generación"
          description="Estimación de la demanda"
          options={GENERATION_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
          activeValue={generationType}
          onSelect={v => setGenerationType(v as TrafficOptions['generationType'])}
        />
        <FilterCard
          icon={Route}
          title="Enrutamiento"
          description="Algoritmo de asignación de rutas"
          options={ALGORITHM_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
          activeValue={algorithm}
          onSelect={v => setAlgorithm(v as TrafficOptions['algorithm'])}
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
          helpContent="Número total de rutas estimadas para el período y configuración seleccionados. Cada ruta representa un viaje en bicicleta modelado a partir de la fuente de generación elegida."
        />
        <MetricPill
          loading={loading}
          value={infraFractionStr}
          label="Tráfico en carril"
          sublabel="% rutas sobre infra. ciclista"
          icon={TrendingUp}
          accent={ACCENT}
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
          helpContent="Viajes estimados por cada 1.000 habitantes. Permite comparar la intensidad del uso ciclista entre ciudades de distinto tamaño."
        />
        <MetricPill
          loading={loading}
          value={maxVolumeStr}
          label="Tramo más cargado"
          sublabel={loading ? 'Cargando…' : (maxEdgeName ?? 'Sin nombre')}
          icon={Activity}
          accent={ACCENT}
          helpContent="Número máximo de viajes que pasan por un único tramo de la red ciclista, identificando el corredor de mayor demanda."
        />
      </div>

      {/* ── Charts ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        {city.id != null && <RouteHistograms cityId={city.id} accent={ACCENT} />}
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
    </div>
  );
};

export default TrafficStats;
