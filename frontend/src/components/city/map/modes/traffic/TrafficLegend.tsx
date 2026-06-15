import { useEffect, useState } from 'react';
import { useThresholds } from '../../ThresholdsContext';
import { useMapState } from '../../../../../hooks/useMapState';

export default function TrafficLegend() {
    const { thresholds } = useThresholds();
    const { submode } = useMapState();

    const [hasSelection, setHasSelection] = useState(false);
    const [selectedHex, setSelectedHex] = useState<string | null>(null);
    const [activeSubmode, setActiveSubmode] = useState<string | null>(null);

    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            setHasSelection(!!detail);
            setActiveSubmode(detail?.activeSubmode ?? null);
        };
        window.addEventListener('map-selection', handler);
        return () => window.removeEventListener('map-selection', handler);
    }, []);

    useEffect(() => {
        const handler = (e: Event) => {
            const hex = (e as CustomEvent<{ hex: string | null }>).detail?.hex ?? null;
            setSelectedHex(hex);
        };
        window.addEventListener('trips-hex-selected', handler);
        return () => window.removeEventListener('trips-hex-selected', handler);
    }, []);

    if (submode === 'od') {
        return (
            <div className="flex flex-col gap-2 w-full">
                {!selectedHex ? (
                    <>
                        <div className="flex items-center gap-2">
                            <span className="text-[14px] leading-none text-black/30">⬡</span>
                            <span className="text-[10px] font-semibold text-black/55">Región</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-[2px] rounded-full" style={{ backgroundColor: '#7c3aed', opacity: 0.65 }} />
                            <span className="text-[10px] font-semibold text-black/55">Flujo de viajes</span>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="flex items-center gap-2">
                            <span className="text-[14px] leading-none" style={{ color: 'rgba(255,255,255,0.7)' }}>⬡</span>
                            <span className="text-[10px] font-semibold text-black/55">Región seleccionada</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-[2px] rounded-full" style={{ backgroundColor: '#3b82f6', opacity: 0.85 }} />
                            <span className="text-[10px] font-semibold text-black/55">Flujos de entrada</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-[2px] rounded-full" style={{ backgroundColor: '#f59e0b', opacity: 0.85 }} />
                            <span className="text-[10px] font-semibold text-black/55">Flujos de salida</span>
                        </div>
                    </>
                )}
            </div>
        );
    }

    // Rutas submode
    return (
        <div className="flex flex-col gap-2 w-full">
            {!hasSelection && thresholds == null && (
                <div className="text-[10px] text-black/30 italic text-center py-2">Sin datos de tráfico</div>
            )}
            {!hasSelection && thresholds != null && (
                <>
                    <div className="flex gap-3 h-24 my-1 relative">
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
                    <div className="text-[8px] text-black/25 italic">&lt; P5 no representado</div>
                </>
            )}
            {hasSelection && activeSubmode === 'heatmap' && (
                <>
                    <div className="text-[8px] font-black text-black/30 uppercase tracking-widest">
                        Concentración de trayectos
                    </div>
                    <div
                        className="h-3 w-full rounded-full"
                        style={{ background: 'linear-gradient(to right, #BFDDCE, #027A76, #014440)' }}
                    />
                    <div className="flex justify-between text-[9px] font-semibold text-black/40">
                        <span>Baja</span>
                        <span>Alta</span>
                    </div>
                </>
            )}
        </div>
    );
}
