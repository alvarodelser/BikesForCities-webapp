import { API_BASE_URL } from '../config/api';
import type { CityData } from '../constants/cities';

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
