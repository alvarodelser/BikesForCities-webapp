import React, { useEffect, useState, useMemo } from 'react';
import BarHistogram from './BarHistogram';
import { fetchStations, type StationData } from '../../../services/api';

interface StationHistogramsProps {
  cityId: number;
}

function niceStep(range: number, numBins: number): number {
  const raw = range / numBins;
  const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
  const steps = [1, 2, 5, 10];
  return magnitude * steps.find(s => s * magnitude >= raw)!;
}

/** Build histogram bins from a numeric array with rounded, readable boundaries. */
function buildBins(values: number[], numBins = 6): { label: string; value: number }[] {
  if (values.length === 0) return [];

  const max = Math.max(...values);
  if (max === 0) return [{ label: '0', value: values.length }];

  const step = niceStep(max, numBins);
  const binCount = Math.ceil(max / step);
  const counts = Array<number>(binCount).fill(0);

  for (const v of values) {
    const idx = Math.min(Math.floor(v / step), binCount - 1);
    counts[idx]++;
  }

  return counts.map((count, i) => {
    const lo = i * step;
    const hi = lo + step;
    const fmt = (n: number) => n >= 1000 ? `${n / 1000}k` : String(n);
    return { label: `${fmt(lo)}–${fmt(hi)}`, value: count };
  }).filter(b => b.value > 0);
}

export const StationHistograms: React.FC<StationHistogramsProps> = ({ cityId }) => {
  const [stations, setStations] = useState<StationData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchStations(cityId)
      .then(data => {
        if (cancelled) return;
        setStations(data);
        setLoading(false);
      })
      .catch(err => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to fetch stations');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [cityId]);

  const tripsData = useMemo(() => {
    const values = stations
      .map(s => s.estimated_monthly_trips)
      .filter((v): v is number => v != null);
    return buildBins(values, 10);
  }, [stations]);

  const buildingData = useMemo(() => {
    const values = stations
      .map(s => s.building_coverage)
      .filter((v): v is number => v != null);
    // building_coverage is 0–1; convert to percentage for display
    return buildBins(values.map(v => v * 100), 10);
  }, [stations]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4">
        {[0, 1].map(i => (
          <div
            key={i}
            className="rounded-2xl border border-black/[0.06] bg-white/40 animate-pulse"
            style={{ height: '200px' }}
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-500 text-sm py-4 text-center">{error}</div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      <BarHistogram
        data={tripsData}
        accent="#ffa585"
        title="Uso por estación"
        subtitle="Viajes estimados / mes"
        yUnit="estaciones"
        gradient
        helpContent={
          <p>
            Distribución de las estaciones según el número estimado de viajes mensuales que generan.
            Las estaciones con más viajes tienen mayor demanda y pueden requerir mayor capacidad de anclaje o reposición más frecuente de bicicletas.
          </p>
        }
      />
      <BarHistogram
        data={buildingData}
        accent="#6b8cae"
        title="Cobertura de edificios"
        subtitle="Fracción de edificios cubiertos (%)"
        yUnit="estaciones"
        gradient
        helpContent={
          <p>
            Distribución de las estaciones según el porcentaje de edificios que cubre (dentro de 150 metros).
            Las estaciones con mayor cobertura de edificios alcanzan a más residencias potenciales.
          </p>
        }
      />
    </div>
  );
};

export default StationHistograms;
