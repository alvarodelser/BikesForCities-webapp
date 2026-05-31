import React from 'react';
import { Bike, TrendingUp, Users, Activity, MapPin, Clock } from 'lucide-react';
import type { CityData } from '../../../../../constants/cities';
import { useStationsStats } from '../../../../../hooks/useStationsStats';
import { formatServiceName } from '../../../../../utils/formatters';
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
        <h2 className={`text-2xl font-bold ${variant === 'darkTint' ? 'text-[var(--blue-dark)]' : 'text-white'}`}>
          {city.service_name ? formatServiceName(city.service_name, city.name) : 'Bicicleta Pública'}
        </h2>
        <div className="flex items-center gap-2 mt-1">
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: ACCENT }} />
          <p className={`text-base ${variant === 'darkTint' ? 'text-[var(--blue-dark)]/70' : 'text-white/80'}`}>{city.name}</p>
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
          helpQueVes="El número total de bicicletas que forman la flota del servicio de bici pública de la ciudad."
          helpPorQueEsUtil="La flota es el techo del servicio. Una red bien diseñada con flota insuficiente siempre estará saturada en hora punta; ninguna mejora operativa puede compensar la escasez de vehículos."
          helpComoSeRecogieron="Dato declarado por el operador del servicio o publicado por el ayuntamiento en el contrato de concesión o el portal de datos abiertos municipal."
        />
        <MetricPill
          loading={loading}
          value={activeStationsStr}
          label="Estaciones activas"
          sublabel="Puntos de anclaje operativos"
          icon={MapPin}
          accent={ACCENT}
          variant={variant}
          helpQueVes="El número de estaciones de anclaje que se encuentran operativas en el período seleccionado."
          helpPorQueEsUtil="Una red extensa con muchas estaciones inactivas da una falsa sensación de cobertura. Este número refleja la realidad del servicio disponible."
          helpComoSeRecogieron="Se cuentan las estaciones con al menos un evento de unlock o lock registrado en el período. Las estaciones sin actividad —por obras, avería o retirada temporal— no se incluyen. La fuente es el log de operaciones del sistema de bici pública."
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
          helpQueVes="El número de bicicletas disponibles por cada 1.000 habitantes de la ciudad."
          helpPorQueEsUtil="Permite comparar la generosidad del servicio entre ciudades de distinto tamaño. La densidad de flota es el principal predictor del nivel de servicio que experimentan los usuarios."
          helpComoSeRecogieron="Cociente entre la flota total y la población municipal según el último padrón disponible. No distingue entre bicis mecánicas y eléctricas (EPAC)."
        />
        <MetricPill
          loading={loading}
          value={tripsBikeDayStr}
          label="Uso diario"
          sublabel="Viajes / bici / día"
          icon={Activity}
          accent={ACCENT}
          variant={variant}
          helpQueVes="El número medio de trayectos que realiza cada bicicleta de la flota en un día."
          helpPorQueEsUtil="Un valor alto indica rotación intensiva — las bicis trabajan mucho —. Un valor bajo puede reflejar baja demanda, problemas de disponibilidad que desincentivan el uso, o vandalismo y averías que inmovilizan parte de la flota."
          helpComoSeRecogieron="Se divide el total de viajes del período entre el producto del número de bicicletas por los días del período. Solo se cuentan los viajes con duración entre 1 y 180 minutos para excluir registros de mantenimiento o sesiones abiertas por error."
        />
        <MetricPill
          loading={loading}
          value={cityCoverageStr}
          label="Cobertura"
          sublabel="% edificios a <150m"
          icon={TrendingUp}
          accent={ACCENT}
          variant={variant}
          helpQueVes="El porcentaje de edificios del área de estudio que tienen al menos una estación de bici pública a menos de 150 metros."
          helpPorQueEsUtil="Una estación a más de dos minutos a pie no existe para la mayoría de usuarios. Este número revela la accesibilidad real del servicio, más allá del número de estaciones o su distribución en el mapa."
          helpComoSeRecogieron="Para cada edificio del catastro/OSM se calcula la distancia euclidiana a la estación activa más cercana en el período. El umbral de 150 metros equivale a aproximadamente 90 segundos a pie."
        />
        <MetricPill
          loading={loading}
          value={avgStopStr}
          label="Disponibilidad"
          sublabel="Min. sin servicio / día"
          icon={Clock}
          accent={ACCENT}
          variant={variant}
          helpQueVes="El tiempo medio diario, en minutos, que una estación permanece sin bicicletas disponibles o sin anclajes libres."
          helpPorQueEsUtil="El momento crítico del servicio es cuando un usuario llega y no encuentra bici — o no puede dejarla —. Este número cuantifica exactamente ese fallo; estaciones con alta indisponibilidad son las que más necesitan redistribución urgente."
          helpComoSeRecogieron="A partir del log de ocupación se identifican los intervalos en que el estado es empty (sin bicis) o full (sin anclajes libres). Se suman esos intervalos para cada día y se promedia sobre el período. Indisponibilidad > 30 min/día se considera crítica."
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
