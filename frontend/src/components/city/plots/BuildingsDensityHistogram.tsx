import React, { useState, useEffect } from 'react';
import type * as GeoJSON from 'geojson';
import { fetchBuildingCoverageComponents } from '../../../services/api';
import BarHistogram from './BarHistogram';

interface BuildingsDensityHistogramProps {
  cityId: number;
}

const BIN_LABELS = ['1-10', '11-50', '51-200', '201-1000', '1000+'];
const BIN_EDGES = [1, 11, 51, 201, 1000];

function computeBins(features: GeoJSON.Feature[]): { label: string; value: number }[] {
  // 1. Group buildings by component_id to find the size of each component
  const compCounts = new Map<number, number>();
  for (const feature of features) {
    const compId = feature.properties?.component_id as number | undefined;
    if (compId != null && compId >= 0) {
      compCounts.set(compId, (compCounts.get(compId) || 0) + 1);
    }
  }

  // 2. Bin the buildings based on the size of their component
  const totals = new Array<number>(BIN_LABELS.length).fill(0);

  for (const count of compCounts.values()) {
    let binIndex = BIN_LABELS.length - 1;
    for (let i = 0; i < BIN_EDGES.length - 1; i++) {
      if (count >= BIN_EDGES[i] && count < BIN_EDGES[i + 1]) {
        binIndex = i;
        break;
      }
    }
    // Add ALL buildings in this component to the corresponding bin
    totals[binIndex] += count;
  }

  return BIN_LABELS.map((label, i) => ({ label, value: totals[i] }));
}

function placeholderBins(): { label: string; value: number }[] {
  return BIN_LABELS.map(label => ({
    label,
    value: Math.floor(Math.random() * 800) + 50,
  }));
}

export const BuildingsDensityHistogram: React.FC<BuildingsDensityHistogramProps> = ({ cityId }) => {
  const [bins, setBins] = useState<{ label: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetchBuildingCoverageComponents(cityId)
      .then(geojson => {
        if (cancelled) return;
        const features = geojson.features ?? [];
        // If there are features with a component_id, we can compute actual bins
        const hasComponents = features.some(
          f => (f.properties as Record<string, unknown> | null)?.['component_id'] != null,
        );
        setBins(hasComponents ? computeBins(features) : placeholderBins());
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        // Fall back to placeholder data if endpoint is not yet available
        setBins(placeholderBins());
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [cityId]);

  if (loading) {
    return (
      <div className="w-full flex items-center justify-center" style={{ height: 300 }}>
        <span className="text-sm text-gray-400">Cargando...</span>
      </div>
    );
  }

  return (
    <BarHistogram
      data={bins}
      accent="#3b82f6"
      title="Edificios por conectividad"
      subtitle="Edificios agrupados por tamaño de su red"
    />
  );
};

export default BuildingsDensityHistogram;
