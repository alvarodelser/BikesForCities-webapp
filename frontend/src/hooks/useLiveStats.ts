import { useState, useEffect } from 'react';
import type { ComponentType } from 'react';
import { BarChart3, Bike, Clock, MapPin, TrendingUp, Lock, Activity } from 'lucide-react';
import type { CityData } from '../constants/cities';
import { MAP_MODES, type MapMode } from '../constants/mapModes';
import {
  fetchStations,
  fetchTraffic,
  fetchTrafficModes,
  fetchInfraStats,
  fetchTrafficInfraCoverage,
  type TrafficMode,
} from '../services/api';

export interface LiveStat {
  label: string;
  value: string;
  icon: ComponentType<{ className?: string }>;
  trend?: 'up' | 'down' | 'neutral';
  comingSoon?: boolean;
}

export interface LiveStatsResult {
  stats: LiveStat[];
  trafficModes: TrafficMode[];
  availablePeriods: string[];
  loading: boolean;
}

function locked(label: string): LiveStat {
  return { label, value: 'Próximamente', icon: Lock, comingSoon: true };
}

export function formatMonth(month: string | null): string {
  if (!month) return '—';
  const parts = month.split('-');
  return new Date(Number(parts[0]), Number(parts[1]) - 1)
    .toLocaleDateString('es', { month: 'long', year: 'numeric' });
}

