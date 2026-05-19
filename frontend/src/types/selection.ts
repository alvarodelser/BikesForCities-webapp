import type { LucideIcon } from 'lucide-react';

export interface SelectionParticipant {
    icon: LucideIcon;
    severityColor: string;
    label: string;
    alcoholPositive?: boolean;
    drugsPositive?: boolean;
}

export interface SelectionColormap {
    q5: number;
    q50: number;
    q95: number;
    value: number | null;
}

export interface SelectionRouteProgress {
    loaded: number;
    total: number;
    onStop?: () => void;
}

// Shared type for the SelectionPanel event contract
export interface SelectionDetail {
    type: 'station' | 'edge' | 'reach' | 'accident';
    title: string;
    subtitle?: string;
    rows?: Array<{ label: string; value: string; accent?: string }>;
    /** Two stats shown side-by-side, each as { label, value, color? } */
    pairRows?: Array<[{ label: string; value: string; color?: string }, { label: string; value: string; color?: string }]>;
    badge?: { text: string; color: string; textColor?: string };
    loading?: boolean;
    chart?: HTMLElement | null;
    colormap?: SelectionColormap;
    routeProgress?: SelectionRouteProgress;
    periodOptions?: Array<{ id: string; label: string }>;
    activePeriod?: string;
    onPeriodChange?: (period: string) => void;
    submodeOptions?: Array<{ id: string; label: string }>;
    activeSubmode?: string;
    onSubmodeChange?: (submode: string) => void;
    participants?: SelectionParticipant[];
}
