import { fetchCities } from './api';
import type { CityData } from '../constants/cities';

let promise: Promise<CityData[]> | null = null;
let resolved: CityData[] | null = null;

export function getCities(): Promise<CityData[]> {
  if (!promise) {
    promise = fetchCities()
      .then(data => { resolved = data; return data; })
      .catch(err => { promise = null; throw err; });
  }
  return promise;
}

export function getCitiesSync(): CityData[] | null {
  return resolved;
}
