import { useEffect, useRef, useState } from 'react';
import { List, Maximize2, Minus, ChevronDown } from 'lucide-react';
import { MODES } from './modes';
import { useMapState } from '../../../hooks/useMapState';
import { useViewport } from '../../../hooks/useViewport';
import { commonLegendItems } from './modes/common';
import SelectionPanel, { PANEL_WIDTH } from './SelectionPanel';
import type { SelectionDetail } from '../../../types/selection';

const SUBMODE_LABELS: Record<string, string> = {
    trips:    'Viajes',
    downtime: 'Tiempo',
    reach:    'Alcance',
    traces:   'Trayecto',
    heatmap:  'Calor',
};

interface CityLegendProps {
    colorScheme?: { primary: string; secondary: string; accent: string; light: string };
    bottomOffset?: number;
    defaultOpen?: boolean;
}

export default function CityLegend({ colorScheme, bottomOffset = 0, defaultOpen }: CityLegendProps) {
    const { mode, submode, setSubmode } = useMapState();
    const { isMobile } = useViewport();

    const [legendOpen, setLegendOpen] = useState(() => {
        if (defaultOpen !== undefined) return defaultOpen;
        const saved = localStorage.getItem('bfc_legend_open');
        return saved !== null ? saved === 'true' : true;
    });

    // Selection state is lifted here so it persists even when SelectionPanel is hidden
    const [selection, setSelection] = useState<SelectionDetail | null>(null);
    const [selectionMinimized, setSelectionMinimized] = useState(false);
    const [submodeOpen, setSubmodeOpen] = useState(false);

    const rootRef = useRef<HTMLDivElement>(null);
    const submodeRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        localStorage.setItem('bfc_legend_open', String(legendOpen));
    }, [legendOpen]);

    // Listen for map selections — lifted so state survives panel unmount
    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent<SelectionDetail | null>).detail;
            setSelection(detail);
            if (detail) setSelectionMinimized(false);
        };
        window.addEventListener('map-selection', handler);
        return () => window.removeEventListener('map-selection', handler);
    }, []);

    // Close submode dropdown on outside click
    useEffect(() => {
        if (!submodeOpen) return;
        const handleClick = (e: MouseEvent) => {
            if (submodeRef.current && !submodeRef.current.contains(e.target as Node)) {
                setSubmodeOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [submodeOpen]);

    const config = MODES[mode];
    if (!config) return null;

    const LegendContent = config.legend;
    const submodes = config.submodes;
    const activeSubmode = submode || config.defaultSubmode;
    const hasSubmodes = submodes.length > 0;
    const hasSelection = !!selection;

    const accent = colorScheme?.primary ?? '#027A76';
    const accentBg = colorScheme ? `${colorScheme.primary}15` : 'rgba(0,0,0,0.07)';

    const glassStyle: React.CSSProperties = {
        background: 'rgba(255,255,255,0.85)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,255,255,0.55)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.7)',
        width: PANEL_WIDTH,
    };

    const RoundBtn = ({ onClick, icon: Icon, label }: {
        onClick: () => void; icon: React.ElementType; label: string;
    }) => (
        <button
            onClick={onClick}
            title={label}
            className="flex items-center justify-center w-6 h-6 rounded-full border bg-white/50 border-black/5 text-black/35 hover:bg-black/5 hover:text-black/60 transition-all duration-200"
        >
            <Icon className="w-3 h-3" />
        </button>
    );

    // Both collapsed → show round icon only
    const bothCollapsed = !legendOpen && (!hasSelection || selectionMinimized);

    const commonItems = commonLegendItems
        .filter(item => !(mode === 'stations' && item.label === 'Límite Municipal'));

    return (
        <div
            ref={rootRef}
            className={`absolute z-20 flex flex-col items-start ${isMobile ? 'left-4' : 'bottom-6 left-6'}`}
            style={isMobile ? { bottom: `${bottomOffset + 12}px` } : {}}
        >
            {/* ─── SelectionPanel — hidden (not unmounted) when bothCollapsed ───── */}
            <div style={{ display: bothCollapsed || !hasSelection ? 'none' : undefined }}>
                <SelectionPanel
                    selectionOverride={selection}
                    colorScheme={colorScheme}
                    minimized={selectionMinimized}
                    onMinimizeChange={setSelectionMinimized}
                />
            </div>

            {/* ─── Traffic settings panel: shown when traffic + NO selection ──── */}
            {/* REMOVED: Traffic selectors only appear in SelectionPanel on edge click */}

            {/* ─── Legend Card — NEVER unmounts (preserves useEffect state) ────── */}
            {/* Uses display:none instead of conditional rendering to keep LegendContent */}
            {/* mounted at all times, preventing cleanup effects from running */}
            <div
                className="rounded-2xl relative"  // NO overflow-hidden here — it clips the dropdown!
                style={{
                    ...glassStyle,
                    display: bothCollapsed ? 'none' : undefined,
                }}
            >
                {/* Header */}
                <div
                    className={`flex items-center justify-between px-3 h-10 select-none ${legendOpen ? 'border-b border-black/5' : ''}`}
                    style={{ borderRadius: legendOpen ? '1rem 1rem 0 0' : '1rem' }}
                >
                    <div className="flex flex-col justify-center min-w-0">
                        <span className="text-[10px] font-black text-black/35 uppercase tracking-widest leading-none">
                            Leyenda
                        </span>

                        {legendOpen && hasSubmodes && (
                            <div className="flex items-center gap-1 mt-0.5" ref={submodeRef}>
                                <span className="text-[9px] font-semibold text-black/40">Modo</span>
                                <div className="relative">
                                    {/* Pill button */}
                                    <button
                                        onClick={() => setSubmodeOpen(v => !v)}
                                        className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold transition-all active:scale-95"
                                        style={{ backgroundColor: accentBg, color: accent }}
                                    >
                                        {SUBMODE_LABELS[activeSubmode] ?? activeSubmode}
                                        <ChevronDown
                                            className={`w-2.5 h-2.5 transition-transform duration-200 ${submodeOpen ? 'rotate-180' : ''}`}
                                        />
                                    </button>

                                    {/* Dropdown — opens ABOVE the pill, not clipped because outer card has no overflow-hidden */}
                                    {submodeOpen && (
                                        <div
                                            className="absolute bottom-full mb-1.5 left-0 z-[200] min-w-[120px]"
                                            style={{
                                                borderRadius: '12px',
                                                overflow: 'hidden',
                                                background: 'rgba(255,255,255,0.97)',
                                                backdropFilter: 'blur(28px)',
                                                WebkitBackdropFilter: 'blur(28px)',
                                                border: '1px solid rgba(0,0,0,0.1)',
                                                boxShadow: '0 16px 48px rgba(0,0,0,0.20)',
                                            }}
                                        >
                                            {submodes.map(s => (
                                                <button
                                                    key={s}
                                                    onClick={() => { setSubmode(s); setSubmodeOpen(false); }}
                                                    className="w-full text-left px-3 py-2.5 text-[11px] font-bold transition-colors hover:bg-black/5"
                                                    style={{
                                                        color: activeSubmode === s ? accent : 'rgba(0,0,0,0.65)',
                                                        background: activeSubmode === s ? accentBg : 'transparent',
                                                    }}
                                                >
                                                    {SUBMODE_LABELS[s] ?? s}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="shrink-0 ml-2">
                        {legendOpen
                            ? <RoundBtn onClick={() => setLegendOpen(false)} icon={Minus} label="Minimizar" />
                            : <RoundBtn onClick={() => setLegendOpen(true)} icon={Maximize2} label="Expandir" />
                        }
                    </div>
                </div>

                {/* Collapsible body — overflow-hidden ONLY here, not on outer card */}
                <div
                    className="overflow-hidden transition-all duration-300"
                    style={{
                        maxHeight: legendOpen ? (isMobile ? '32vh' : '52vh') : '0px',
                        opacity: legendOpen ? 1 : 0,
                        borderRadius: '0 0 1rem 1rem',
                    }}
                >
                    <div
                        className="px-3 py-3 overflow-y-auto"
                        style={{
                            maxHeight: isMobile ? '32vh' : '52vh',
                            scrollbarWidth: 'thin',
                            scrollbarColor: 'rgba(0,0,0,0.1) transparent',
                        }}
                    >
                        <div className="flex flex-col gap-y-2">
                            {/* LegendContent is ALWAYS in DOM — uses CSS collapse, not unmount */}
                            <LegendContent />
                            {commonItems.length > 0 && (
                                <div className="flex flex-col gap-y-1.5 pt-1.5 border-t border-black/5">
                                    {commonItems.map(item => (
                                        <div key={item.label} className="flex items-center gap-2">
                                            {item.type === 'square' && (
                                                <div className="w-2.5 h-2.5 rounded-sm shadow-sm shrink-0" style={{ backgroundColor: item.color }} />
                                            )}
                                            {item.type === 'dashed' && (
                                                <div className="w-3.5 h-0 border-t-2 border-dashed shrink-0" style={{ borderColor: item.color }} />
                                            )}
                                            <span className="text-[10px] font-semibold text-black/45">{item.label}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ─── Floating round icon — when both collapsed ────────────────── */}
            <button
                onClick={() => {
                    setLegendOpen(true);
                    if (hasSelection) setSelectionMinimized(false);
                }}
                className={`
                    flex items-center justify-center rounded-full transition-all duration-400
                    ${bothCollapsed ? 'scale-100 opacity-100 shadow-2xl hover:scale-110 active:scale-95' : 'scale-0 opacity-0 pointer-events-none absolute'}
                `}
                style={{ ...glassStyle, width: '48px', height: '48px', color: accent }}
            >
                <List className="w-5 h-5" />
            </button>
        </div>
    );
}
