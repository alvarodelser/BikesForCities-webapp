import React, { useState, useEffect } from 'react';
import type { CityData } from '../../../../../constants/cities';
import type { TrafficOptions } from '../../../../../hooks/useTrafficStats';
import { useTrafficStats } from '../../../../../hooks/useTrafficStats';
import { fetchTraffic, fetchTrafficInfraCoverage } from '../../../../../services/api';
import MetricPill from '../../../pills/MetricPill';
import RouteHistograms from '../../../plots/RouteHistograms';
import LineAreaChart from '../../../plots/LineAreaChart';
import ScoreDonut from '../../../plots/ScoreDonut';
import CityRankTable from '../../../plots/CityRankTable';

export interface TrafficStatsProps {
  city: CityData;
}

// ── label maps ─────────────────────────────────────────────────────────────────

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

// ── helpers ─────────────────────────────────────────────────────────────────────

function fmt(value: number | null, decimals: number, suffix: string): string {
  if (value === null) return '—';
  return `${value.toFixed(decimals)} ${suffix}`;
}

// ── main component ──────────────────────────────────────────────────────────────

const TrafficStats: React.FC<TrafficStatsProps> = ({ city }) => {
  const [selectedPeriod, setSelectedPeriod] = useState<string | undefined>(undefined);
  const [generationType, setGenerationType] = useState<TrafficOptions['generationType']>(undefined);
  const [algorithm, setAlgorithm] = useState<TrafficOptions['algorithm']>(undefined);

  const options: TrafficOptions = {
    period: selectedPeriod,
    generationType,
    algorithm,
  };

  const { tripsPerMonth, tripsPerThousandHab, medianVolume, availablePeriods, loading } =
    useTrafficStats(city.id ?? null, options, city.population);

  const [infraFraction, setInfraFraction] = useState<number | null>(null);
  useEffect(() => {
    if (!city.id) return;
    let cancelled = false;
    fetchTrafficInfraCoverage(city.id, generationType, algorithm, selectedPeriod)
      .then(cov => {
        if (!cancelled) setInfraFraction(cov?.infra_fraction ?? null);
      })
      .catch(() => {
        if (!cancelled) setInfraFraction(null);
      });
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
        fetchTraffic(city.id!, generationType, algorithm, period).then(t => ({
          period,
          tripsPerMonth: t.count,
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

  const displayLoading = loading;
  const tripsStr = displayLoading ? '—' : fmt(tripsPerMonth, 0, '');
  const tphStr = displayLoading
    ? '—'
    : tripsPerThousandHab !== null
    ? `${tripsPerThousandHab.toFixed(1)}`
    : '—';

  const infraFractionStr = displayLoading
    ? '—'
    : infraFraction !== null
    ? `${(infraFraction * 100).toFixed(1)}%`
    : '—';

  const medianStr = displayLoading
    ? '—'
    : medianVolume !== null
    ? `${medianVolume.toFixed(0)} v/tramo`
    : '—';

  const trafficSegments = city.mode_scores?.traffic?.segments ?? [];
  const trafficOverall = city.mode_scores?.traffic?.overall ?? 0;
  const ACCENT = '#15803d';

  return (
    <div className="w-full flex flex-col gap-8">
      {/* ── Selection pills row ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 p-4 bg-gray-50/50 rounded-2xl border border-black/5 backdrop-blur-sm">
        {/* Período */}
        {availablePeriods.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest w-24 shrink-0">Período:</span>
            <div className="flex flex-wrap gap-1.5">
              {availablePeriods.map(p => (
                <button
                  key={p}
                  onClick={() => setSelectedPeriod(p)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all border ${
                    selectedPeriod === p
                      ? 'bg-[#15803d] text-white border-[#15803d] shadow-sm'
                      : 'bg-white text-gray-500 border-black/5 hover:bg-gray-100'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Generación */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest w-24 shrink-0">Generación:</span>
          <div className="flex flex-wrap gap-1.5">
            {GENERATION_OPTIONS.map(opt => (
              <button
                key={opt.value ?? 'undef'}
                onClick={() => setGenerationType(opt.value)}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all border ${
                  generationType === opt.value
                    ? 'bg-[#15803d] text-white border-[#15803d] shadow-sm'
                    : 'bg-white text-gray-500 border-black/5 hover:bg-gray-100'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Enrutamiento */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest w-24 shrink-0">Enrutamiento:</span>
          <div className="flex flex-wrap gap-1.5">
            {ALGORITHM_OPTIONS.map(opt => (
              <button
                key={opt.value ?? 'undef'}
                onClick={() => setAlgorithm(opt.value)}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all border ${
                  algorithm === opt.value
                    ? 'bg-[#15803d] text-white border-[#15803d] shadow-sm'
                    : 'bg-white text-gray-500 border-black/5 hover:bg-gray-100'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Stat pills ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <MetricPill
          value={tripsStr}
          label="Viajes / mes"
          accent={ACCENT}
          helpContent="Número total de rutas estimadas para el período y configuración seleccionados."
        />
        <MetricPill
          value={tphStr}
          label="Uso relativo"
          sublabel="Viajes / 1000 hab."
          accent={ACCENT}
        />
        <MetricPill
          value={infraFractionStr}
          label="Cobertura de tráfico"
          sublabel="Tráfico sobre infraestructura"
          accent={ACCENT}
          helpContent="Porcentaje de los viajes generados que circulan por carriles bici existentes."
        />
        <MetricPill
          value={medianStr}
          label="Mediana volumen"
          accent={ACCENT}
        />
      </div>

      {/* ── Route histograms & Chart ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {city.id != null && <RouteHistograms cityId={city.id} />}
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
                color: ACCENT,
                type: 'area',
              },
            ]}
          />
        )}
      </div>

      {/* ── Score section ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ScoreDonut
          segments={trafficSegments}
          overallScore={trafficOverall}
          accent={ACCENT}
          cityName={city.name}
        />
        <CityRankTable
          cities={[]}
          accent={ACCENT}
        />
      </div>
    </div>
  );
};

export default TrafficStats;
