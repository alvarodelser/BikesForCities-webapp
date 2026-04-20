import { API_BASE_URL } from '../config/api';
import type { CityData } from '../constants/cities';
import type * as GeoJSON from 'geojson';

export const fetchCities = async (): Promise<CityData[]> => {
  const response = await fetch(`${API_BASE_URL}/cities`);
  if (!response.ok) {
    throw new Error('Failed to fetch cities');
  }
  const result = await response.json();

  return result.data.map((city: any) => ({
    id: city.id,
    name: city.name,
    path: `/map/${city.name.toLowerCase()}`,
    description: city.description,
    geoCoords: { longitude: city.center_lon, latitude: city.center_lat },
    maxBounds: city.bounds ? [
      [city.bounds.min_lon, city.bounds.min_lat],
      [city.bounds.max_lon, city.bounds.max_lat]
    ] : undefined,
    population: city.population || 0,
    budget: city.budget || 0,
    cyclingNetwork: city.cycling_network || 0,
    coverage: city.coverage || 0,
    mayor: city.mayor,
    mayor_party: city.mayor_party,
    service_name: city.service_name,
    stations_count: city.stations_count,
    monthly_trips: city.monthly_trips,
    available_modes: city.available_modes,
    angle: city.angle || 0
  }));
};

export interface StationData {
  id: number;
  station_id: string;
  name: string | null;
  lat: number;
  lon: number;
  citybikes_network_id: string;
  estimated_monthly_trips: number | null;
  downtime_minutes: number | null;
  reach_coverage?: number;
  extra?: any;
}

export const fetchStations = async (cityId: number): Promise<StationData[]> => {
  const response = await fetch(`${API_BASE_URL}/cities/${cityId}/stations`);
  if (!response.ok) {
    throw new Error('Failed to fetch stations');
  }
  const result = await response.json();
  return result.data;
};

export interface HourlyAvailability {
  hour_of_day: number;
  avg_bikes: number;
}

export interface SystemStatusCity {
  id: number;
  name: string;
  nodes: number;
  edges: number;
  routes: number;
  stations_count: number;
  monthly_trips: number;
  available_modes: Record<string, boolean>;
  features: Record<string, number>;
}

export interface IngestionRow {
  city: string;
  process_name: string;
  status: string;
  updated_at: string | null;
}

export interface TimePeriodRow {
  city: string;
  process_name: string;
  status: string;
  time_period: string;
  updated_at: string | null;
}

export interface SystemStatus {
  generated_at: string;
  cities: SystemStatusCity[];
  ingestion: IngestionRow[];
  ingestion_time_periods: TimePeriodRow[];
}

export const fetchSystemStatus = async (): Promise<SystemStatus> => {
  const response = await fetch(`${API_BASE_URL}/status`);
  if (!response.ok) throw new Error('Failed to fetch system status');
  const result = await response.json();
  return result.data;
};

export const fetchStationHourlyAvailability = async (
  cityId: number,
  stationId: string,
  period: string = 'all'
): Promise<HourlyAvailability[]> => {
  const response = await fetch(
    `${API_BASE_URL}/cities/${cityId}/stations/${stationId}/hourly-availability?period=${period}`
  );
  if (!response.ok) {
    throw new Error('Failed to fetch hourly availability');
  }
  const result = await response.json();
  return result.data;
};

export interface TrafficCount {
  edge_id: number;
  trip_count: number;
  month?: string;
}

export const fetchTraffic = async (cityId: number): Promise<TrafficCount[]> => {
  const response = await fetch(`${API_BASE_URL}/cities/${cityId}/traffic`);
  if (!response.ok) {
    throw new Error('Failed to fetch traffic data');
  }
  const result = await response.json();
  return result.data;
};

export const fetchEdgeRoutes = async (
  cityId: number,
  edgeId: number,
  mode: 'traces' | 'heatmap' = 'traces',
  limit: number = 500,
): Promise<{ data: GeoJSON.FeatureCollection; count: number }> => {
  const response = await fetch(
    `${API_BASE_URL}/cities/${cityId}/edges/${edgeId}/routes?mode=${mode}&limit=${limit}`
  );
  if (!response.ok) throw new Error('Failed to fetch edge routes');
  return await response.json();
};

export interface StationReachData extends GeoJSON.FeatureCollection {
  polygon?: GeoJSON.Feature;
  circle?: GeoJSON.Feature;
  edges: GeoJSON.FeatureCollection;
  coverage: number;
}

export const fetchStationReach = async (
  cityId: number,
  stationId: string,
  maxDistance: number = 1000
): Promise<StationReachData> => {
  const response = await fetch(
    `${API_BASE_URL}/cities/${cityId}/stations/${stationId}/reach?max_distance=${maxDistance}`
  );
  if (!response.ok) {
    throw new Error('Failed to fetch station reachability');
  }
  const result = await response.json();
  return result.data;
};

