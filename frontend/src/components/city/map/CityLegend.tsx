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
export default function CityLegend() {
    const { mode } = useMapState();
    const { isMobile } = useViewport();
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);

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

    if (isMobile) {
        return (
            <div ref={rootRef} className="absolute bottom-3 left-3 z-20">
                {open && (
                    <div className="mb-2 max-h-[40vh] w-[240px] overflow-y-auto rounded-2xl bg-white/90 backdrop-blur-sm border border-black/10 shadow-xl p-3">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-bold text-black">Leyenda</span>
                            <button
                                onClick={() => setOpen(false)}
                                aria-label="Cerrar leyenda"
                                className="p-1 rounded hover:bg-black/5"
                            >
                                <X className="w-4 h-4 text-black/60" />
                            </button>
                        </div>
                        {legendContent}
                    </div>
                )}
                <button
                    onClick={() => setOpen(v => !v)}
                    aria-label={open ? 'Ocultar leyenda' : 'Mostrar leyenda'}
                    aria-expanded={open}
                    className="h-10 w-10 rounded-full bg-white/90 backdrop-blur-sm border border-black/10 shadow-xl flex items-center justify-center"
                >
                    <List className="w-4 h-4 text-black/70" />
                </button>
            </div>
        );
    }

    return (
        <div className="absolute bottom-4 left-4 z-20">
            <div className="bg-white/90 backdrop-blur-sm border border-black/10 shadow-xl rounded-2xl p-4 min-w-[200px]">
                <h3 className="text-black font-bold mb-3 text-sm border-b border-black/5 pb-1">Leyenda</h3>
                {legendContent}
            </div>
        </div>
    );
}
