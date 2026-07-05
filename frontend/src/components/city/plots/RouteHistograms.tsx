import React, { useEffect, useState } from 'react';
import { fetchRouteHistogram, fetchTrafficInfraCoverage } from '../../../services/api';
import type { RouteHistogramSeries } from '../../../services/api';
import BarHistogram from '../plots/BarHistogram';

interface RouteHistogramsProps {
  cityId: number;
  accent?: string;
}

/** Convert parallel bin_edges + counts arrays into BarHistogram-friendly data */
function toBins(
  bin_edges: number[],
  counts: number[],
  toFixed = 1,
): { label: string; shortLabel: string; value: number }[] {
  return counts.map((count, i) => ({
    label: `${bin_edges[i].toFixed(toFixed)}–${bin_edges[i + 1].toFixed(toFixed)}`,
    shortLabel: ((bin_edges[i] + bin_edges[i + 1]) / 2).toFixed(toFixed),
    value: count,
  }));
}

export const RouteHistograms: React.FC<RouteHistogramsProps> = ({ cityId, accent = '#3A6C7F' }) => {
  const [lengthBins, setLengthBins] = useState<{ label: string; shortLabel: string; value: number }[]>([]);
  const [infraBins, setInfraBins] = useState<{ label: string; shortLabel: string; value: number }[]>([]);
  const [infraMean, setInfraMean] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!cityId) return;

    let cancelled = false;
    setLoading(true);

    const histogramPromise = fetchRouteHistogram(cityId).then((series: RouteHistogramSeries[]) => {
      if (cancelled) return;
      // Pick the first series (or fall back to empty)
      const s = series[0];
      if (s) {
        setLengthBins(toBins(s.length_km.bin_edges, s.length_km.counts, 1));
        setInfraBins(toBins(s.infra_fraction.bin_edges, s.infra_fraction.counts, 2));
      }
    });

    const coveragePromise = fetchTrafficInfraCoverage(cityId).then(cov => {
      if (cancelled) return;
      if (cov?.infra_fraction != null) {
        setInfraMean(cov.infra_fraction);
      }
    });

    Promise.allSettled([histogramPromise, coveragePromise]).then(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [cityId]);

  if (loading && lengthBins.length === 0 && infraBins.length === 0) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
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

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
      <BarHistogram
        data={lengthBins}
        accent={accent}
        title="Distribución longitud de rutas"
        subtitle="km por ruta"
        gradient
      />
      <BarHistogram
        data={infraBins}
        accent={accent}
        title="Distribución cobertura infraestructura"
        subtitle="fracción de ruta sobre vía ciclista"
        gradient
        referenceLineX={infraMean}
        referenceLabel={infraMean !== undefined ? `Media ${(infraMean * 100).toFixed(1)}%` : undefined}
      />
    </div>
  );
};

export default RouteHistograms;
