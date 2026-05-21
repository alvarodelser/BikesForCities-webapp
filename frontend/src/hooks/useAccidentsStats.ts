import { useState, useEffect } from 'react';
import { fetchAccidents, fetchAccidentsSummary } from '../services/api';
import type { AccidentFeature } from '../services/api';

export interface MatrixSegment {
  value: number;
  color: string;
  label: string;
}

export interface MatrixRow {
  label: string;
  total: number;
  segments: MatrixSegment[];
}

export interface CollisionCell {
  count: number;
  segments: MatrixSegment[];
}

export interface CollisionMatrixRow {
  rowKey: string;
  cells: Array<{ colKey: string; cell: CollisionCell }>;
}

export interface AccidentsStatsResult {
  totalAccidents: number;
  cyclistAccidents: number;
  pedestrianAccidents: number;
  latestYear: number | null;
  availableYears: number[];
  cyclistVehicleMatrix: MatrixRow[];
  pedestrianVehicleMatrix: MatrixRow[];
  epacWeatherBars: { label: string; value: number }[];
  collisionMatrix: CollisionMatrixRow[];
  hasAllAccidentData: boolean;
  loading: boolean;
  error: string | null;
}

const SEV_COLORS = {
  ileso: '#22c55e',
  leve: '#fbbf24',
  grave: '#f97316',
  fatal: '#7f1d1d',
} as const;

function getSeverityIndex(props: AccidentFeature['properties']): number {
  switch (props.severity) {
    case 'fatal':   return 3;
    case 'serious': return 2;
    case 'minor':   return 1;
    default:        return 0;
  }
}

function isLluvia(weather: string | null): boolean {
  if (!weather) return false;
  return /lluvia|rain/i.test(weather);
}

const CYCLIST_VEHICLE_ROWS = [
  'Coche/Furg',
  'Bus',
  'Camión/Maq',
  'Moto',
  'Caída sola',
] as const;

type CyclistRow = (typeof CYCLIST_VEHICLE_ROWS)[number];

function getCyclistRow(vehicles: string[]): CyclistRow {
  const others = vehicles.filter(v => v !== 'bike_vmu');
  if (others.length === 0) return 'Caída sola';
  if (others.includes('bus'))   return 'Bus';
  if (others.includes('truck')) return 'Camión/Maq';
  if (others.includes('moto'))  return 'Moto';
  return 'Coche/Furg';
}

const PEDESTRIAN_VEHICLE_ROWS = [
  'Coche/Furg',
  'Bus',
  'Camión/Maq',
  'Moto',
  'Bicicleta',
] as const;

type PedestrianRow = (typeof PEDESTRIAN_VEHICLE_ROWS)[number];

function getPedestrianRow(vehicles: string[]): PedestrianRow | null {
  const others = vehicles.filter(v => v !== 'pedestrian');
  if (others.length === 0) return null;
  if (others.includes('bike_vmu')) return 'Bicicleta';
  if (others.includes('bus'))      return 'Bus';
  if (others.includes('truck'))    return 'Camión/Maq';
  if (others.includes('moto'))     return 'Moto';
  return 'Coche/Furg';
}

// All vehicle types present in vehicles_involved
export const COLLISION_VEHICLE_KEYS = ['bike_vmu', 'pedestrian', 'moto', 'car', 'bus', 'truck'] as const;
export type CollisionVehicleKey = typeof COLLISION_VEHICLE_KEYS[number];

function buildEmptySegments(): MatrixSegment[] {
  return [
    { value: 0, color: SEV_COLORS.ileso, label: 'Ileso' },
    { value: 0, color: SEV_COLORS.leve,  label: 'Leve' },
    { value: 0, color: SEV_COLORS.grave, label: 'Grave' },
    { value: 0, color: SEV_COLORS.fatal, label: 'Fatal' },
  ];
}

function buildEmptyMatrix(rowLabels: readonly string[]): MatrixRow[] {
  return rowLabels.map(label => ({
    label,
    total: 0,
    segments: buildEmptySegments(),
  }));
}

function buildCyclistMatrix(features: AccidentFeature[]): MatrixRow[] {
  const matrix = buildEmptyMatrix(CYCLIST_VEHICLE_ROWS);
  const indexMap = Object.fromEntries(CYCLIST_VEHICLE_ROWS.map((l, i) => [l, i]));
  for (const feature of features) {
    const props = feature.properties;
    const vehicles = Array.isArray(props.vehicles_involved) ? props.vehicles_involved : [];
    if (!vehicles.includes('bike_vmu')) continue;
    const ri = indexMap[getCyclistRow(vehicles)];
    if (ri === undefined) continue;
    const sevIdx = getSeverityIndex(props);
    matrix[ri].total += 1;
    matrix[ri].segments[sevIdx].value += 1;
  }
  return matrix;
}

