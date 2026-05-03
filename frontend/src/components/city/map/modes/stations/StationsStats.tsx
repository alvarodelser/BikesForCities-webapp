import React from 'react';
import type { CityData } from '../../../../../constants/cities';
import { useStationsStats } from '../../../../../hooks/useStationsStats';
import MetricPill from '../../../pills/MetricPill';
import ServiceNamePill from '../../../pills/ServiceNamePill';
import StationMonthlyChart from '../../../plots/StationMonthlyChart';
import StationHistograms from '../../../plots/StationHistograms';
import ScoreDonut from '../../../plots/ScoreDonut';
import CityRankTable from '../../../plots/CityRankTable';

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

  const totalBikes: number | null = city.bicycles_count ?? null;
  const stationsCount: number | null = activeStations ?? city.stations_count ?? null;

  const bikesPerThousand: number | null =
    totalBikes !== null && city.population > 0
      ? totalBikes / (city.population / 1_000)
      : null;

  const derivedTripsBikeDay: number | null =
    tripsBikeDay ??
    (city.monthly_trips != null && stationsCount != null && stationsCount > 0
      ? city.monthly_trips / stationsCount / 30
      : null);

  const totalBikesStr = loading ? '—' : fmt(totalBikes, 0, '');
  const bikesPerThousandStr = loading ? '—' : fmt(bikesPerThousand, 1, '/ 1k hab');
  const tripsBikeDayStr = loading ? '—' : fmt(derivedTripsBikeDay, 2, '');

  const activeStationsStr = loading ? '—' : fmt(stationsCount, 0, '');
  const reachCoverageStr = loading ? '—' : fmt(reachCoverage != null ? reachCoverage * 100 : null, 1, '%');
  const avgStopStr = loading ? '—' : fmt(avgStopMinutes, 0, 'min/día');

  const stationsSegments = city.mode_scores?.stations?.segments ?? [];
  const stationsOverall = city.mode_scores?.stations?.overall ?? 0;
  const cityId = city.id ?? 0;
  const ACCENT = '#22c55e';

  return (
    <div className="w-full flex flex-col gap-8">
      {/* Service name pill */}
      <div className="flex justify-start">
        <ServiceNamePill serviceName={city.service_name ?? city.name} />
      </div>

      {/* Stat pills — 2-col grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <MetricPill
          value={totalBikesStr}
          label="Bicicletas totales"
          accent={ACCENT}
          helpContent="Número total de bicicletas disponibles en el sistema de la ciudad."
        />
        <MetricPill
          value={bikesPerThousandStr}
          label="Densidad"
          sublabel="Bicis por cada 1000 hab."
          accent={ACCENT}
        />
        <MetricPill
          value={tripsBikeDayStr}
          label="Uso diario"
          sublabel="Viajes por bicicleta y día"
          accent={ACCENT}
        />
        <MetricPill
          value={activeStationsStr}
          label="Estaciones activas"
          accent={ACCENT}
        />
        <MetricPill
          value={reachCoverageStr}
          label="Cobertura"
          sublabel="Estaciones por alcance"
          accent={ACCENT}
        />
        <MetricPill
          value={avgStopStr}
          label="Tiempo parada"
          sublabel="Minutos al día sin movimiento"
          accent={ACCENT}
        />
      </div>

      {/* Charts */}
      {cityId > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <StationMonthlyChart cityId={cityId} />
          <StationHistograms cityId={cityId} />
        </div>
      )}

      {/* Score section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ScoreDonut
          segments={stationsSegments}
          overallScore={stationsOverall}
          accent={ACCENT}
          cityName={city.name}
        />
        <CityRankTable
          cities={[]} // TODO: fetch actual rank data
          accent={ACCENT}
        />
      </div>
    </div>
  );
};

export default StationsStats;