export function useLiveStats(
  city: CityData,
  mode: MapMode,
  generation: string,
  routing: string,
  period: string = '',
): LiveStatsResult {
  const [stats, setStats] = useState<LiveStat[]>([]);
  const [trafficModes, setTrafficModes] = useState<TrafficMode[]>([]);
  const [availablePeriods, setAvailablePeriods] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (city.id === undefined) return;
    let cancelled = false;

    if (mode === MAP_MODES.INFRASTRUCTURE) {
      // Start with loading state; fetch infra stats
      const loadingStats: LiveStat[] = [
        { label: 'Total km red', value: '—', icon: BarChart3 },
        { label: 'Km / 100k hab.', value: '—', icon: Activity },
        locked('Km / M€ en vías públicas'),
        { label: 'Cobertura', value: '—', icon: TrendingUp, trend: 'up' },
        locked('Cobertura componente principal'),
      ];
      setStats(loadingStats);
      setTrafficModes([]);
      setAvailablePeriods([]);
      setLoading(true);

      // Fetch infra stats for all metrics
      if (!city.id) return;
      fetchInfraStats(city.id).then(infra => {
        if (cancelled) return;

        const totalKm = infra.total_km ?? 0;
        const kmPer100k = city.population > 0 && totalKm > 0
          ? (totalKm / (city.population / 100_000)).toFixed(2)
          : '—';
        const coverage = infra.coverage != null
          ? `${(infra.coverage * 100).toFixed(1)} %`
          : '—';
        const kmPerMeur = infra.km_per_meur_vias != null
          ? `${infra.km_per_meur_vias.toFixed(2)} km/M€`
          : '—';
        const gccVal = infra.gcc_fraction != null
          ? `${(infra.gcc_fraction * 100).toFixed(1)} %`
          : '—';

        setStats([
          { label: 'Total km red', value: `${totalKm.toFixed(1)} km`, icon: BarChart3 },
          { label: 'Km / 100k hab.', value: `${kmPer100k} km`, icon: Activity },
          {
            label: `Km / M€ vías (${infra.vias_budget_year ?? '?'})`,
            value: kmPerMeur,
            icon: Activity,
            comingSoon: infra.km_per_meur_vias == null,
          },
          { label: 'Cobertura', value: coverage, icon: TrendingUp, trend: 'up' },
          {
            label: 'Cobertura GCC',
            value: gccVal,
            icon: TrendingUp,
            trend: infra.gcc_fraction != null ? 'up' : 'neutral',
            comingSoon: infra.gcc_fraction == null,
          },
        ]);
        setLoading(false);
      }).catch((err) => {
        console.error('Failed to fetch infrastructure stats:', err);
        if (!cancelled) {
          setStats([
            { label: 'Total km red', value: 'Error', icon: BarChart3 },
            { label: 'Km / 100k hab.', value: 'Error', icon: Activity },
            { ...loadingStats[2], value: 'Error' },
            { label: 'Cobertura', value: 'Error', icon: TrendingUp, trend: 'up' },
            { ...loadingStats[4], value: 'Error' },
          ]);
          setLoading(false);
        }
      });

      return;
    }

    setLoading(true);

    async function load() {
      if (city.id === undefined) return;
      try {
        let result: LiveStat[] = [];
        let modes: TrafficMode[] = [];

        if (mode === MAP_MODES.TRAFFIC) {
          const [traffic, fetchedModes, infraCov] = await Promise.all([
            fetchTraffic(city.id, generation || undefined, routing || undefined, period || undefined),
            fetchTrafficModes(city.id),
            fetchTrafficInfraCoverage(city.id, generation || undefined, routing || undefined).catch(() => null),
          ]);
          modes = fetchedModes;

          // Get current period from response
          const currentPeriod = traffic.month || '';
          const periods = currentPeriod ? [currentPeriod] : [];

          // TODO: Enhance to fetch all available periods from backend
          // For now, we set the periods to at least the current period
          // Backend should provide an endpoint like /cities/{id}/traffic/periods
          // that returns all available periods for this city
          if (periods.length > 0) {
            setAvailablePeriods(periods);
          }
          const monthlyTrips = city.monthly_trips
            ? city.monthly_trips.toLocaleString('es')
            : '—';
          const median = traffic.stats != null
            ? Math.round(traffic.stats.q50).toLocaleString('es')
            : '—';
          const infraVal = infraCov?.km_on_infra != null
            ? `${infraCov.km_on_infra.toFixed(1)} km`
            : null;
          result = [
            { label: 'Viajes estimados/mes', value: monthlyTrips, icon: TrendingUp },
            { label: 'Mediana viajes/tramo', value: `${median} v/mes`, icon: BarChart3 },
            infraVal
              ? { label: 'Km con infraestructura', value: infraVal, icon: Activity, trend: 'up' as const }
              : locked('Km con infraestructura'),
          ];
        } else if (mode === MAP_MODES.STATIONS) {
          const stations = await fetchStations(city.id);
          const withDowntime = stations.filter(s => s.downtime_minutes !== null);
          const meanDowntime = withDowntime.length > 0
            ? Math.round(withDowntime.reduce((sum, s) => sum + (s.downtime_minutes ?? 0), 0) / withDowntime.length)
            : null;
          const withReach = stations.filter(s => (s.reach_coverage ?? 0) > 0);
          const meanReach = withReach.length > 0
            ? ((withReach.reduce((sum, s) => sum + (s.reach_coverage ?? 0), 0) / withReach.length) * 100).toFixed(1)
            : null;
          const bikesPerInhabitant = city.population > 0
            ? ((city.bicycles_count ?? 0) / city.population * 100000).toFixed(2)
            : '—';
          result = [
            { label: 'Bicicletas totales', value: (city.bicycles_count ?? 0).toLocaleString('es'), icon: Bike },
            { label: 'Bicicletas / 100k hab.', value: `${bikesPerInhabitant}`, icon: Activity },
            { label: 'Estaciones', value: (city.stations_count ?? 0).toLocaleString('es'), icon: MapPin },
            {
              label: 'Tiempo parado medio',
              value: meanDowntime !== null ? `${meanDowntime} min/día` : '—',
              icon: Clock,
            },
            {
              label: 'Cobertura por alcance',
              value: meanReach !== null ? `${meanReach} %` : '—',
              icon: TrendingUp,
              trend: meanReach !== null ? 'up' : 'neutral',
            },
          ];
        }

        if (!cancelled) {
          setStats(result);
          setTrafficModes(modes);
          setLoading(false);
        }
      } catch (err) {
        console.error('useLiveStats:', err);
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [city.id, mode, generation, routing, period, city.population, city.bicycles_count, city.stations_count, city.monthly_trips]);

  return { stats, trafficModes, availablePeriods, loading };
}
