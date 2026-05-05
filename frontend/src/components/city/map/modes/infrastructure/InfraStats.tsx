import React from 'react';
import { Route, TrendingUp, Users, Network, Activity } from 'lucide-react';
import type { CityData } from '../../../../../constants/cities';
import { useInfraStats } from '../../../../../hooks/useInfraStats';
import MetricPill from '../../../pills/MetricPill';
import { BuildingsDensityHistogram } from '../../../plots/BuildingsDensityHistogram';

export interface InfraStatsProps {
  city: CityData;
  variant?: 'light' | 'darkTint';
}

function fmt(value: number | null, decimals: number, suffix: string): string {
  if (value === null) return '—';
  return `${value.toFixed(decimals)} ${suffix}`;
}

const InfraStats: React.FC<InfraStatsProps> = ({ city, variant }) => {
  const { totalKm, coverage, gccFraction, kmPerMeur, loading } = useInfraStats(city.id ?? null);

  const kmPer100k: number | null =
    totalKm !== null && city.population > 0
      ? totalKm / (city.population / 100_000)
      : null;

  const displayLoading = loading;

  const toPercent = (v: number | null) => v !== null ? v * 100 : null;

  const totalKmStr    = displayLoading ? '—' : fmt(totalKm, 1, 'km');
  const kmPer100kStr  = displayLoading ? '—' : fmt(kmPer100k, 2, 'km/100k hab');
  const kmPerMeurStr  = displayLoading || kmPerMeur === null ? '—' : fmt(kmPerMeur, 1, 'km/M€');
  const coverageStr   = displayLoading ? '—' : fmt(toPercent(coverage), 1, '%');
  const gccStr        = displayLoading ? '—' : fmt(toPercent(gccFraction), 1, '%');

  const ACCENT = '#027A76';

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Header */}
      <div>
        <h2 className={`text-2xl font-bold ${variant === 'darkTint' ? 'text-[var(--blue-dark)]' : 'text-white'}`}>
          Infraestructura Ciclista
        </h2>
      </div>

      {/* Top row: two hero metrics */}
      <div className="grid grid-cols-2 gap-4">
        <MetricPill
          loading={displayLoading}
          value={totalKmStr}
          label="Longitud total"
          sublabel="Km de carril bici"
          icon={Route}
          accent={ACCENT}
          variant={variant}
          helpContent="Solo contabilizamos infraestructura físicamente segregada del tráfico rodado. Los tramos pintados en calzada o en acera compartida no se incluyen en este cálculo."
        />
        <MetricPill
          loading={displayLoading}
          value={coverageStr}
          label="Cobertura"
          sublabel="% edificios a <150m del carril"
          icon={TrendingUp}
          accent={ACCENT}
          variant={variant}
          helpContent="Consideramos 150 metros una distancia razonable para que alguien acceda andando con su bici desde un edificio hasta la red de carril bici. La métrica divide los edificios con acceso a la red ciclista entre el total de edificios de la ciudad."
        />
      </div>

      {/* Second row: left split (Densidad + Inversión), right full-width (GCC) */}
      <div className="grid grid-cols-2 gap-4">
        {/* Left: two sub-columns */}
        <div className="grid grid-cols-2 gap-4">
          <MetricPill
          loading={displayLoading}
            value={kmPer100kStr}
            label="Densidad de red"
            sublabel="Km / 100k hab"
            icon={Users}
            accent={ACCENT}
            variant={variant}
            helpContent="Kilómetros de carril bici por cada 100.000 habitantes. Normalizar por población permite comparar ciudades de tamaño muy diferente en igualdad de condiciones."
          />
          <MetricPill
          loading={displayLoading}
            value={kmPerMeurStr}
            label="Inversión"
            sublabel="Km / M€"
            icon={Activity}
            accent={ACCENT}
            variant={variant}
            helpContent="Kilómetros construidos por cada millón de euros invertido en la categoría de Vías Públicas del presupuesto municipal. Esta partida recoge el mantenimiento y ampliación de infraestructura viaria y es el indicador más directo de eficiencia en la construcción de red ciclista."
          />
        </div>
        {/* Right: GCC full column width */}
        <MetricPill
          loading={displayLoading}
          value={gccStr}
          label="Cobertura GCC"
          sublabel="Conectividad"
          icon={Network}
          accent={ACCENT}
          variant={variant}
          helpContent="La métrica de cobertura anterior cuenta cualquier tramo cercano, aunque esté aislado. La Gran Componente Conexa (GCC) es el mayor fragmento continuo de la red. Esta métrica mide qué porcentaje de población queda cubierta exclusivamente por ese fragmento, reflejando así la conectividad real: solo importa la infraestructura que forma una red navegable de extremo a extremo."
        />
      </div>

      {/* Chart section */}
      <div className="w-full">
        <BuildingsDensityHistogram cityId={city.id ?? 0} variant={variant} accent={ACCENT} />
      </div>

    </div>
  );
};

export default InfraStats;
