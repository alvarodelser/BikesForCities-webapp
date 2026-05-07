import { API_BASE_URL, API_KEY } from '../config/api';
import type { CityData } from '../constants/cities';
import type * as GeoJSON from 'geojson';

const apiFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
  const headers = new Headers(options.headers || {});
  if (API_KEY) {
    headers.set('X-API-Key', API_KEY);
  }
  return fetch(url, { ...options, headers });
};

export const fetchCities = async (): Promise<CityData[]> => {
  const response = await apiFetch(`${API_BASE_URL}/cities`);
  if (!response.ok) {
    throw new Error('Error al cargar las ciudades');
  }
  const result = await response.json();

  return result.data.map((city: any) => ({
    id: city.id,
    name: city.name,
    altName: city.alt_name,
    slug: city.slug,
    path: `/map/${city.slug}`,
    description: city.description,
    geoCoords: { longitude: city.center_lon, latitude: city.center_lat },
    maxBounds: city.bounds ? [
      [city.bounds.min_lon, city.bounds.min_lat],
      [city.bounds.max_lon, city.bounds.max_lat]
    ] : undefined,
    population: city.population || 0,
    budget: city.budget ?? null,
    mayor: city.mayor,
    mayor_party: city.mayor_party,
    service_name: city.service_name,
    stations_count: city.stations_count,
    monthly_trips: city.monthly_trips,
    bicycles_count: city.bicycles_count,
    station_coverage: city.station_coverage,
    coverage: city.coverage,
    cyclingNetwork: city.cycling_network,
    available_modes: city.available_modes,
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
  building_count?: number;
  extra?: any;
}

export const fetchStations = async (cityId: number): Promise<StationData[]> => {
  const response = await apiFetch(`${API_BASE_URL}/cities/${cityId}/stations`);
  if (!response.ok) {
    throw new Error('Error al cargar las estaciones');
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
  available_modes: Record<string, unknown>;
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
  const response = await apiFetch(`${API_BASE_URL}/status`);
  if (!response.ok) throw new Error('Error al cargar el estado del sistema');
  const result = await response.json();
  return result.data;
};

export const fetchStationHourlyAvailability = async (
  cityId: number,
  stationId: string,
  period: string = 'all'
): Promise<HourlyAvailability[]> => {
  const response = await apiFetch(
    `${API_BASE_URL}/cities/${cityId}/stations/${stationId}/hourly-availability?period=${period}`
  );
  if (!response.ok) {
    throw new Error('Error al cargar la disponibilidad horaria');
  }
  const result = await response.json();
  return result.data;
};

export interface TrafficCount {
  edge_id: number;
  trip_count: number;
  month?: string;
}

export interface TrafficStats {
  q5: number;
  q50: number;
  q95: number;
  min: number;
  max: number;
}

export interface TrafficMode {
  generation_type: string;
  algorithm: string;
  edge_count: number;
}

export interface TrafficApiResponse {
  data: TrafficCount[];
  count: number;
  generation_type: string | null;
  algorithm: string | null;
  month: string | null;
  stats: TrafficStats | null;
  available_periods?: string[];  // YYYY-MM strings desc-sorted
  max_edge_name?: string | null;
}

export const fetchTraffic = async (
  cityId: number,
  generationType?: string,
  algorithm?: string,
  month?: string,
): Promise<TrafficApiResponse> => {
  const params = new URLSearchParams();
  if (generationType) params.set('generation_type', generationType);
  if (algorithm) params.set('algorithm', algorithm);
  if (month) params.set('month', month);
  const qs = params.toString();
  const response = await apiFetch(`${API_BASE_URL}/cities/${cityId}/traffic${qs ? `?${qs}` : ''}`);
  if (!response.ok) {
    throw new Error('Error al cargar los datos de tráfico');
  }
  const result = await response.json();
  return {
    data: result.data,
    count: result.count,
    generation_type: result.generation_type ?? null,
    algorithm: result.algorithm ?? null,
    month: result.month ?? null,
    stats: result.stats ?? null,
    available_periods: result.available_periods,
    max_edge_name: result.max_edge_name ?? null,
  };
};

// Lean alternative to fetchTraffic: resolves (generation_type, algorithm, month) and
// returns percentile stats without any per-edge data. The trip_count values themselves
// are now baked into Martin vector tiles via the edges_with_traffic() SQL function.
export interface TrafficResolveResult {
  generation_type: string | null;
  algorithm: string | null;
  month: string | null;
  stats: TrafficApiResponse['stats'];
  available_periods?: string[];
  max_edge_name?: string | null;
}

export const fetchTrafficResolve = async (
  cityId: number,
  generationType?: string,
  algorithm?: string,
  month?: string,
): Promise<TrafficResolveResult> => {
  const params = new URLSearchParams();
  if (generationType) params.set('generation_type', generationType);
  if (algorithm) params.set('algorithm', algorithm);
  if (month) params.set('month', month);
  const qs = params.toString();
  const response = await fetch(`${API_BASE_URL}/cities/${cityId}/traffic/resolve${qs ? `?${qs}` : ''}`);
  if (!response.ok) throw new Error('Error al resolver los parámetros de tráfico');
  const result = await response.json();
  return {
    generation_type: result.generation_type ?? null,
    algorithm: result.algorithm ?? null,
    month: result.month ?? null,
    stats: result.stats ?? null,
    available_periods: result.available_periods,
    max_edge_name: result.max_edge_name ?? null,
  };
};


export const fetchTrafficModes = async (cityId: number): Promise<TrafficMode[]> => {
  const response = await fetch(`${API_BASE_URL}/cities/${cityId}/traffic/modes`);
  if (!response.ok) throw new Error('Error al cargar los modos de tráfico');
  const result = await response.json();
  return result.data;
};

export interface EdgeRoutesResult {
  count: number;
  total: number;
  offset: number;
  data: GeoJSON.FeatureCollection;
}

export interface EdgeRoutesParams {
  mode?: 'traces' | 'heatmap';
  limit?: number;
  offset?: number;
  generationType?: string;
  algorithm?: string;
  month?: string;
}

export const fetchEdgeRoutes = async (
  cityId: number,
  edgeId: number,
  params: EdgeRoutesParams = {},
): Promise<EdgeRoutesResult> => {
  const qs = new URLSearchParams();
  qs.set('mode', params.mode ?? 'traces');
  qs.set('limit', String(params.limit ?? 100));
  qs.set('offset', String(params.offset ?? 0));
  if (params.generationType) qs.set('generation_type', params.generationType);
  if (params.algorithm) qs.set('algorithm', params.algorithm);
  if (params.month) qs.set('month', params.month);
  const response = await apiFetch(
    `${API_BASE_URL}/cities/${cityId}/edges/${edgeId}/routes?${qs.toString()}`
  );
  if (!response.ok) throw new Error('Error al cargar las rutas de los tramos');
  const envelope = await response.json();
  return {
    data: envelope.data,
    count: envelope.count,
    total: envelope.total ?? envelope.count,
    offset: envelope.offset ?? 0,
  };
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
  const response = await apiFetch(
    `${API_BASE_URL}/cities/${cityId}/stations/${stationId}/reach?max_distance=${maxDistance}`
  );
  if (!response.ok) {
    throw new Error('Error al cargar el alcance de la estación');
  }
  const result = await response.json();
  return result.data;
};

export interface AccidentParticipant {
  vehicle_type: string | null;
  person_type: string | null;
  injury_code: number | null;
  injury_status: string | null;
  alcohol_positive: boolean | null;
  drugs_positive: boolean | null;
}

export interface AccidentFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  properties: {
    accident_id: string;
    timestamp: string | null;
    street: string | null;
    street_number: string | null;
    district: string | null;
    accident_type: string | null;
    weather: string | null;
    total_involved: number;
    injured: number;
    killed: number;
    cyclists_involved: number;
    pedestrians_involved: number;
    severity: 'fatal' | 'serious' | 'minor' | 'uninjured';
    max_injury_code: number | null;
    worst_injury_status: string | null;
    participants?: AccidentParticipant[];
  };
}

export interface AccidentsGeoJSON {
  type: 'FeatureCollection';
  features: AccidentFeature[];
}

export const fetchAccidents = async (cityId: number): Promise<AccidentsGeoJSON> => {
  const response = await apiFetch(`${API_BASE_URL}/cities/${cityId}/accidents?cyclists_only=false`);
  if (!response.ok) {
    throw new Error('Error al cargar los datos de accidentes');
  }
  const result = await response.json();
  return result.data;
};

// ── Infrastructure analytics ─────────────────────────────────────────────────

export interface InfraStats {
  gcc_fraction: number | null;
  gcc_km: number | null;
  total_km: number | null;
  n_components: number;
  coverage: number | null;
  vias_budget_year: number | null;
  vias_budget_type: string | null;
  vias_budget_eur: number | null;
  km_per_meur_vias: number | null;
}

export const fetchInfraComponents = async (cityId: number): Promise<GeoJSON.FeatureCollection> => {
  const response = await apiFetch(`${API_BASE_URL}/cities/${cityId}/infrastructure/components`);
  if (!response.ok) throw new Error('Error al cargar los componentes de infraestructura');
  const result = await response.json();
  return result.data;
};

export const fetchBuildingCoverageComponents = async (cityId: number): Promise<GeoJSON.FeatureCollection> => {
  const response = await apiFetch(`${API_BASE_URL}/cities/${cityId}/infrastructure/building-coverage`);
  if (!response.ok) throw new Error('Error al cargar los datos de cobertura de edificios');
  const result = await response.json();
  return result.data;
};

export interface EdgeBuildingCoverageItem {
  edge_id: number;
  length_m: number;
  building_count: number;
}

export const fetchEdgeBuildingCoverage = async (cityId: number): Promise<EdgeBuildingCoverageItem[]> => {
  const response = await apiFetch(`${API_BASE_URL}/cities/${cityId}/infrastructure/edge-building-coverage`);
  if (!response.ok) throw new Error('Error al cargar la cobertura de edificios por tramo');
  const result = await response.json();
  return result.edges;
};

export const fetchInfraStats = async (cityId: number): Promise<InfraStats> => {
  const response = await apiFetch(`${API_BASE_URL}/cities/${cityId}/infrastructure/stats`);
  if (!response.ok) throw new Error('Error al cargar las estadísticas de infraestructura');
  const result = await response.json();
  return result.data;
};

// ── Traffic analytics ─────────────────────────────────────────────────────────

export interface TrafficInfraCoverageData {
  infra_fraction: number | null;
  km_on_infra: number | null;
  generation_type: string | null;
  algorithm: string | null;
  month: string | null;
}

export const fetchTrafficInfraCoverage = async (
  cityId: number,
  generationType?: string,
  algorithm?: string,
  month?: string,
): Promise<TrafficInfraCoverageData> => {
  const params = new URLSearchParams();
  if (generationType) params.set('generation_type', generationType);
  if (algorithm) params.set('algorithm', algorithm);
  if (month) params.set('month', month);
  const qs = params.toString();
  const response = await apiFetch(
    `${API_BASE_URL}/cities/${cityId}/traffic/infra-coverage${qs ? `?${qs}` : ''}`
  );
  if (!response.ok) throw new Error('Error al cargar la cobertura de infraestructura de tráfico');
  const r = await response.json();
  return r.data;
};

export interface HistogramSeries {
  bin_edges: number[];
  counts: number[];
}

export interface RouteHistogramSeries {
  generation_type: string;
  algorithm: string;
  n_routes: number;
  length_km: HistogramSeries;
  infra_fraction: HistogramSeries;
}

export const fetchRouteHistogram = async (
  cityId: number,
  bins = 20,
): Promise<RouteHistogramSeries[]> => {
  const response = await apiFetch(
    `${API_BASE_URL}/cities/${cityId}/traffic/histogram?bins=${bins}`
  );
  if (!response.ok) throw new Error('Error al cargar el histograma de rutas');
  const result = await response.json();
  return result.data;
};

// ── Station analytics ─────────────────────────────────────────────────────────

export interface StationMonthlyPoint {
  month: string | null;
  estimated_trips: number | null;
  actual_trips: number | null;
  active_stations: number;
}

export const fetchStationMonthly = async (cityId: number): Promise<StationMonthlyPoint[]> => {
  const response = await apiFetch(`${API_BASE_URL}/cities/${cityId}/stations/monthly`);
  if (!response.ok) throw new Error('Error al cargar los datos mensuales de estaciones');
  const result = await response.json();
  return result.data;
};

export interface StationBuildingCoverage {
  avgCount: number;
  cityCoverage: number;
}

export const fetchStationBuildingCoverage = async (cityId: number): Promise<StationBuildingCoverage> => {
  const response = await apiFetch(`${API_BASE_URL}/cities/${cityId}/stations/building-coverage`);
  if (!response.ok) throw new Error('Error al cargar la cobertura de edificios de las estaciones');
  const result = await response.json();
  return {
    avgCount: result.avg_count,
    cityCoverage: result.city_coverage
  };
};

// ── Budget & political data ───────────────────────────────────────────────────

export interface BudgetCategory {
  category_code: string;
  category_name: string | null;
  amount: number;
  budget_type: string;
}

export interface BudgetYear {
  year: number;
  total_income: number | null;
  total_expenses: number | null;
  public_debt: number | null;
  lines: BudgetCategory[];
}

export const fetchCityBudgets = async (cityId: number): Promise<BudgetYear[]> => {
  const response = await apiFetch(`${API_BASE_URL}/cities/${cityId}/budgets`);
  if (!response.ok) throw new Error('Error al cargar los presupuestos de la ciudad');
  const result = await response.json();
  return result.data;
};

export interface MayorRecord {
  name: string;
  party: string | null;
  start_date: string | null;
  end_date: string | null;
}

export interface ElectionResult {
  year: number;
  party: string;
  votes: number | null;
  councilors: number | null;
}

export interface MayorsTimeline {
  mayors: MayorRecord[];
  elections: ElectionResult[];
}

export const fetchMayorsTimeline = async (cityId: number): Promise<MayorsTimeline> => {
  const response = await apiFetch(`${API_BASE_URL}/cities/${cityId}/mayors`);
  if (!response.ok) throw new Error('Error al cargar la historia de alcaldes');
  return response.json();
};

// ── City context (mayors + budget breakdown) ──────────────────────────────────

export interface MayorTerm {
  name: string;
  party: string | null;
  start_date: string | null;
  end_date: string | null; // null = current incumbent
}

export interface ContextBudgetCategory {
  code: string;
  name: string;
  amount: number;
}

export interface CityContextData {
  mayors: MayorTerm[];
  budget_year: number | null;
  budget_categories: {
    planned?: ContextBudgetCategory[];
    executed?: ContextBudgetCategory[];
  };
}

export async function fetchCityContext(cityId: number): Promise<CityContextData> {
  const response = await apiFetch(`${API_BASE_URL}/cities/${cityId}/context`);
  if (!response.ok) throw new Error('Error al cargar el contexto de la ciudad');
  const result = await response.json();
  // Unwrap .data envelope if present (consistent with other endpoints)
  return result.data ?? result;
}
