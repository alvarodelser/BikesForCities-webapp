import type React from 'react';
import {
    Car, Truck, Bus, Motorcycle, Bicycle, PersonSimpleWalk, Scooter, Van, Ambulance,
    Wine, Pill,
    Sun, CloudRain, CloudFog, Wind, Snowflake, CloudSun,
    ArrowRight, PersonSimpleRun, Warning,
} from '@phosphor-icons/react';

export interface VehicleIconEntry {
    icon: React.ElementType;
    label: string;
    /** Match against lower-cased vehicle_type and person_type strings. */
    match: (vehicleType: string, personType: string) => boolean;
}

// Order matters — first matching entry wins. Pedestrian check is first
// because the same row may carry an unrelated vehicle_type for context.
export const VEHICLE_ICON_MAP: VehicleIconEntry[] = [
    { icon: PersonSimpleWalk, label: 'Peatón',
      match: (_v, p) => p.includes('peato') || p.includes('peatón') },
    { icon: Bicycle,          label: 'Bicicleta',
      match: (v) => v.includes('bicicleta') || v.includes('epac') },
    { icon: Scooter,          label: 'Patinete / VMU',
      match: (v) => v.includes('vmu') || v.includes('patinete') },
    { icon: Motorcycle,       label: 'Moto / Ciclomotor',
      match: (v) => v.includes('moto') || v.includes('ciclomotor') || v.includes('cuadriciclo') },
    { icon: Van,              label: 'Furgoneta',
      match: (v) => v.includes('furgoneta') },
    { icon: Car,              label: 'Turismo',
      match: (v) => v.includes('turismo') || v.includes('todo terreno') },
    { icon: Bus,              label: 'Autobús',
      match: (v) => v.includes('autob') },
    { icon: Truck,            label: 'Camión / Maquinaria',
      match: (v) => v.includes('camión') || v.includes('camion') || v.includes('maquinaria') || v.includes('tracto') },
    { icon: Ambulance,        label: 'Ambulancia',
      match: (v) => v.includes('ambulancia') },
];

export const DEFAULT_VEHICLE_ENTRY: VehicleIconEntry = {
    icon: Car,
    label: 'Vehículo',
    match: () => true,
};

export function resolveVehicleIcon(
    vehicleType: string | null,
    personType: string | null,
): VehicleIconEntry {
    const v = (vehicleType || '').toLowerCase();
    const p = (personType || '').toLowerCase();
    return VEHICLE_ICON_MAP.find(e => e.match(v, p)) ?? DEFAULT_VEHICLE_ENTRY;
}

// Superscript pip icons for substance flags on participants.
export const ALCOHOL_ICON: React.ElementType = Wine;
export const DRUGS_ICON: React.ElementType = Pill;

// ── Weather icons ─────────────────────────────────────────────────────────────

export interface WeatherIconEntry {
    icon: React.ElementType;
    label: string;
    color: string;
    match: (weather: string) => boolean;
}

export const WEATHER_ICON_MAP: WeatherIconEntry[] = [
    { icon: Sun,       label: 'Despejado', color: '#f59e0b',
      match: (w) => /despejado|claro/i.test(w) },
    { icon: CloudSun,  label: 'Nublado',   color: '#94a3b8',
      match: (w) => /nublado/i.test(w) },
    { icon: CloudRain, label: 'Lluvia',    color: '#3b82f6',
      match: (w) => /lluvia|rain|mojada/i.test(w) },
    { icon: CloudFog,  label: 'Niebla',    color: '#a8a29e',
      match: (w) => /niebla|fog/i.test(w) },
    { icon: Wind,      label: 'Viento',    color: '#6366f1',
      match: (w) => /viento|wind/i.test(w) },
    { icon: Snowflake, label: 'Nieve / Hielo', color: '#7dd3fc',
      match: (w) => /nieve|hielo|granizo|snow|ice/i.test(w) },
];

export const DEFAULT_WEATHER_ENTRY: WeatherIconEntry = {
    icon: Sun, label: 'Otro', color: '#9ca3af',
    match: () => true,
};

export function resolveWeatherIcon(weather: string | null): WeatherIconEntry {
    if (!weather) return DEFAULT_WEATHER_ENTRY;
    return WEATHER_ICON_MAP.find(e => e.match(weather)) ?? DEFAULT_WEATHER_ENTRY;
}

// ── Accident type icons ───────────────────────────────────────────────────────

export interface AccidentTypeIconEntry {
    icon: React.ElementType;
    label: string;
    color: string;
    match: (accidentType: string) => boolean;
}

// DB stores normalized accident types: Colisión, Alcance, Caída, Atropello a persona, Otro
export const ACCIDENT_TYPE_ICON_MAP: AccidentTypeIconEntry[] = [
    { icon: PersonSimpleRun,  label: 'Atropello', color: '#dc2626',
      match: (t) => t.includes('atropello') },
    { icon: ArrowRight,       label: 'Alcance',   color: '#f59e0b',
      match: (t) => t.includes('alcance') },
    { icon: Car,              label: 'Colisión',  color: '#6366f1',
      match: (t) => t.includes('colisión') || t.includes('colision') },
    { icon: Warning,          label: 'Caída',     color: '#ca8a04',
      match: (t) => t.includes('caída') || t.includes('caida') },
];

export const DEFAULT_ACCIDENT_TYPE_ENTRY: AccidentTypeIconEntry = {
    icon: Warning, label: 'Otro', color: '#9ca3af',
    match: () => true,
};

export function resolveAccidentTypeIcon(accidentType: string | null): AccidentTypeIconEntry {
    if (!accidentType) return DEFAULT_ACCIDENT_TYPE_ENTRY;
    const t = accidentType.toLowerCase();
    return ACCIDENT_TYPE_ICON_MAP.find(e => e.match(t)) ?? DEFAULT_ACCIDENT_TYPE_ENTRY;
}
