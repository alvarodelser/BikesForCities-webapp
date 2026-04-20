export const MAP_MODES = {
  INFRASTRUCTURE: 'infrastructure',
  TRAFFIC: 'traffic',
  STATIONS: 'stations',
  TERRAIN: 'terrain',
  INTERSECTIONS: 'intersections',
  ACCIDENTS: 'accidents',
} as const;

export type MapMode = typeof MAP_MODES[keyof typeof MAP_MODES];
