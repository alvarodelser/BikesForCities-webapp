import { useEffect, useRef, useState } from 'react';
import { X, Maximize2, Minus } from 'lucide-react';
import type { SelectionDetail } from '../../../types/selection';

export type { SelectionDetail };
export const PANEL_WIDTH = '240px';

interface SelectionPanelProps {
    colorScheme?: { primary: string; secondary: string; accent: string; light: string };
    /** Controlled minimized state */
    minimized?: boolean;
    onMinimizeChange?: (minimized: boolean) => void;
    /** Notifies parent when a selection appears/disappears (used when internal state is active) */
    onSelectionChange?: (hasSelection: boolean) => void;
    /** Optional selection data passed from parent to ensure persistence when unmounting */
    selectionOverride?: SelectionDetail | null;
    /** Extra content rendered at the bottom of the expanded panel */
    extraContent?: React.ReactNode;
}

export default function SelectionPanel({
    colorScheme,
    minimized: controlledMinimized,
    onMinimizeChange,
    onSelectionChange,
    selectionOverride,
    extraContent,
}: SelectionPanelProps) {
    const [internalSelection, setInternalSelection] = useState<SelectionDetail | null>(null);
    const [internalMinimized, setInternalMinimized] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);

    // Use parent-provided selection or internal state
    const selection = selectionOverride !== undefined ? selectionOverride : internalSelection;

    // Use controlled or internal minimized state
    const isMinimized = controlledMinimized !== undefined ? controlledMinimized : internalMinimized;
    const setMinimized = (val: boolean) => {
        if (onMinimizeChange) onMinimizeChange(val);
        else setInternalMinimized(val);
    };

    // Internal listener (only if selectionOverride is not provided)
    useEffect(() => {
        if (selectionOverride !== undefined) return;
        const handler = (e: Event) => {
            const detail = (e as CustomEvent<SelectionDetail | null>).detail;
            setInternalSelection(detail);
            onSelectionChange?.(!!detail);
            if (detail) setMinimized(false);
        };
        window.addEventListener('map-selection', handler);
        return () => window.removeEventListener('map-selection', handler);
    }, [onSelectionChange, selectionOverride]);

    if (!selection) return null;

    const accent = colorScheme?.primary ?? '#027A76';
    const typeLabel: Record<string, string> = {
        station: 'Estación',
        edge: 'Tramo',
        reach: 'Alcance',
    };

    const glassStyle: React.CSSProperties = {
        background: 'rgba(255,255,255,0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.5)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.7)',
        width: PANEL_WIDTH,
    };

    const RoundBtn = ({
        onClick, icon: Icon, label, danger,
    }: { onClick: (e: React.MouseEvent) => void; icon: React.ElementType; label: string; danger?: boolean }) => (
        <button
            onClick={onClick}
            title={label}
            className={`flex items-center justify-center w-6 h-6 rounded-full transition-all duration-200 border ${
                danger
                    ? 'bg-red-50/50 border-red-100 text-red-400 hover:bg-red-100 hover:text-red-600'
                    : 'bg-white/50 border-black/5 text-black/35 hover:bg-black/5 hover:text-black/60'
            }`}
        >
            <Icon className="w-3 h-3" />
        </button>
    );

    return (
        <div ref={rootRef} className="mb-2 transition-all duration-300 ease-in-out" style={{ width: PANEL_WIDTH }}>
            <div className="rounded-2xl overflow-hidden" style={glassStyle}>
                {/* Header */}
                <div className={`flex items-center justify-between px-3 h-10 select-none ${isMinimized ? '' : 'border-b border-black/5'}`}>
                    <div className="flex items-center gap-2 min-w-0">
                        <span
                            className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full shrink-0"
                            style={{ backgroundColor: `${accent}18`, color: accent }}
                        >
                            {typeLabel[selection.type] ?? selection.type}
                        </span>
                        <span className="text-[11px] font-bold text-black/75 truncate leading-tight">
                            {selection.title}
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        {isMinimized
                            ? <RoundBtn onClick={() => setMinimized(false)} icon={Maximize2} label="Expandir" />
                            : <RoundBtn onClick={() => setMinimized(true)} icon={Minus} label="Minimizar" />
                        }
                        <RoundBtn
                            danger
                            icon={X}
                            label="Cerrar selección"
                            onClick={(e) => {
                                e.stopPropagation();
                                window.dispatchEvent(new CustomEvent('map-selection-close'));
                                window.dispatchEvent(new CustomEvent('map-selection', { detail: null }));
                                setInternalSelection(null);
                                onSelectionChange?.(false);
                            }}
                        />
                    </div>
                </div>

                {/* Body */}
                {!isMinimized && (
                    <div className="px-3 py-2.5 flex flex-col gap-1.5">
                        {selection.subtitle && (
                            <p className="text-[10px] text-black/40 leading-tight">{selection.subtitle}</p>
                        )}
                        {selection.badge && (
                            <div className="mt-0.5">
                                <span
                                    className="inline-block px-2.5 py-1 rounded-md text-[13px] font-black shadow-sm"
                                    style={{
                                        backgroundColor: selection.badge.color,
                                        color: selection.badge.textColor ?? 'white',
                                    }}
                                >
                                    {selection.badge.text}
                                </span>
                            </div>
                        )}
                        {selection.loading && (
                            <div className="flex items-center gap-2 mt-0.5">
                                <div
                                    className="w-3 h-3 rounded-full border-2 border-t-transparent animate-spin"
                                    style={{ borderColor: `${accent}40`, borderTopColor: accent }}
                                />
                                <span className="text-[10px] text-black/40">Calculando…</span>
                            </div>
                        )}
                        {selection.rows && selection.rows.length > 0 && (
                            <div className="flex flex-col gap-1 mt-0.5">
                                {selection.rows.map(row => (
                                    <div key={row.label} className="flex items-baseline justify-between gap-3">
                                        <span className="text-[9px] font-semibold text-black/35 uppercase tracking-wide">
                                            {row.label}
                                        </span>
                                        <span className="text-[11px] font-bold" style={{ color: row.accent ?? 'rgba(0,0,0,0.7)' }}>
                                            {row.value}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                        {selection.periodOptions && selection.periodOptions.length > 0 && (
                            <div className="flex gap-1 mt-2">
                                {selection.periodOptions.map(opt => (
                                    <button
                                        key={opt.id}
                                        onClick={() => selection.onPeriodChange?.(opt.id)}
                                        className={`text-[9px] font-bold px-2 py-1 rounded transition-all flex-1 ${
                                            selection.activePeriod === opt.id
                                                ? 'bg-black/20 text-black/90'
                                                : 'bg-black/5 text-black/50 hover:bg-black/10'
                                        }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        )}
                        {selection.submodeOptions && selection.submodeOptions.length > 0 && (
                            <div className="flex gap-1 mt-2">
                                {selection.submodeOptions.map(opt => (
                                    <button
                                        key={opt.id}
                                        onClick={() => selection.onSubmodeChange?.(opt.id)}
                                        className={`text-[9px] font-bold px-2 py-1 rounded transition-all flex-1 ${
                                            selection.activeSubmode === opt.id
                                                ? 'bg-black/20 text-black/90'
                                                : 'bg-black/5 text-black/50 hover:bg-black/10'
                                        }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        )}
                        {selection.chart && (
                            <div className="mt-2" ref={el => {
                                if (el) {
                                    // Clear previous chart
                                    el.innerHTML = '';
                                    // Append new chart (preserves event listeners)
                                    if (selection.chart) {
                                        el.appendChild(selection.chart);
                                    }
                                }
                            }} />
                        )}
                        {extraContent}
                    </div>
                )}
            </div>
        </div>
    );
}
