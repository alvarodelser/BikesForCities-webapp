// Shared type for the SelectionPanel event contract
export interface SelectionDetail {
    type: 'station' | 'edge' | 'reach';
    title: string;
    subtitle?: string;
    rows?: Array<{ label: string; value: string; accent?: string }>;
    badge?: { text: string; color: string; textColor?: string };
    loading?: boolean;
    chart?: HTMLElement | null;
}
