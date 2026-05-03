import React from 'react';
import type { CityData } from '../../../constants/cities';
import { useStationsStats } from '../../../hooks/useStationsStats';
import MetricPill from '../pills/MetricPill';
import ServiceNamePill from '../pills/ServiceNamePill';
import { StationMonthlyChart } from '../plots/StationMonthlyChart';
import { StationHistograms } from '../plots/StationHistograms';
import { ScoreDonut } from '../plots/ScoreDonut';
import { CityRankTable } from '../plots/CityRankTable';

export interface StationsStatsProps {
  city: CityData;
}

function fmt(value: number | null, decimals: number, suffix: string): string {
  if (value === null) return '—';
  return `${value.toFixed(decimals)} ${suffix}`;
}

const StationsStats: React.FC<StationsStatsProps> = ({ city }) => {
  const {
    activeStations,
    reachCoverage,
    tripsBikeDay,
    avgStopMinutes,
    loading,
  } = useStationsStats(city.id ?? null);

  // Prefer CityData fields for counts that are available from the cities endpoint
  const totalBikes: number | null = city.bicycles_count ?? null;
  const stationsCount: number | null =
    activeStations ?? city.stations_count ?? null;

  // Per-1000-hab derived metric
  const bikesPerThousand: number | null =
    totalBikes !== null && city.population > 0
      ? totalBikes / (city.population / 1_000)
      : null;

  // Derive tripsBikeDay from city_metrics if hook returned null
  const derivedTripsBikeDay: number | null =
    tripsBikeDay ??
    (city.monthly_trips != null && stationsCount != null && stationsCount > 0
      ? city.monthly_trips / stationsCount / 30
      : null);

  const totalBikesStr = loading ? '—' : fmt(totalBikes, 0, '');
  const bikesPerThousandStr = loading ? '—' : fmt(bikesPerThousand, 1, '/ 1000 hab');
  const tripsBikeDayStr = loading ? '—' : fmt(derivedTripsBikeDay, 2, 'trips/bici/día');

  const activeStationsStr = loading ? '—' : fmt(stationsCount, 0, '');
  const reachCoverageStr = loading ? '—' : fmt(reachCoverage != null ? reachCoverage * 100 : null, 1, '% edif. cubiertos');
  const avgStopStr = loading ? '—' : fmt(avgStopMinutes, 0, 'min/día parada');

  const stationsSegments = city.mode_scores?.stations?.segments ?? [];
  const stationsOverall = city.mode_scores?.stations?.overall ?? 0;

  const cityId = city.id ?? 0;

  return (
    <div className="w-full flex flex-col gap-6 bg-green-800/80 rounded-2xl p-5 text-white">

      {/* Service name pill */}
      <div className="flex justify-start">
        <ServiceNamePill serviceName={city.service_name ?? city.name} />
      </div>

      {/* Stat pills — 2-col grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Column 1 — bikes */}
        <div className="flex flex-col gap-3">
          <MetricPill
            size="main"
            value={totalBikesStr}
            label="Bicicletas totales"
          />
          <MetricPill
            size="sub"
            value={bikesPerThousandStr}
            label="Densidad"
          />
          <MetricPill
            size="sub"
            value={tripsBikeDayStr}
            label="Uso diario"
          />
        </div>

        {/* Column 2 — stations */}
        <div className="flex flex-col gap-3">
          <MetricPill
            size="main"
            value={activeStationsStr}
            label="Estaciones activas"
          />
          <MetricPill
            size="sub"
            value={reachCoverageStr}
            label="Cobertura"
          />
          <MetricPill
            size="sub"
            value={avgStopStr}
            label="Tiempo parada"
          />
        </div>
      </div>

      {/* Monthly evolution chart */}
      {cityId > 0 && (
        <div className="w-full">
          <StationMonthlyChart cityId={cityId} />
        </div>
      )}

      {/* Histograms — 2 col */}
      {cityId > 0 && (
        <div className="w-full">
          <StationHistograms cityId={cityId} />
        </div>
      )}

      {/* Score section */}
      <div className="grid grid-cols-2 gap-4">
        {/* Left: ScoreDonut */}
        <div className="bg-white/10 rounded-xl p-4">
          <ScoreDonut
            segments={stationsSegments}
            overallScore={stationsOverall}
            accent="#22c55e"
            cityName={city.name}
          />
        </div>

        {/* Right: CityRankTable */}
        <div className="bg-white/10 rounded-xl p-4">
          {/* TODO: wire rank data from API */}
          <CityRankTable
            cities={[]}
            accent="#22c55e"
          />
        </div>
      </div>
    </div>
  );
};

export default StationsStats;
