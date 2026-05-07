export interface CityData {
  id?: number;
  name: string;
  altName?: string;
  slug: string;
  path: string;
  description?: string;
  mapCoords?: { x: number; y: number }; // Legacy pixel coordinates (deprecated)
  geoCoords: { longitude: number; latitude: number }; // Real geographic coordinates
  maxBounds?: [[number, number], [number, number]]; // [sw[lng, lat], ne[lng, lat]]
  population: number;
  budget: number | null;
  mayor?: string;
  mayor_party?: string;
  service_name?: string;
  stations_count?: number;
  monthly_trips?: number;
  bicycles_count?: number;
  trips_per_inhabitant?: number;
  available_modes?: Record<string, unknown>;
  cyclingNetwork?: number;
  coverage?: number;
  station_coverage?: number;
  mode_scores?: {
    [mode: string]: {
      overall: number;
      segments: {
        label: string;
        weight: number;
        value: number;
        color: string;
      }[];
    };
  };
}