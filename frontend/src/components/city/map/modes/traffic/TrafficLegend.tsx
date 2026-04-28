import { useEffect, useState } from 'react';
import { useThresholds } from '../../ThresholdsContext';
import { useMapState } from '../../../../../hooks/useMapState';

export default function TrafficLegend() {
    const { thresholds } = useThresholds();
    const { submode } = useMapState();
    const activeSubmode = submode || 'traces';

    // Hide colormap when a selection (edge click) is active — the panel takes over
    const [hasSelection, setHasSelection] = useState(false);
    useEffect(() => {
        const handler = (e: Event) => setHasSelection(!!(e as CustomEvent).detail);
        window.addEventListener('map-selection', handler);
        return () => window.removeEventListener('map-selection', handler);
    }, []);

    // When a selection is active, legend only shows the hint (colormap hidden)
    if (hasSelection) {
        return (
            <p className="text-[9px] text-black/35 italic leading-tight">
                {activeSubmode === 'heatmap' ? 'Calor por densidad' : 'Viajes/mes · tramo seleccionado'}
            </p>
        );
    }

    return (
        <div className="flex flex-col gap-2 w-full">
            <p className="text-[9px] text-black/35 italic leading-tight">
                {activeSubmode === 'heatmap' ? 'Calor al clic' : 'Viajes/mes · clic en tramo'}
            </p>

            {thresholds == null ? (
                <div className="text-[10px] text-black/30 italic text-center py-2">Sin datos de tráfico</div>
            ) : (
                <div className="flex gap-3 h-32 my-1 relative">
                    <div className="flex flex-col w-3.5 h-full rounded-full overflow-hidden border border-black/10 shadow-sm">
                        <div
                            className="flex-1 w-full"
                            style={{ background: 'linear-gradient(to top, #edf8e9, #74c476, #005a32)' }}
                        />
                    </div>
                    <div className="flex-1 relative h-full text-[10px] font-bold text-black/60 tracking-tight">
                        <div className="absolute top-0 flex items-center w-full h-0">
                            <div className="flex items-center gap-1 w-full">
                                <div className="w-2 h-[1.5px] bg-black/10" />
                                <span className="bg-white/90 px-1 py-0.5 rounded shadow-sm border border-black/5 whitespace-nowrap text-[9px]">
                                    {Math.round(thresholds.q95)} v/m (P95+)
                                </span>
                            </div>
                        </div>
                        <div className="absolute top-1/2 flex items-center w-full h-0 -translate-y-1/2">
                            <div className="flex items-center gap-1.5 w-full">
                                <div className="w-3 h-[1.5px] bg-black/20" />
                                <span className="px-1.5 py-0.5 rounded-md border shadow-sm backdrop-blur-md whitespace-nowrap bg-green-100/90 text-black/80 border-green-200/60 text-[9px]">
                                    {Math.round(thresholds.q50)} v/m med.
                                </span>
                            </div>
                        </div>
                        <div className="absolute bottom-0 flex items-center w-full h-0">
                            <div className="flex items-center gap-1 w-full">
                                <div className="w-2 h-[1.5px] bg-black/10" />
                                <span className="bg-white/90 px-1 py-0.5 rounded shadow-sm border border-black/5 whitespace-nowrap text-[9px]">
                                    {Math.round(thresholds.q5)} v/m (P5)
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            <div className="text-[8px] text-black/25 italic">&lt; P5 no representado</div>
        </div>
    );
}
