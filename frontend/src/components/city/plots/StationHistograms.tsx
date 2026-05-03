import React, { useEffect, useState, useMemo } from 'react';
import BarHistogram from './BarHistogram';
import { fetchStations, type StationData } from '../../../services/api';

interface StationHistogramsProps {
  cityId: number;
}

/** Build equal-width histogram bins from a numeric array. */
function buildBins(values: number[], numBins = 10): { label: string; value: number }[] {
  if (values.length === 0) return [];

  const min = Math.min(...values);
  const max = Math.max(...values);

  if (min === max) {
    return [{ label: String(Math.round(min)), value: values.length }];
  }

  const binWidth = (max - min) / numBins;
  const counts = Array<number>(numBins).fill(0);

  for (const v of values) {
    const idx = Math.min(Math.floor((v - min) / binWidth), numBins - 1);
    counts[idx]++;
  }

  return counts.map((count, i) => {
    const lo = min + i * binWidth;
    const hi = lo + binWidth;
    const label = `${lo.toFixed(0)}–${hi.toFixed(0)}`;
    return { label, value: count };
  });
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

  const reachData = useMemo(() => {
    const values = stations
      .map(s => s.reach_coverage)
      .filter((v): v is number => v != null);
    // reach_coverage is 0–1; convert to percentage for display
    return buildBins(values.map(v => v * 100), 10);
  }, [stations]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4">
        {[0, 1].map(i => (
          <div
            key={i}
            className="h-[300px] flex items-center justify-center text-gray-400 text-sm bg-gray-50/50 rounded-xl border border-gray-100"
          >
            Cargando...
          </div>
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
        accent="#22c55e"
        title="Uso por estación"
        subtitle="Viajes estimados / mes"
        gradient
      />
      <BarHistogram
        data={reachData}
        accent="#16a34a"
        title="Cobertura por alcance"
        subtitle="Porcentaje de alcance (%)"
        gradient
      />
    </div>
  );
};

export default StationHistograms;
