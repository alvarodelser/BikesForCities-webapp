import React from 'react';
import type { CityData } from '../../../../../constants/cities';
import { useInfraStats } from '../../../../../hooks/useInfraStats';
import MetricPill from '../../../pills/MetricPill';
import { BuildingsDensityHistogram } from '../../../plots/BuildingsDensityHistogram';
import ScoreDonut from '../../../plots/ScoreDonut';
import CityRankTable from '../../../plots/CityRankTable';

export interface InfraStatsProps {
  city: CityData;
}

function fmt(value: number | null, decimals: number, suffix: string): string {
  if (value === null) return '—';
  return `${value.toFixed(decimals)} ${suffix}`;
}

const InfraStats: React.FC<InfraStatsProps> = ({ city }) => {
  const { totalKm, coverage, gccFraction, loading } = useInfraStats(city.id ?? null);

  const kmPer100k: number | null =
    totalKm !== null && city.population > 0
      ? totalKm / (city.population / 100_000)
      : null;

  const kmPerMeur: number | null = null;
  const displayLoading = loading;

  const totalKmStr = displayLoading ? '—' : fmt(totalKm, 1, 'km');
  const kmPer100kStr = displayLoading ? '—' : fmt(kmPer100k, 1, 'km / 100k hab');
  const kmPerMeurStr = displayLoading || kmPerMeur === null ? '—' : fmt(kmPerMeur, 1, 'km / M€');
  const coverageStr = displayLoading ? '—' : fmt(coverage, 1, '%');
  const gccStr = displayLoading ? '—' : fmt(gccFraction, 1, '%');

  const infraSegments = city.mode_scores?.infrastructure?.segments ?? [];
  const infraOverall = city.mode_scores?.infrastructure?.overall ?? 0;
  const ACCENT = '#3b82f6';

  return (
    <div className="w-full flex flex-col gap-8">
      {/* Pills section */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <MetricPill
          value={totalKmStr}
          label="Total red ciclista"
          accent={ACCENT}
          helpContent="Longitud total de la red de carriles bici detectada."
        />
        <MetricPill
          value={kmPer100kStr}
          label="Densidad"
          sublabel="Km por cada 100k hab."
          accent={ACCENT}
        />
        <MetricPill
          value={kmPerMeurStr}
          label="Eficiencia"
          sublabel="Inversión por km"
          accent={ACCENT}
        />
        <MetricPill
          value={coverageStr}
          label="Cobertura total"
          accent={ACCENT}
        />
        <MetricPill
          value={gccStr}
          label="GCC"
          sublabel="Conectividad de red"
          accent={ACCENT}
        />
      </div>

      {/* Chart section */}
      <div className="w-full">
        <BuildingsDensityHistogram cityId={city.id ?? 0} />
      </div>

      {/* Score section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ScoreDonut
          segments={infraSegments}
          overallScore={infraOverall}
          accent={ACCENT}
          cityName={city.name}
        />
        <CityRankTable
          cities={[]} // TODO: wire rank data
          accent={ACCENT}
        />
      </div>
    </div>
  );
};

export default InfraStats;
