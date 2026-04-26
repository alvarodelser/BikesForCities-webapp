import { useEffect, useRef, useState } from 'react';
import { List, X } from 'lucide-react';
import { MODES } from './modes';
import { useMapState } from '../../../hooks/useMapState';
import { useViewport } from '../../../hooks/useViewport';
import { commonLegendItems } from './modes/common';

/**
 * Thin shell: resolves the active mode from URL, renders the matching Legend
 * component, and appends universal map legend items below it.
 *
 * On mobile, collapses to an icon-button with a glass popover to save space.
 */
interface CityLegendProps {
    colorScheme?: { primary: string; secondary: string; accent: string; light: string };
    bottomOffset?: number;
    defaultOpen?: boolean;
}

export default function CityLegend({ colorScheme, bottomOffset = 0, defaultOpen }: CityLegendProps) {
    const { mode } = useMapState();
    const { isMobile } = useViewport();
    const [open, setOpen] = useState(() => {
        // If defaultOpen is explicitly provided (e.g. from props), use it.
        // Otherwise, fallback to localStorage or true.
        if (defaultOpen !== undefined) return defaultOpen;
        const saved = localStorage.getItem('bfc_legend_open');
        return saved !== null ? saved === 'true' : true;
    });
    const rootRef = useRef<HTMLDivElement>(null);

    // Persist state
    useEffect(() => {
        localStorage.setItem('bfc_legend_open', String(open));
    }, [open]);

    // Close on outside click when open on mobile
    useEffect(() => {
        if (!isMobile || !open) return;
        function handleClick(e: MouseEvent) {
            if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [isMobile, open]);

    const config = MODES[mode];
    if (!config) return null;

    const Legend = config.legend;

    const legendContent = (
        <div className="flex flex-col gap-y-2.5">
            <Legend />
            {commonLegendItems
                .filter(item => !(mode === 'stations' && item.label === 'Límite Municipal'))
                .map(item => (
                    <div key={item.label} className="flex items-center gap-2">
                        {item.type === 'square' && (
                            <div className="w-3 h-3 rounded-sm shadow-sm" style={{ backgroundColor: item.color }} />
                        )}
                        {item.type === 'dashed' && (
                            <div className="w-4 h-0 border-t-2 border-dashed shadow-sm" style={{ borderColor: item.color }} />
                        )}
                        <span className="text-xs font-semibold text-black/60">{item.label}</span>
                    </div>
                ))}
        </div>
    );

    return (
        <div 
            ref={rootRef} 
            className={`absolute ${isMobile ? 'left-6' : 'bottom-8 left-8'} z-20`}
            style={isMobile ? { bottom: `${bottomOffset + 12}px` } : {}}
        >
            {/* Legend Content Box */}
            <div 
                className={`
                    transition-all duration-300 origin-bottom-left
                    ${open ? 'scale-100 opacity-100 translate-y-0' : 'scale-75 opacity-0 pointer-events-none translate-y-4 absolute'}
                    ${isMobile ? 'mb-2 max-h-[40vh] w-[240px]' : 'mb-3 min-w-[200px]'} 
                    overflow-y-auto rounded-2xl bg-white/90 backdrop-blur-sm border border-black/10 shadow-xl p-4
                `}
            >
                <div className="flex items-center justify-between mb-3 border-b border-black/5 pb-1">
                    <span className="text-sm font-bold text-black uppercase tracking-wider text-[11px] font-black opacity-40">Leyenda</span>
                    <button
                        onClick={() => setOpen(false)}
                        aria-label="Cerrar leyenda"
                        className="p-1 rounded hover:bg-black/5 transition-colors"
                    >
                        <X className="w-4 h-4 text-black/60" />
                    </button>
                </div>
                {legendContent}
            </div>

            {/* Toggle Button */}
            <button
                onClick={() => setOpen(true)}
                aria-label="Mostrar leyenda"
                aria-expanded={open}
                className={`
                    p-3 rounded-full backdrop-blur-sm transition-all duration-300 transform 
                    ${open ? 'scale-0 opacity-0 pointer-events-none absolute' : 'scale-100 opacity-100 shadow-xl'}
                    hover:scale-110
                `}
                style={{
                    backgroundColor: colorScheme ? `${colorScheme.accent}20` : 'rgba(255,255,255,0.2)',
                    color: colorScheme ? colorScheme.secondary : '#000',
                    border: colorScheme ? `1px solid ${colorScheme.accent}60` : '1px solid rgba(0,0,0,0.1)',
                }}
            >
                <List className="w-5 h-5" />
            </button>
        </div>
    );
}
