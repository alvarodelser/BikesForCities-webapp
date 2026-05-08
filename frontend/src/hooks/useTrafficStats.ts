import { useState, useEffect } from 'react';
import { fetchTraffic } from '../services/api';

export interface TrafficOptions {
  period?: string;              // YYYY-MM
  generationType?: 'real' | 'station_based' | 'buildings_population';
  algorithm?: 'map_matched' | 'shortest' | 'safest';
}

export interface TrafficStatsResult {
  tripsPerMonth: number | null;
  tripsPerThousandHab: number | null;
  infraFraction: number | null;
  maxVolume: number | null;
  maxEdgeName: string | null;
  availablePeriods: string[];
  loading: boolean;
  error: string | null;
}

export function useTrafficStats(
  cityId: number | null,
  options: TrafficOptions,
  population?: number,
): TrafficStatsResult {
  const [tripsPerMonth, setTripsPerMonth] = useState<number | null>(null);
  const [tripsPerThousandHab, setTripsPerThousandHab] = useState<number | null>(null);
  const [infraFraction, setInfraFraction] = useState<number | null>(null);
  const [maxVolume, setMaxVolume] = useState<number | null>(null);
  const [maxEdgeName, setMaxEdgeName] = useState<string | null>(null);
  const [availablePeriods, setAvailablePeriods] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Serialize options to a stable string so useEffect can compare by value
  const serialized = JSON.stringify(options);

  useEffect(() => {
    if (cityId === null) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchTraffic(
      cityId,
      options.generationType,
      options.algorithm,
      options.period,
    )
      .then(traffic => {
        if (cancelled) return;

        // Use the new count field which represents number of edges with traffic
        const trips = traffic.count ?? null;
        setTripsPerMonth(trips);

        const tph =
          trips !== null && population && population > 0
            ? (trips / population) * 1000
            : null;
        setTripsPerThousandHab(tph);

        // Infra fraction is handled separately
        setInfraFraction(null);

        setMaxVolume(traffic.stats?.max ?? null);
        setMaxEdgeName(traffic.max_edge_name ?? null);

        setAvailablePeriods(traffic.available_periods ?? []);
        setLoading(false);
      })
      .catch(err => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Error al cargar las estadísticas de tráfico');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityId, serialized, population]);

  return {
    tripsPerMonth,
    tripsPerThousandHab,
    infraFraction,
    maxVolume,
    maxEdgeName,
    availablePeriods,
    loading,
    error,
  };
}
