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
          helpQueVes="El total de kilómetros de carril bici con separación física del tráfico motorizado dentro del área de estudio de la ciudad."
          helpPorQueEsUtil="La infraestructura segregada es el indicador más directamente relacionado con el incremento del uso de la bici. La longitud total determina la seguridad del ciclista, la conectividad de la red y la variedad de rutas disponibles. Una red corta obliga a los ciclistas a compartir calzada y limita mucho el tipo de usuario que está dispuesto a aceptar esos riesgos."
          helpComoSeRecogieron="Se mapea la red combinando datos de OpenStreetMap y fuentes municipales. Solo se contabilizan tramos con separación física del tráfico motorizado (aceras bici incluidas, carriles sin separación sobre calzada no). El área de estudio se estandariza a un cuadrado de 10 × 10 km para hacer comparables ciudades de tamaños distintos."
        />
        <MetricPill
          loading={displayLoading}
          value={coverageStr}
          label="Cobertura"
          sublabel="% edificios a <150m del carril"
          icon={TrendingUp}
          accent={ACCENT}
          variant={variant}
          helpQueVes="El porcentaje de edificios del área de estudio que tienen al menos un tramo de carril bici a menos de 150 metros."
          helpPorQueEsUtil="Los kilómetros totales no dicen nada sobre la efectividad de la red. Las ciudades españolas tienden a concentrar kilómetros en áreas dispersas dedicadas al deporte y dejar núcleos urbanos sin opción ciclista segura. Una cobertura baja indica que la red existe pero no llega donde vive la gente."
          helpComoSeRecogieron="Se calcula la distancia entre cada edificio del mapa y el tramo más cercano de la red ciclista. El umbral de 150 metros corresponde a un desplazamiento a pie de menos de dos minutos."
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
            helpQueVes="Los kilómetros de carril bici disponibles por cada 100.000 habitantes de la ciudad."
            helpPorQueEsUtil="Permite comparar ciudades de tamaño muy diferente en igualdad de condiciones. Una ciudad pequeña con pocos kilómetros puede tener más infraestructura per cápita que una gran ciudad con una red aparentemente extensa. Esta métrica revela el esfuerzo real de cada administración en relación a su población."
            helpComoSeRecogieron="Se divide la longitud total de la red entre la población del municipio según el último padrón disponible."
          />
          <MetricPill
          loading={displayLoading}
            value={kmPerMeurStr}
            label="Inversión"
            sublabel="Km / M€"
            icon={Activity}
            accent={ACCENT}
            variant={variant}
            helpQueVes="El porcentaje de kilómetros de carril bici que forman parte del fragmento continuo más grande de la red: los tramos que están todos conectados entre sí sin interrupciones."
            helpPorQueEsUtil="Saber cuánto dinero se destina a movilidad no es suficiente, lo relevante es cuánto de ese dinero se convierte en infraestructura ciclista. Es el indicador más directo de la prioridad política hacia el ciclismo urbano."
            helpComoSeRecogieron="Se cruza la longitud de red con la partida de Vías Públicas del presupuesto municipal publicado, que recoge inversión en infraestructura viaria."
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
          helpQueVes="El porcentaje de kilómetros de carril que forman parte del mayor fragmento continuo de la red."
          helpPorQueEsUtil="Puedes tener muchos kilómetros de carril y aun así no tener una red utilizable. Un tramo que empieza y termina sin conectar con nada obliga al ciclista a incorporarse al tráfico, rompiendo el viaje y la seguridad. Esta métrica revela si la infraestructura existente forma un sistema coherente o una colección de tramos inconexos."
          helpComoSeRecogieron="Se aplica análisis de grafos sobre la red ciclista mapeada para identificar la Gran Componente Conexa (GCC): el subconjunto más grande de tramos interconectados sin interrupciones. El porcentaje se calcula sobre el total de kilómetros de red."
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
