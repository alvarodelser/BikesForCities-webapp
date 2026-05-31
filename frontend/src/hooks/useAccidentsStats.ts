import { useState, useEffect } from 'react';
import { fetchAccidents, fetchAccidentsSummary, fetchVehiclePairStats } from '../services/api';
import type { AccidentFeature, VehiclePairStat } from '../services/api';

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

export interface PairSev {
  accident_count: number;
  fatal: number;
  serious: number;
  minor: number;
  uninjured: number;
}

export interface CollisionMatrixCell {
  rowSev: PairSev;
  colSev: PairSev;
}

export interface CollisionMatrixRow {
  rowKey: CollisionVehicleKey;
  cells: Array<{ colKey: CollisionVehicleKey; cell: CollisionMatrixCell }>;
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

function buildPedestrianMatrixFromPairStats(pairStats: VehiclePairStat[]): MatrixRow[] {
  const matrix = buildEmptyMatrix(PEDESTRIAN_VEHICLE_ROWS);

  // Map col vehicle categories to row labels
  const colToRow: Record<string, string> = {
    car: 'Coche/Furg',
    bus: 'Bus',
    truck: 'Camión/Maq',
    moto: 'Moto',
    bike_vmu: 'Bicicleta',
  };

  for (const stat of pairStats) {
    if (stat.cat_a !== 'pedestrian') continue;
    const rowLabel = colToRow[stat.cat_b];
    if (!rowLabel) continue;
    const ri = matrix.findIndex(r => r.label === rowLabel);
    if (ri < 0) continue;
    matrix[ri].total += stat.accident_count;
    matrix[ri].segments[0].value += stat.uninjured;
    matrix[ri].segments[1].value += stat.minor;
    matrix[ri].segments[2].value += stat.serious;
    matrix[ri].segments[3].value += stat.fatal;
  }
  return matrix;
}

function emptyPairSev(): PairSev {
  return { accident_count: 0, fatal: 0, serious: 0, minor: 0, uninjured: 0 };
}

function addToPairSev(target: PairSev, src: VehiclePairStat): void {
  target.accident_count += src.accident_count;
  target.fatal += src.fatal;
  target.serious += src.serious;
  target.minor += src.minor;
  target.uninjured += src.uninjured;
}

function buildCollisionMatrix(pairStats: VehiclePairStat[]): CollisionMatrixRow[] {
  const keys = [...COLLISION_VEHICLE_KEYS];

  // Build lookup[cat_a][cat_b] = PairSev for cat_a severity in cat_a+cat_b accidents
  const lookup: Record<string, Record<string, PairSev>> = {};
  for (const k of keys) {
    lookup[k] = {};
    for (const j of keys) lookup[k][j] = emptyPairSev();
  }
  for (const stat of pairStats) {
    if (!(stat.cat_a in lookup)) continue;
    if (stat.cat_b === stat.cat_a || stat.cat_b === 'solo') {
      // Same-type accidents (incl. solo falls legacy format) → diagonal
      addToPairSev(lookup[stat.cat_a][stat.cat_a], stat);
    } else if (stat.cat_b in lookup[stat.cat_a]) {
      lookup[stat.cat_a][stat.cat_b] = {
        accident_count: stat.accident_count,
        fatal: stat.fatal,
        serious: stat.serious,
        minor: stat.minor,
        uninjured: stat.uninjured,
      };
    }
  }

  return keys.map(rowKey => ({
    rowKey,
    cells: keys.map(colKey => ({
      colKey,
      cell: {
        rowSev: lookup[rowKey][colKey],
        colSev: lookup[colKey][rowKey],
      },
    })),
  }));
}

export function useAccidentsStats(cityId: number | null, yearFrom?: number, yearTo?: number): AccidentsStatsResult {
  const [totalAccidents, setTotalAccidents] = useState(0);
  const [cyclistAccidents, setCyclistAccidents] = useState(0);
  const [pedestrianAccidents, setPedestrianAccidents] = useState(0);
  const [latestYear, setLatestYear] = useState<number | null>(null);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [cyclistVehicleMatrix, setCyclistVehicleMatrix] = useState<MatrixRow[]>([]);
  const [pedestrianVehicleMatrix, setPedestrianVehicleMatrix] = useState<MatrixRow[]>([]);
  const [epacWeatherBars, setEpacWeatherBars] = useState<{ label: string; value: number }[]>([]);
  const [collisionMatrix, setCollisionMatrix] = useState<CollisionMatrixRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cityId === null) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      fetchAccidentsSummary(cityId, yearFrom, yearTo),
      fetchAccidents(cityId, true, yearFrom, yearTo),
      fetchVehiclePairStats(cityId, yearFrom, yearTo).catch(() => [] as VehiclePairStat[]),
    ])
      .then(([summary, cyclistGeojson, pairStats]) => {
        if (cancelled) return;

        const cyclistFeatures = cyclistGeojson.features;

        const cyclistMatrix = buildCyclistMatrix(cyclistFeatures);
        const pedestrianMatrix = buildPedestrianMatrixFromPairStats(pairStats);
        const collisionMx = buildCollisionMatrix(pairStats);

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
          { label: 'Bici · seco',   value: bikeDry },
          { label: 'Bici · lluvia', value: bikeWet },
          { label: 'EPAC · seco',   value: epacDry },
          { label: 'EPAC · lluvia', value: epacWet },
        ]);
        setCollisionMatrix(collisionMx);
        setLoading(false);
      })
      .catch(err => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Error al cargar los datos de accidentes');
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [cityId, yearFrom, yearTo]);

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
    loading,
    error,
  };
}
