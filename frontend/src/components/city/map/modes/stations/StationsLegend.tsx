import { useState } from 'react';
import { useThresholds } from '../../ThresholdsContext';
import { useMapState } from '../../../../../hooks/useMapState';

export default function StationsLegend() {
    const { thresholds } = useThresholds();
    const { submode } = useMapState();
    const metric = submode === 'downtime' ? 'downtime' : submode === 'reach' ? 'reach' : 'trips';
    const [showPolygon, setShowPolygon] = useState(true);

    const handlePolygonToggle = () => {
        const next = !showPolygon;
        setShowPolygon(next);
        window.dispatchEvent(new CustomEvent('reach-polygon-toggle', { detail: { visible: next } }));
    };

    return (
        <div className="flex flex-col gap-2 w-full">
            {/* Gradient bar + labels — shorter h-32 instead of h-64 */}
            {metric === 'reach' ? (
                <>
                    <div className="flex gap-3 h-32 my-1 relative">
                        <div className="flex flex-col w-3.5 h-full rounded-full overflow-hidden border border-black/10 shadow-sm bg-white/50 backdrop-blur-sm">
                            <div
                                className="flex-1 w-full"
                                style={{
                                    background: 'linear-gradient(to top, #e0f2f1, #80cbc4, #26a69a, #00897b, #004d40)',
                                }}
                            />
                        </div>
                        <div className="flex-1 relative h-full text-[10px] font-bold text-black/60 tracking-tight">
                            <div className="absolute top-0 flex items-center h-4">
                                <span className="opacity-40">{thresholds?.max != null ? `${Math.round(thresholds.max)}%` : '–'}</span>
                            </div>
                            <div className="absolute top-1/2 flex items-center w-full h-0 -translate-y-1/2">
                                <div className="flex items-center gap-1.5 w-full">
                                    <div className="w-3 h-[1.5px] bg-black/20" />
                                    <span className="px-1.5 py-0.5 rounded-md border shadow-sm backdrop-blur-md whitespace-nowrap bg-teal-100/90 text-black/80 border-teal-200/60 text-[9px]">
                                        {thresholds?.q50 != null ? `${Math.round(thresholds.q50)}%` : '–'} med.
                                    </span>
                                </div>
                            </div>
                            <div className="absolute bottom-0 flex items-center h-4">
                                <span className="opacity-40">{thresholds?.min != null ? `${Math.round(thresholds.min)}%` : '–'}</span>
                            </div>
                        </div>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer select-none mt-0.5 px-1">
                        <input
                            type="checkbox"
                            checked={showPolygon}
                            onChange={handlePolygonToggle}
                            className="w-3 h-3 accent-teal-600 rounded cursor-pointer"
                        />
                        <span className="text-[9px] font-semibold text-black/50">
                            Mostrar cobertura
                        </span>
                    </label>
                </>
            ) : (
                <div className="flex gap-3 h-32 my-1 relative">
                    <div className="flex flex-col w-3.5 h-full rounded-full overflow-hidden border border-black/10 shadow-sm bg-white/50 backdrop-blur-sm">
                        <div className="h-8 w-full" style={{ backgroundColor: metric === 'trips' ? '#042F2E' : '#450A0A' }} />
                        <div
                            className="flex-1 w-full"
                            style={{
                                background: metric === 'trips'
                                    ? 'linear-gradient(to top, #D1FAE5, #34D399, #065F46)'
                                    : 'linear-gradient(to top, #FEE2E2, #EF4444, #7F1D1D)'
                            }}
                        />
                        {metric === 'trips' && <div className="h-8 w-full bg-[#A0AEC0]" />}
                    </div>
                    <div className="flex-1 relative h-full text-[10px] font-bold text-black/60 tracking-tight">
                        <div className="absolute top-0 flex items-center h-4">
                            <span className="opacity-40">{thresholds?.max != null ? Math.round(thresholds.max) : '–'} {metric === 'trips' ? 'v/m' : 'min'}</span>
                        </div>
                        <div className="absolute top-8 flex items-center w-full h-0">
                            <div className="flex items-center gap-1 w-full">
                                <div className="w-2 h-[1.5px] bg-black/10" />
                                <span className="bg-white/90 px-1 py-0.5 rounded shadow-sm border border-black/5 whitespace-nowrap text-[9px]">
                                    {thresholds?.q95 != null ? Math.round(thresholds.q95) : '–'} (P95)
                                </span>
                            </div>
                        </div>
                        <div className="absolute top-1/2 flex items-center w-full h-0 -translate-y-1/2">
                            <div className="flex items-center gap-1.5 w-full">
                                <div className="w-3 h-[1.5px] bg-black/20" />
                                <span className={`px-1.5 py-0.5 rounded-md border shadow-sm backdrop-blur-md whitespace-nowrap text-[9px] transition-colors ${
                                    metric === 'trips'
                                        ? 'bg-emerald-100/90 text-black/80 border-emerald-200/60'
                                        : 'bg-red-100/90 text-black/80 border-red-200/60'
                                }`}>
                                    {thresholds?.q50 != null ? Math.round(thresholds.q50) : '–'} med.
                                </span>
                            </div>
                        </div>
                        <div className="absolute bottom-8 flex items-center w-full h-0">
                            <div className="flex items-center gap-1 w-full">
                                <div className="w-2 h-[1.5px] bg-black/10" />
                                <span className="bg-white/90 px-1 py-0.5 rounded shadow-sm border border-black/5 whitespace-nowrap text-[9px]">
                                    {thresholds?.q5 != null ? Math.round(thresholds.q5) : '–'} (P5)
                                </span>
                            </div>
                        </div>
                        <div className="absolute bottom-0 flex items-center h-4">
                            <span className="opacity-40">{thresholds?.min != null ? Math.round(thresholds.min) : '–'} {metric === 'trips' ? 'v/m' : 'min'}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
