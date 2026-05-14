import { useState, useEffect } from 'react';
import { fetchAccidents } from '../services/api';
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
  cyclistVehicleMatrix: MatrixRow[];
  pedestrianVehicleMatrix: MatrixRow[];
  epacWeatherBars: { label: string; value: number }[];
  loading: boolean;
  error: string | null;
}

type AccidentProps = AccidentFeature['properties'];

// Severity colours (Ileso / Leve / Grave / Fatal)
const SEV_COLORS = {
  ileso: '#22c55e',
  leve: '#fbbf24',
  grave: '#f97316',
  fatal: '#7f1d1d',
} as const;

function getSeverityIndex(props: AccidentProps): number {
  switch (props.severity) {
    case 'fatal':   return 3;
    case 'serious': return 2;
    case 'minor':   return 1;
    default:        return 0; // 'uninjured' or unknown
  }
}

function isLluvia(weather: string | null): boolean {
  if (!weather) return false;
  return /lluvia|rain/i.test(weather);
}

function getVehicles(props: AccidentProps): string[] {
  return Array.isArray(props.vehicles_involved) ? props.vehicles_involved : [];
}

// ── Cyclist matrix rows ──────────────────────────────────────────────────────

const CYCLIST_VEHICLE_ROWS = [
  'Coche/Furg',
  'Bus',
  'Camión/Maq',
  'Moto',
  'Caída sola',
] as const;

type CyclistRow = (typeof CYCLIST_VEHICLE_ROWS)[number];

function getCyclistRow(vehicles: string[]): CyclistRow {
  const others = vehicles.filter((v) => v !== 'bike_vmu');
  if (others.length === 0) return 'Caída sola';
  if (others.includes('bus'))   return 'Bus';
  if (others.includes('truck')) return 'Camión/Maq';
  if (others.includes('moto'))  return 'Moto';
  if (others.includes('car'))   return 'Coche/Furg';
  return 'Coche/Furg';
}

// ── Pedestrian matrix rows ───────────────────────────────────────────────────

const PEDESTRIAN_VEHICLE_ROWS = [
  'Coche/Furg',
  'Bus',
  'Camión/Maq',
  'Moto',
  'Bicicleta',
] as const;

type PedestrianRow = (typeof PEDESTRIAN_VEHICLE_ROWS)[number];

function getPedestrianRow(vehicles: string[]): PedestrianRow | null {
  const others = vehicles.filter((v) => v !== 'pedestrian');
  if (others.length === 0) return null; // pedestrian alone — skip
  if (others.includes('bike_vmu')) return 'Bicicleta';
  if (others.includes('bus'))      return 'Bus';
  if (others.includes('truck'))    return 'Camión/Maq';
  if (others.includes('moto'))     return 'Moto';
  if (others.includes('car'))      return 'Coche/Furg';
  return 'Coche/Furg';
}

// ── Matrix helpers ───────────────────────────────────────────────────────────

function buildEmptyMatrix(rowLabels: readonly string[]): MatrixRow[] {
  return rowLabels.map((label) => ({
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
    const props = feature.properties as AccidentProps;
    const vehicles = getVehicles(props);
    const sevIdx = getSeverityIndex(props);

    // Cyclist perspective
    if (vehicles.includes('bike_vmu')) {
      const rowLabel = getCyclistRow(vehicles);
      const ri = cyclistIndexMap[rowLabel];
      if (ri !== undefined) {
        cyclistMatrix[ri].total += 1;
        cyclistMatrix[ri].segments[sevIdx].value += 1;
      }
    }

    // Pedestrian perspective
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

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useAccidentsStats(cityId: number | null): AccidentsStatsResult {
  const [totalAccidents, setTotalAccidents] = useState(0);
  const [cyclistAccidents, setCyclistAccidents] = useState(0);
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

    fetchAccidents(cityId)
      .then((geojson) => {
        if (cancelled) return;

        const features = geojson.features;
        const total = features.length;

        const hasCyclist = (f: AccidentFeature): boolean =>
          getVehicles(f.properties).includes('bike_vmu');

        const cyclistCount = features.filter(hasCyclist).length;

        const { cyclistMatrix, pedestrianMatrix } = computeMatrices(features);

        // EPAC weather bars
        // TODO: requires participant-level vehicle_type to distinguish regular bikes from EPACs.
        // For now, split all cyclist accidents by weather (seco / lluvia).
        const dryCyclist = features.filter(
          (f) => hasCyclist(f) && !isLluvia((f.properties as AccidentProps).weather),
        ).length;
        const wetCyclist = features.filter(
          (f) => hasCyclist(f) && isLluvia((f.properties as AccidentProps).weather),
        ).length;

        const bars: { label: string; value: number }[] = [
          { label: 'Regular·seco',   value: dryCyclist },
          { label: 'Regular·lluvia', value: wetCyclist },
          // TODO: requires participant-level vehicle_type to distinguish EPAC
          { label: 'EPAC·seco',   value: 0 },
          { label: 'EPAC·lluvia', value: 0 },
        ];

        setTotalAccidents(total);
        setCyclistAccidents(cyclistCount);
        setCyclistVehicleMatrix(cyclistMatrix);
        setPedestrianVehicleMatrix(pedestrianMatrix);
        setEpacWeatherBars(bars);
        setLoading(false);
      })
      .catch((err) => {
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
    cyclistVehicleMatrix,
    pedestrianVehicleMatrix,
    epacWeatherBars,
    loading,
    error,
  };
}
