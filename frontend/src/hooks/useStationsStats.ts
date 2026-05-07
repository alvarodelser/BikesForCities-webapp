import { useState, useEffect } from 'react';
import { fetchStations, fetchStationBuildingCoverage } from '../services/api';

export interface StationsStatsResult {
  totalBikes: number | null;
  activeStations: number | null;
  avgBuildingCount: number | null;
  cityCoverage: number | null;
  tripsBikeDay: number | null;
  avgStopMinutes: number | null;
  loading: boolean;
  error: string | null;
}

export function useStationsStats(cityId: number | null, initialBikes: number | null = null): StationsStatsResult {
  const [totalBikes, setTotalBikes] = useState<number | null>(initialBikes);
  const [activeStations, setActiveStations] = useState<number | null>(null);
  const [avgBuildingCount, setAvgBuildingCount] = useState<number | null>(null);
  const [cityCoverage, setCityCoverage] = useState<number | null>(null);
  const [tripsBikeDay, setTripsBikeDay] = useState<number | null>(null);
  const [avgStopMinutes, setAvgStopMinutes] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cityId === null) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setTotalBikes(initialBikes);

    Promise.all([fetchStations(cityId), fetchStationBuildingCoverage(cityId).catch(() => null)])
      .then(([stations, buildingCoverage]) => {
        if (cancelled) return;

        const count = stations.length;
        setActiveStations(count > 0 ? count : null);

        const totalMonthlyTrips = stations.reduce<number>((acc, s) => {
          return acc + (s.estimated_monthly_trips ?? 0);
        }, 0);

        if (count > 0 && totalMonthlyTrips > 0) {
          setTripsBikeDay(totalMonthlyTrips / count / 30);
        } else {
          setTripsBikeDay(null);
        }

        setAvgBuildingCount(buildingCoverage?.avgCount ?? null);
        setCityCoverage(buildingCoverage?.cityCoverage ?? null);

        const stationsWithDowntime = stations.filter(s => s.downtime_minutes != null);
        if (stationsWithDowntime.length > 0) {
          const avgDowntime =
            stationsWithDowntime.reduce((acc, s) => acc + (s.downtime_minutes ?? 0), 0) /
            stationsWithDowntime.length;
          setAvgStopMinutes(avgDowntime);
        } else {
          setAvgStopMinutes(null);
        }

        setLoading(false);
      })
      .catch(err => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Error al cargar las estadísticas de estaciones');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [cityId, initialBikes]);

  return {
    totalBikes,
    activeStations,
    avgBuildingCount,
    cityCoverage,
    tripsBikeDay,
    avgStopMinutes,
    loading,
    error,
  };
}
