import React from 'react';
import { Bike, TrendingUp, Users, Activity, MapPin, Clock } from 'lucide-react';
import type { CityData } from '../../../../../constants/cities';
import { useStationsStats } from '../../../../../hooks/useStationsStats';
import MetricPill from '../../../pills/MetricPill';
import StationMonthlyChart from '../../../plots/StationMonthlyChart';
import StationHistograms from '../../../plots/StationHistograms';

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
  const avgStopStr = loading ? '—' : fmt(avgStopMinutes, 0, 'min');

  const cityId = city.id ?? 0;
  const ACCENT = '#ffa585';

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">Bicicleta Pública</h2>
        <div className="flex items-center gap-2 mt-1">
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: ACCENT }} />
          <p className="text-base text-white/80">{city.service_name ?? city.name}</p>
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
          helpContent="Número total de bicicletas disponibles en el sistema de bicicleta pública de la ciudad, incluyendo las disponibles en estaciones y las que pueden estar en tránsito."
        />
        <MetricPill
          loading={loading}
          value={activeStationsStr}
          label="Estaciones activas"
          sublabel="Puntos de anclaje operativos"
          icon={MapPin}
          accent={ACCENT}
          helpContent="Número de estaciones de anclaje operativas. Las estaciones inactivas por obras, averías o retirada temporal no se contabilizan en este total."
        />
      </div>

      {/* Second row: left 2-sub-col (Densidad + Uso diario), right 2-sub-col (Cobertura + Tiempo parada) */}
      <div className="grid grid-cols-2 gap-4">
        <div className="grid grid-cols-2 gap-4">
          <MetricPill
          loading={loading}
            value={bikesPerThousandStr}
            label="Densidad"
            sublabel="Bicis / 1.000 hab."
            icon={Users}
            accent={ACCENT}
            helpContent="Número de bicicletas disponibles por cada 1.000 habitantes. Permite comparar la intensidad del servicio entre ciudades de distintos tamaños en igualdad de condiciones."
          />
          <MetricPill
          loading={loading}
            value={tripsBikeDayStr}
            label="Uso diario"
            sublabel="Viajes / bici / día"
            icon={Activity}
            accent={ACCENT}
            helpContent="Número de viajes por bicicleta y día. Un valor alto indica un servicio con alta demanda y rotación. Se calcula dividiendo los viajes mensuales entre el número de bicicletas y los días del mes."
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <MetricPill
          loading={loading}
            value={reachCoverageStr}
            label="Cobertura"
            sublabel="% edificios a <150m de estación"
            icon={TrendingUp}
            accent={ACCENT}
            helpContent="Porcentaje de edificios de la ciudad que tienen al menos una estación de bicicleta pública a menos de 150 metros. Se calcula comparando los edificios dentro del radio de influencia de alguna estación frente al total de edificios de la ciudad."
          />
          <MetricPill
          loading={loading}
            value={avgStopStr}
            label="Tiempo inoperativa"
            sublabel="Min. sin bicis / día"
            icon={Clock}
            accent={ACCENT}
            helpContent="Tiempo medio diario que una estación permanece inoperativa, definida como el período en que tiene menos de 2 bicicletas disponibles. Un valor alto indica que la estación se queda sin servicio durante largos períodos — ya sea por alta demanda o por falta de reposición."
          />
        </div>
      </div>

      {/* Charts */}
      {cityId > 0 && (
        <div className="flex flex-col gap-4">
          <StationMonthlyChart cityId={cityId} theme="dark" />
          <StationHistograms cityId={cityId} />
        </div>
      )}
    </div>
  );
};

export default StationsStats;
