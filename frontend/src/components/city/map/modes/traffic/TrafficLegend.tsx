import { useThresholds } from '../../ThresholdsContext';

export default function TrafficLegend() {
    const { thresholds } = useThresholds();

    return (
        <div className="flex flex-col gap-2 w-full">
            <div className="flex flex-col gap-3 border-b border-black/5 pb-3 mb-2 font-[Archivo_Narrow]">
                <span className="text-[11px] font-black text-black/60 uppercase tracking-widest leading-tight">
                    Viajes por Calle
                </span>
                <span className="text-[10px] font-medium text-black/40 italic">
                    (viajes estimados / mes)
                </span>
            </div>

            <div className="flex gap-4 h-64 my-2 relative">
                <div className="flex flex-col w-4 h-full rounded-full overflow-hidden border border-black/10 shadow-sm">
                    <div
                        className="flex-1 w-full"
                        style={{
                            background: 'linear-gradient(to top, #edf8e9, #c7e9c0, #a1d99b, #74c476, #41ab5d, #238b45, #005a32)'
                        }}
                    />
                </div>

                <div className="flex-1 relative h-full text-[10px] font-bold text-black/60 tracking-tight">
                    <div className="absolute top-0 flex items-center h-4">
                        <span className="opacity-40">{thresholds?.max != null ? Math.round(thresholds.max) : '–'} v/m</span>
                    </div>
                    <div className="absolute top-10 flex items-center w-full h-0">
                        <div className="flex items-center gap-1.5 w-full">
                            <div className="w-2 h-[1.5px] bg-black/10" />
                            <span className="bg-white/90 px-1.5 py-0.5 rounded shadow-sm border border-black/5 whitespace-nowrap">
                                {thresholds?.q95 != null ? Math.round(thresholds.q95) : '–'} v/m (P95)
                            </span>
                        </div>
                    </div>
                    <div className="absolute top-1/2 flex items-center w-full h-0 -translate-y-1/2">
                        <div className="flex items-center gap-1.5 w-full">
                            <div className="w-4 h-[1.5px] bg-black/20" />
                            <span className="px-2 py-1 rounded-md border shadow-md backdrop-blur-md whitespace-nowrap bg-green-100/90 text-black/80 border-green-200/60">
                                {thresholds?.q50 != null ? Math.round(thresholds.q50) : '–'} v/m (mediana)
                            </span>
                        </div>
                    </div>
                    <div className="absolute bottom-10 flex items-center w-full h-0">
                        <div className="flex items-center gap-1.5 w-full">
                            <div className="w-2 h-[1.5px] bg-black/10" />
                            <span className="bg-white/90 px-1.5 py-0.5 rounded shadow-sm border border-black/5 whitespace-nowrap">
                                {thresholds?.q5 != null ? Math.round(thresholds.q5) : '–'} v/m (P5)
                            </span>
                        </div>
                    </div>
                    <div className="absolute bottom-0 flex items-center h-4">
                        <span className="opacity-40">{thresholds?.min != null ? Math.round(thresholds.min) : '–'} v/m</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
