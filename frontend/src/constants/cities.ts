export interface CityData {
  id?: number;
  name: string;
  path: string;
  description?: string;
  mapCoords?: { x: number; y: number }; // Legacy pixel coordinates (deprecated)
  geoCoords: { longitude: number; latitude: number }; // Real geographic coordinates
  maxBounds?: [[number, number], [number, number]]; // [sw[lng, lat], ne[lng, lat]]
  population: number;
  budget: number;
  cyclingNetwork: number;
  coverage: number;
  mayor?: string;
  mayor_party?: string;
  service_name?: string;
  stations_count?: number;
  monthly_trips?: number;
  bicycles_count?: number;
  available_modes?: Record<string, boolean>;
  angle?: number;
}