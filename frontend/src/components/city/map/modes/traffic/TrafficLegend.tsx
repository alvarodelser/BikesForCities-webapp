import { useThresholds } from '../../ThresholdsContext';
import { useMapState } from '../../../../../hooks/useMapState';

export default function TrafficLegend() {
    const { thresholds } = useThresholds();
    const { submode } = useMapState();
    const mode = submode === 'heatmap' ? 'heatmap' : 'traces';

    return (
        <div className="flex flex-col gap-2 w-full">
            {/* Submode label — now set from filter pill when edge is selected */}
            <div className="border-b border-black/5 pb-2 mb-1">
                <span className="text-[10px] font-medium text-black/40 italic">
                    {mode === 'heatmap' ? 'mapa de calor' : 'viajes / mes — clic en tramo para rutas'}
                </span>
            </div>

            {thresholds == null ? (
                <div className="text-[10px] text-black/30 italic py-4 text-center">Sin datos de tráfico</div>
            ) : (
                <div className="flex gap-4 h-48 my-2 relative">
                    <div className="flex flex-col w-4 h-full rounded-full overflow-hidden border border-black/10 shadow-sm">
                        <div
                            className="flex-1 w-full"
                            style={{ background: 'linear-gradient(to top, #edf8e9, #74c476, #005a32)' }}
                        />
                    </div>

                    <div className="flex-1 relative h-full text-[10px] font-bold text-black/60 tracking-tight">
                        <div className="absolute top-0 flex items-center w-full h-0">
                            <div className="flex items-center gap-1.5 w-full">
                                <div className="w-2 h-[1.5px] bg-black/10" />
                                <span className="bg-white/90 px-1.5 py-0.5 rounded shadow-sm border border-black/5 whitespace-nowrap">
                                    {Math.round(thresholds.q95)} v/m (P95+)
                                </span>
                            </div>
                        </div>
                        <div className="absolute top-1/2 flex items-center w-full h-0 -translate-y-1/2">
                            <div className="flex items-center gap-1.5 w-full">
                                <div className="w-4 h-[1.5px] bg-black/20" />
                                <span className="px-2 py-1 rounded-md border shadow-md backdrop-blur-md whitespace-nowrap bg-green-100/90 text-black/80 border-green-200/60">
                                    {Math.round(thresholds.q50)} v/m (mediana)
                                </span>
                            </div>
                        </div>
                        <div className="absolute bottom-0 flex items-center w-full h-0">
                            <div className="flex items-center gap-1.5 w-full">
                                <div className="w-2 h-[1.5px] bg-black/10" />
                                <span className="bg-white/90 px-1.5 py-0.5 rounded shadow-sm border border-black/5 whitespace-nowrap">
                                    {Math.round(thresholds.q5)} v/m (P5)
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            <div className="text-[9px] text-black/30 italic mt-1">&lt; P5 no representado</div>
        </div>
    );
}
