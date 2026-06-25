export const MAP_MODES = {
  INFRASTRUCTURE: 'infrastructure',
  TRAFFIC: 'traffic',
  STATIONS: 'stations',
  ACCIDENTS: 'accidents',
  TRANSPARENCY: 'transparency',
} as const;

export type MapMode = typeof MAP_MODES[keyof typeof MAP_MODES];