function buildPedestrianMatrix(features: AccidentFeature[]): MatrixRow[] {
  const matrix = buildEmptyMatrix(PEDESTRIAN_VEHICLE_ROWS);
  const indexMap = Object.fromEntries(PEDESTRIAN_VEHICLE_ROWS.map((l, i) => [l, i]));
  for (const feature of features) {
    const props = feature.properties;
    const vehicles = Array.isArray(props.vehicles_involved) ? props.vehicles_involved : [];
    if (!vehicles.includes('pedestrian')) continue;
    const rowLabel = getPedestrianRow(vehicles);
    if (rowLabel === null) continue;
    const ri = indexMap[rowLabel];
    if (ri === undefined) continue;
    const sevIdx = getSeverityIndex(props);
    matrix[ri].total += 1;
    matrix[ri].segments[sevIdx].value += 1;
  }
  return matrix;
}

function buildCollisionMatrix(features: AccidentFeature[]): CollisionMatrixRow[] {
  const keys = [...COLLISION_VEHICLE_KEYS];

  const counts: Record<string, Record<string, CollisionCell>> = {};
  for (const a of keys) {
    counts[a] = {};
    for (const b of keys) {
      counts[a][b] = { count: 0, segments: buildEmptySegments() };
    }
  }

  for (const feature of features) {
    const props = feature.properties;
    const vehicles = Array.isArray(props.vehicles_involved) ? props.vehicles_involved : [];
    const present = keys.filter(k => vehicles.includes(k));
    if (present.length < 2) continue;

    const sevIdx = getSeverityIndex(props);
    for (const a of present) {
      for (const b of present) {
        if (a === b) continue;
        counts[a][b].count++;
        counts[a][b].segments[sevIdx].value++;
      }
    }
  }

  return keys.map(rowKey => ({
    rowKey,
    cells: keys.map(colKey => ({ colKey, cell: counts[rowKey][colKey] })),
  }));
}

export function useAccidentsStats(cityId: number | null, year?: number): AccidentsStatsResult {
  const [totalAccidents, setTotalAccidents] = useState(0);
  const [cyclistAccidents, setCyclistAccidents] = useState(0);
  const [pedestrianAccidents, setPedestrianAccidents] = useState(0);
  const [latestYear, setLatestYear] = useState<number | null>(null);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [cyclistVehicleMatrix, setCyclistVehicleMatrix] = useState<MatrixRow[]>([]);
  const [pedestrianVehicleMatrix, setPedestrianVehicleMatrix] = useState<MatrixRow[]>([]);
  const [epacWeatherBars, setEpacWeatherBars] = useState<{ label: string; value: number }[]>([]);
  const [collisionMatrix, setCollisionMatrix] = useState<CollisionMatrixRow[]>([]);
  const [hasAllAccidentData, setHasAllAccidentData] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cityId === null) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    const fetchAll = year != null
      ? fetchAccidents(cityId, false, year)
      : Promise.resolve(null);

    Promise.all([
      fetchAccidentsSummary(cityId, year),
      fetchAccidents(cityId, true, year),
      fetchAll,
    ])
      .then(([summary, cyclistGeojson, allGeojson]) => {
        if (cancelled) return;

        const cyclistFeatures = cyclistGeojson.features;
        const allFeatures = allGeojson?.features ?? null;

        // Cyclist matrix (always from cyclist-only data)
        const cyclistMatrix = buildCyclistMatrix(cyclistFeatures);

        // Pedestrian + collision matrices (only when year selected → allFeatures available)
        const pedestrianMatrix = allFeatures
          ? buildPedestrianMatrix(allFeatures)
          : buildEmptyMatrix(PEDESTRIAN_VEHICLE_ROWS);

        const collisionMx = allFeatures
          ? buildCollisionMatrix(allFeatures)
          : [];

        // Weather bars with EPAC split (from cyclist-only data which has has_epac)
        const bikeDry  = cyclistFeatures.filter(f => !f.properties.has_epac && !isLluvia(f.properties.weather)).length;
        const bikeWet  = cyclistFeatures.filter(f => !f.properties.has_epac &&  isLluvia(f.properties.weather)).length;
        const epacDry  = cyclistFeatures.filter(f =>  f.properties.has_epac && !isLluvia(f.properties.weather)).length;
        const epacWet  = cyclistFeatures.filter(f =>  f.properties.has_epac &&  isLluvia(f.properties.weather)).length;

        setTotalAccidents(summary.total);
        setCyclistAccidents(summary.cyclist);
        setPedestrianAccidents(summary.pedestrian);
        setLatestYear(summary.latest_year);
        setAvailableYears(summary.available_years ?? []);
        setCyclistVehicleMatrix(cyclistMatrix);
        setPedestrianVehicleMatrix(pedestrianMatrix);
        setEpacWeatherBars([
          { label: 'Bici · seco',  value: bikeDry },
          { label: 'Bici · lluvia', value: bikeWet },
          { label: 'EPAC · seco',  value: epacDry },
          { label: 'EPAC · lluvia', value: epacWet },
        ]);
        setCollisionMatrix(collisionMx);
        setHasAllAccidentData(allFeatures !== null);
        setLoading(false);
      })
      .catch(err => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Error al cargar los datos de accidentes');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [cityId, year]);

  return {
    totalAccidents,
    cyclistAccidents,
    pedestrianAccidents,
    latestYear,
    availableYears,
    cyclistVehicleMatrix,
    pedestrianVehicleMatrix,
    epacWeatherBars,
    collisionMatrix,
    hasAllAccidentData,
    loading,
    error,
  };
}
