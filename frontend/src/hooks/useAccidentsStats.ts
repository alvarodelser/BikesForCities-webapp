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

export interface AccidentsStatsResult {
  totalAccidents: number;
  cyclistAccidents: number;
  pedestrianAccidents: number;
  latestYear: number | null;
  cyclistVehicleMatrix: MatrixRow[];
  pedestrianVehicleMatrix: MatrixRow[];
  epacWeatherBars: { label: string; value: number }[];
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

function buildEmptyMatrix(rowLabels: readonly string[]): MatrixRow[] {
  return rowLabels.map(label => ({
    label,
    total: 0,
    segments: [
      { value: 0, color: SEV_COLORS.ileso, label: 'Ileso' },
      { value: 0, color: SEV_COLORS.leve,  label: 'Leve' },
      { value: 0, color: SEV_COLORS.grave, label: 'Grave' },
      { value: 0, color: SEV_COLORS.fatal, label: 'Fatal' },
    ],
  }));
}

function computeMatrices(features: AccidentFeature[]): {
  cyclistMatrix: MatrixRow[];
  pedestrianMatrix: MatrixRow[];
} {
  const cyclistMatrix = buildEmptyMatrix(CYCLIST_VEHICLE_ROWS);
  const pedestrianMatrix = buildEmptyMatrix(PEDESTRIAN_VEHICLE_ROWS);

  const cyclistIndexMap = Object.fromEntries(
    CYCLIST_VEHICLE_ROWS.map((l, i) => [l, i] as [string, number]),
  );
  const pedestrianIndexMap = Object.fromEntries(
    PEDESTRIAN_VEHICLE_ROWS.map((l, i) => [l, i] as [string, number]),
  );

  for (const feature of features) {
    const props = feature.properties;
    const vehicles = Array.isArray(props.vehicles_involved) ? props.vehicles_involved : [];
    const sevIdx = getSeverityIndex(props);

    if (vehicles.includes('bike_vmu')) {
      const ri = cyclistIndexMap[getCyclistRow(vehicles)];
      if (ri !== undefined) {
        cyclistMatrix[ri].total += 1;
        cyclistMatrix[ri].segments[sevIdx].value += 1;
      }
    }

    if (vehicles.includes('pedestrian')) {
      const rowLabel = getPedestrianRow(vehicles);
      if (rowLabel !== null) {
        const ri = pedestrianIndexMap[rowLabel];
        if (ri !== undefined) {
          pedestrianMatrix[ri].total += 1;
          pedestrianMatrix[ri].segments[sevIdx].value += 1;
        }
      }
    }
  }

  return { cyclistMatrix, pedestrianMatrix };
}

export function useAccidentsStats(cityId: number | null): AccidentsStatsResult {
  const [totalAccidents, setTotalAccidents] = useState(0);
  const [cyclistAccidents, setCyclistAccidents] = useState(0);
  const [pedestrianAccidents, setPedestrianAccidents] = useState(0);
  const [latestYear, setLatestYear] = useState<number | null>(null);
  const [cyclistVehicleMatrix, setCyclistVehicleMatrix] = useState<MatrixRow[]>([]);
  const [pedestrianVehicleMatrix, setPedestrianVehicleMatrix] = useState<MatrixRow[]>([]);
  const [epacWeatherBars, setEpacWeatherBars] = useState<{ label: string; value: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cityId === null) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    // Totals come from the cheap summary endpoint; matrices are computed from
    // the cyclist subset (smaller payload, and the cyclist matrix is bike-only
    // by definition). Pedestrian matrix here covers bike-vs-pedestrian only.
    Promise.all([
      fetchAccidentsSummary(cityId),
      fetchAccidents(cityId, true),
    ])
      .then(([summary, geojson]) => {
        if (cancelled) return;

        const features = geojson.features;
        const { cyclistMatrix, pedestrianMatrix } = computeMatrices(features);

        const dryCyclist = features.filter(f => !isLluvia(f.properties.weather)).length;
        const wetCyclist = features.filter(f =>  isLluvia(f.properties.weather)).length;

        setTotalAccidents(summary.total);
        setCyclistAccidents(summary.cyclist);
        setPedestrianAccidents(summary.pedestrian);
        setLatestYear(summary.latest_year);
        setCyclistVehicleMatrix(cyclistMatrix);
        setPedestrianVehicleMatrix(pedestrianMatrix);
        setEpacWeatherBars([
          { label: 'Bici·seco',   value: dryCyclist },
          { label: 'Bici·lluvia', value: wetCyclist },
        ]);
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
  }, [cityId]);

  return {
    totalAccidents,
    cyclistAccidents,
    pedestrianAccidents,
    latestYear,
    cyclistVehicleMatrix,
    pedestrianVehicleMatrix,
    epacWeatherBars,
    loading,
    error,
  };
}
