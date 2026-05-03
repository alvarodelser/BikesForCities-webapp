import { useState, useEffect } from 'react';
import { fetchInfraStats } from '../services/api';

export interface InfraStatsResult {
  totalKm: number | null;
  coverage: number | null;
  gccFraction: number | null;
  kmPer100k: number | null;
  kmPerMeur: number | null;
  loading: boolean;
  error: string | null;
}

export function useInfraStats(cityId: number | null): InfraStatsResult {
  const [totalKm, setTotalKm] = useState<number | null>(null);
  const [coverage, setCoverage] = useState<number | null>(null);
  const [gccFraction, setGccFraction] = useState<number | null>(null);
  const [kmPer100k, setKmPer100k] = useState<number | null>(null);
  const [kmPerMeur, setKmPerMeur] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cityId === null) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchInfraStats(cityId)
      .then(infra => {
        if (cancelled) return;
        setTotalKm(infra.total_km);
        setCoverage(null); // not returned by infra stats endpoint; caller may derive from CityData
        setGccFraction(infra.gcc_fraction);
        setKmPerMeur(infra.km_per_meur_vias);

        // kmPer100k requires population which is not in InfraStats;
        // set null here so callers can compute it from CityData if needed
        setKmPer100k(null);
        setLoading(false);
      })
      .catch(err => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to fetch infra stats');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [cityId]);

  return { totalKm, coverage, gccFraction, kmPer100k, kmPerMeur, loading, error };
}
