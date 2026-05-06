export interface SelectionParticipant {
    emoji: string;
    severityColor: string;
    label: string;
}

// Shared type for the SelectionPanel event contract
export interface SelectionDetail {
    type: 'station' | 'edge' | 'reach' | 'accident';
    title: string;
    subtitle?: string;
    rows?: Array<{ label: string; value: string; accent?: string }>;
    badge?: { text: string; color: string; textColor?: string };
    loading?: boolean;
    chart?: HTMLElement | null;
    periodOptions?: Array<{ id: string; label: string }>;
    activePeriod?: string;
    onPeriodChange?: (period: string) => void;
    submodeOptions?: Array<{ id: string; label: string }>;
    activeSubmode?: string;
    onSubmodeChange?: (submode: string) => void;
    participants?: SelectionParticipant[];
}
