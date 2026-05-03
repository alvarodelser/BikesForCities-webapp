import { useState, useEffect } from 'react';
import { fetchStations } from '../services/api';

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

    fetchStations(cityId)
      .then(stations => {
        if (cancelled) return;

        const count = stations.length;
        setActiveStations(count > 0 ? count : null);

        // Sum estimated monthly trips across all stations
        const totalMonthlyTrips = stations.reduce<number>((acc, s) => {
          return acc + (s.estimated_monthly_trips ?? 0);
        }, 0);

        // Derive tripsBikeDay = total_trips / total_stations / 30
        // (trips per station per day as a proxy for trips per bike per day)
        if (count > 0 && totalMonthlyTrips > 0) {
          setTripsBikeDay(totalMonthlyTrips / count / 30);
        } else {
          setTripsBikeDay(null);
        }

        // Average reach_coverage across stations that have it
        const stationsWithReach = stations.filter(s => s.reach_coverage != null);
        if (stationsWithReach.length > 0) {
          const avgReach =
            stationsWithReach.reduce((acc, s) => acc + (s.reach_coverage ?? 0), 0) /
            stationsWithReach.length;
          setReachCoverage(avgReach);
        } else {
          setReachCoverage(null);
        }

        // Average downtime minutes across stations that have it
        const stationsWithDowntime = stations.filter(s => s.downtime_minutes != null);
        if (stationsWithDowntime.length > 0) {
          const avgDowntime =
            stationsWithDowntime.reduce((acc, s) => acc + (s.downtime_minutes ?? 0), 0) /
            stationsWithDowntime.length;
          setAvgStopMinutes(avgDowntime);
        } else {
          setAvgStopMinutes(null);
        }

        // totalBikes is not available in station-level data — set null; callers can
        // pass it from CityData.bicycles_count
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
