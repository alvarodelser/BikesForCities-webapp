import {
    Bike, Car, Truck, Bus, Ambulance, PersonStanding, Gauge, Activity,
    Wine, Pill,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface VehicleIconEntry {
    icon: LucideIcon;
    label: string;
    /** Match against lower-cased vehicle_type and person_type strings. */
    match: (vehicleType: string, personType: string) => boolean;
}

// Order matters — first matching entry wins. Pedestrian check is first
// because the same row may carry an unrelated vehicle_type for context.
export const VEHICLE_ICON_MAP: VehicleIconEntry[] = [
    { icon: PersonStanding, label: 'Peatón',
      match: (_v, p) => p.includes('peato') || p.includes('peatón') },
    { icon: Bike,           label: 'Bicicleta',
      match: (v) => v.includes('bicicleta') || v.includes('epac') },
    { icon: Activity,       label: 'Patinete / VMU',
      match: (v) => v.includes('vmu') || v.includes('patinete') },
    { icon: Gauge,          label: 'Moto / Ciclomotor',
      match: (v) => v.includes('moto') || v.includes('ciclomotor') || v.includes('cuadriciclo') },
    { icon: Truck,          label: 'Furgoneta',
      match: (v) => v.includes('furgoneta') },
    { icon: Car,            label: 'Turismo',
      match: (v) => v.includes('turismo') || v.includes('todo terreno') },
    { icon: Bus,            label: 'Autobús',
      match: (v) => v.includes('autob') },
    { icon: Truck,          label: 'Camión / Maquinaria',
      match: (v) => v.includes('camión') || v.includes('camion') || v.includes('maquinaria') || v.includes('tracto') },
    { icon: Ambulance,      label: 'Ambulancia',
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
export const ALCOHOL_ICON: LucideIcon = Wine;
export const DRUGS_ICON: LucideIcon = Pill;
