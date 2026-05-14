import React from 'react';
import { Bike, TrendingUp, Users, Activity, MapPin, Clock } from 'lucide-react';
import type { CityData } from '../../../../../constants/cities';
import { useStationsStats } from '../../../../../hooks/useStationsStats';
import MetricPill from '../../../pills/MetricPill';
import StationMonthlyChart from '../../../plots/StationMonthlyChart';
import StationHistograms from '../../../plots/StationHistograms';

export interface StationsStatsProps {
  city: CityData;
  variant?: 'light' | 'darkTint';
}

function fmt(value: number | null, decimals: number, suffix: string): string {
  if (value === null) return '—';
  return `${value.toFixed(decimals)} ${suffix}`;
}

const StationsStats: React.FC<StationsStatsProps> = ({ city, variant }) => {
  const {
    totalBikes: hookTotalBikes,
    activeStations,
    cityCoverage,
    avgBuildingCount: _avgBuildingCount,
    tripsBikeDay,
    avgStopMinutes,
    loading,
  } = useStationsStats(city.id ?? null, city.bicycles_count);

  const totalBikes: number | null = hookTotalBikes ?? city.bicycles_count ?? null;
  const stationsCount: number | null = activeStations ?? city.stations_count ?? null;
  const resolvedCityCoverage: number | null = cityCoverage ?? city.station_coverage ?? null;

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
  const cityCoverageStr = loading ? '—' : fmt(resolvedCityCoverage != null ? resolvedCityCoverage * 100 : null, 1, '%');
  const avgStopStr = loading ? '—' : fmt(avgStopMinutes, 0, 'min');

  const cityId = city.id ?? 0;
  const ACCENT = '#ffa585';

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Header */}
      <div>
        <h2 className={`text-2xl font-bold ${variant === 'darkTint' ? 'text-[var(--blue-dark)]' : 'text-white'}`}>Bicicleta Pública</h2>
        <div className="flex items-center gap-2 mt-1">
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: ACCENT }} />
          <p className={`text-base ${variant === 'darkTint' ? 'text-[var(--blue-dark)]/70' : 'text-white/80'}`}>{city.service_name ?? city.name}</p>
        </div>
      </div>

      {/* Top row: two hero metrics */}
      <div className="grid grid-cols-2 gap-4">
        <MetricPill
          loading={loading}
          value={totalBikesStr}
          label="Bicicletas totales"
          sublabel="Flota del servicio público"
          icon={Bike}
          accent={ACCENT}
          variant={variant}
          helpContent="Número total de bicicletas disponibles en el sistema de bicicleta pública de la ciudad, incluyendo las disponibles en estaciones y las que pueden estar en tránsito."
        />
        <MetricPill
          loading={loading}
          value={activeStationsStr}
          label="Estaciones activas"
          sublabel="Puntos de anclaje operativos"
          icon={MapPin}
          accent={ACCENT}
          variant={variant}
          helpContent="Número de estaciones de anclaje operativas. Las estaciones inactivas por obras, averías o retirada temporal no se contabilizan en este total."
        />
      </div>

      {/* Second row: 4 columns for density, usage, coverage, and inoperative time */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricPill
          loading={loading}
          value={bikesPerThousandStr}
          label="Densidad"
          sublabel="Bicis / 1.000 hab."
          icon={Users}
          accent={ACCENT}
          variant={variant}
          helpContent="Número de bicicletas disponibles por cada 1.000 habitantes. Permite comparar la intensidad del servicio entre ciudades de distintos tamaños en igualdad de condiciones."
        />
        <MetricPill
          loading={loading}
          value={tripsBikeDayStr}
          label="Uso diario"
          sublabel="Viajes / bici / día"
          icon={Activity}
          accent={ACCENT}
          variant={variant}
          helpContent="Número de viajes por bicicleta y día. Un valor alto indica un servicio con alta demanda y rotación. Se calcula dividiendo los viajes mensuales entre el número de bicicletas y los días del mes."
        />
        <MetricPill
          loading={loading}
          value={cityCoverageStr}
          label="Cobertura"
          sublabel="% edificios a <150m"
          icon={TrendingUp}
          accent={ACCENT}
          variant={variant}
          helpContent="Porcentaje de edificios del área de estudio que tienen al menos una estación a menos de 150 metros. Refleja el alcance geográfico real del servicio."
        />
        <MetricPill
          loading={loading}
          value={avgStopStr}
          label="Inoperativa"
          sublabel="Min. sin bicis / día"
          icon={Clock}
          accent={ACCENT}
          variant={variant}
          helpContent="Tiempo medio diario que una estación permanece inoperativa (sin bicicletas o sin anclajes libres). Un valor alto indica problemas de reposición."
        />
      </div>

      {/* Charts */}
      {cityId > 0 && (
        <div className="flex flex-col gap-4">
          <StationMonthlyChart cityId={cityId} />
          <StationHistograms cityId={cityId} />
        </div>
      )}
    </div>
  );
};

export default StationsStats;
