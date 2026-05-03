import React from 'react';
import type { CityData } from '../../../constants/cities';
import { useInfraStats } from '../../../hooks/useInfraStats';
import MetricPill from '../pills/MetricPill';
import { BuildingsDensityHistogram } from '../plots/BuildingsDensityHistogram';
import { ScoreDonut } from '../plots/ScoreDonut';
import { CityRankTable } from '../plots/CityRankTable';

export interface InfraStatsProps {
  city: CityData;
}

function fmt(value: number | null, decimals: number, suffix: string): string {
  if (value === null) return '—';
  return `${value.toFixed(decimals)} ${suffix}`;
}

const InfraStats: React.FC<InfraStatsProps> = ({ city }) => {
  const { totalKm, coverage, gccFraction, loading } = useInfraStats(city.id ?? null);

  // Derive kmPer100k from totalKm + city.population
  const kmPer100k: number | null =
    totalKm !== null && city.population > 0
      ? totalKm / (city.population / 100_000)
      : null;

  // kmPerMeur requires budget data — placeholder until wired
  const kmPerMeur: number | null = null;

  const displayLoading = loading;

  const totalKmStr = displayLoading ? '—' : fmt(totalKm, 1, 'km');
  const kmPer100kStr = displayLoading ? '—' : fmt(kmPer100k, 1, 'km / 100k hab');
  const kmPerMeurStr = displayLoading || kmPerMeur === null ? '—' : fmt(kmPerMeur, 1, 'km / M€');
  const coverageStr = displayLoading ? '—' : fmt(coverage, 1, '%');
  const gccStr = displayLoading ? '—' : fmt(gccFraction, 1, '%');

  const infraSegments = city.mode_scores?.infrastructure?.segments ?? [];
  const infraOverall = city.mode_scores?.infrastructure?.overall ?? 0;

  return (
    <div className="w-full flex flex-col gap-6 bg-blue-900/80 rounded-2xl p-5 text-white">

      {/* Pills section */}
      <div className="grid grid-cols-2 gap-4">
        {/* Column 1 */}
        <div className="flex flex-col gap-3">
          <MetricPill
            size="main"
            value={totalKmStr}
            label="Total red ciclista"
          />
          <MetricPill
            size="sub"
            value={kmPer100kStr}
            label="Densidad poblacional"
          />
          <MetricPill
            size="sub"
            value={kmPerMeurStr}
            label="Eficiencia presupuestaria"
          />
        </div>

        {/* Column 2 */}
        <div className="flex flex-col gap-3">
          <MetricPill
            size="main"
            value={coverageStr}
            label="Cobertura total"
          />
          <MetricPill
            size="sub"
            value={gccStr}
            label="GCC"
          />
        </div>
      </div>

      {/* Chart section */}
      <div className="w-full">
        <BuildingsDensityHistogram cityId={city.id ?? 0} />
      </div>

      {/* Score section */}
      <div className="grid grid-cols-2 gap-4">
        {/* Left: ScoreDonut */}
        <div className="bg-white/10 rounded-xl p-4">
          <ScoreDonut
            segments={infraSegments}
            overallScore={infraOverall}
            accent="#3b82f6"
            cityName={city.name}
          />
        </div>

        {/* Right: CityRankTable */}
        <div className="bg-white/10 rounded-xl p-4">
          {/* TODO: wire rank data from API */}
          <CityRankTable
            cities={[]}
            accent="#3b82f6"
          />
        </div>
      </div>
    </div>
  );
};

export default InfraStats;
