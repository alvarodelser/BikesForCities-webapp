import { useState, useEffect } from 'react';
import { fetchStations, fetchStationBuildingCoverage } from '../services/api';

export interface StationsStatsResult {
  totalBikes: number | null;
  activeStations: number | null;
  reachCoverage: number | null;
  tripsBikeDay: number | null;
  avgStopMinutes: number | null;
  loading: boolean;
  error: string | null;
}

export function useStationsStats(cityId: number | null): StationsStatsResult {
  const [totalBikes, setTotalBikes] = useState<number | null>(null);
  const [activeStations, setActiveStations] = useState<number | null>(null);
  const [reachCoverage, setReachCoverage] = useState<number | null>(null);
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

        setReachCoverage(buildingCoverage);

        const stationsWithDowntime = stations.filter(s => s.downtime_minutes != null);
        if (stationsWithDowntime.length > 0) {
          const avgDowntime =
            stationsWithDowntime.reduce((acc, s) => acc + (s.downtime_minutes ?? 0), 0) /
            stationsWithDowntime.length;
          setAvgStopMinutes(avgDowntime);
        } else {
          setAvgStopMinutes(null);
        }

        setTotalBikes(null);

        setLoading(false);
      })
      .catch(err => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to fetch stations stats');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [cityId]);

  return {
    totalBikes,
    activeStations,
    reachCoverage,
    tripsBikeDay,
    avgStopMinutes,
    loading,
    error,
  };
}
