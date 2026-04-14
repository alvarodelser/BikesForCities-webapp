import React, { useState } from 'react';
import { useThresholds } from '../../ThresholdsContext';
import { useMapState } from '../../../../../hooks/useMapState';

export default function StationsLegend() {
    const { thresholds } = useThresholds();
    const { submode, setSubmode } = useMapState();
    const metric = submode === 'downtime' ? 'downtime' : submode === 'reach' ? 'reach' : 'trips';
    const [showPolygon, setShowPolygon] = useState(true);

    const handlePolygonToggle = () => {
        const next = !showPolygon;
        setShowPolygon(next);
        window.dispatchEvent(new CustomEvent('reach-polygon-toggle', { detail: { visible: next } }));
    };

    return (
        <div className="flex flex-col gap-2 w-full">
            {/* Header + metric toggle */}
            <div className="flex flex-col gap-3 border-b border-black/5 pb-3 mb-2 font-[Archivo_Narrow]">
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-black/60 uppercase tracking-widest leading-tight">
                        {metric === 'trips' ? 'Frecuencia de Uso' : metric === 'downtime' ? 'Tiempo sin Bicis' : 'Alcance'}
                    </span>
                    <div className="flex p-0.5 bg-black/5 rounded-lg">
                        <button
                            onClick={() => setSubmode('trips')}
                            className={`px-2 py-0.5 text-[9px] font-bold rounded-md transition-all ${metric === 'trips' ? 'bg-white shadow-sm text-black' : 'text-black/40 hover:text-black/60'}`}
                        >
                            VIAJES
                        </button>
                        <button
                            onClick={() => setSubmode('downtime')}
                            className={`px-2 py-0.5 text-[9px] font-bold rounded-md transition-all ${metric === 'downtime' ? 'bg-white shadow-sm text-black' : 'text-black/40 hover:text-black/60'}`}
                        >
                            TIEMPO
                        </button>
                        <button
                            onClick={() => setSubmode('reach')}
                            className={`px-2 py-0.5 text-[9px] font-bold rounded-md transition-all ${metric === 'reach' ? 'bg-white shadow-sm text-black' : 'text-black/40 hover:text-black/60'}`}
                        >
                            ALCANCE
                        </button>
                    </div>
                </div>
                <span className="text-[10px] font-medium text-black/40 italic">
                    ({metric === 'trips' ? 'viajes/mes' : metric === 'downtime' ? 'minutos sin bicis / día' : '% cobertura (área alcanzable / círculo 1km)'})
                </span>
            </div>

            {/* Gradient bar + labels */}
            {metric === 'reach' ? (
                <>
                    <div className="flex gap-4 h-64 my-2 relative">
                        <div className="flex flex-col w-4 h-full rounded-full overflow-hidden border border-black/10 shadow-sm bg-white/50 backdrop-blur-sm">
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
                                    <div className="w-4 h-[1.5px] bg-black/20" />
                                    <span className="px-2 py-1 rounded-md border shadow-md backdrop-blur-md whitespace-nowrap bg-teal-100/90 text-black/80 border-teal-200/60">
                                        {thresholds?.q50 != null ? `${Math.round(thresholds.q50)}%` : '–'} (mediana)
                                    </span>
                                </div>
                            </div>
                            <div className="absolute bottom-0 flex items-center h-4">
                                <span className="opacity-40">{thresholds?.min != null ? `${Math.round(thresholds.min)}%` : '–'}</span>
                            </div>
                        </div>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer select-none mt-1 px-1">
                        <input
                            type="checkbox"
                            checked={showPolygon}
                            onChange={handlePolygonToggle}
                            className="w-3.5 h-3.5 accent-teal-600 rounded cursor-pointer"
                        />
                        <span className="text-[10px] font-semibold text-black/50">
                            Mostrar polígono de cobertura
                        </span>
                    </label>
                </>
            ) : (
                <div className="flex gap-4 h-64 my-2 relative">
                    <div className="flex flex-col w-4 h-full rounded-full overflow-hidden border border-black/10 shadow-sm bg-white/50 backdrop-blur-sm">
                        <div className="h-10 w-full" style={{ backgroundColor: metric === 'trips' ? '#042F2E' : '#450A0A' }} />
                        <div
                            className="flex-1 w-full"
                            style={{
                                background: metric === 'trips'
                                    ? 'linear-gradient(to top, #D1FAE5, #34D399, #065F46)'
                                    : 'linear-gradient(to top, #FEE2E2, #EF4444, #7F1D1D)'
                            }}
                        />
                        {metric === 'trips' && <div className="h-10 w-full bg-[#A0AEC0]" />}
                    </div>
                    <div className="flex-1 relative h-full text-[10px] font-bold text-black/60 tracking-tight">
                        <div className="absolute top-0 flex items-center h-4">
                            <span className="opacity-40">{thresholds?.max != null ? Math.round(thresholds.max) : '–'} {metric === 'trips' ? 'v/m' : 'min'}</span>
                        </div>
                        <div className="absolute top-10 flex items-center w-full h-0">
                            <div className="flex items-center gap-1.5 w-full">
                                <div className="w-2 h-[1.5px] bg-black/10" />
                                <span className="bg-white/90 px-1.5 py-0.5 rounded shadow-sm border border-black/5 whitespace-nowrap">
                                    {thresholds?.q95 != null ? Math.round(thresholds.q95) : '–'} {metric === 'trips' ? 'v/m' : 'min'} (P95)
                                </span>
                            </div>
                        </div>
                        <div className="absolute top-1/2 flex items-center w-full h-0 -translate-y-1/2">
                            <div className="flex items-center gap-1.5 w-full">
                                <div className="w-4 h-[1.5px] bg-black/20" />
                                <span className={`px-2 py-1 rounded-md border shadow-md backdrop-blur-md whitespace-nowrap transition-colors ${
                                    metric === 'trips'
                                        ? 'bg-emerald-100/90 text-black/80 border-emerald-200/60'
                                        : 'bg-red-100/90 text-black/80 border-red-200/60'
                                }`}>
                                    {thresholds?.q50 != null ? Math.round(thresholds.q50) : '–'} {metric === 'trips' ? 'v/m' : 'min'} (mediana)
                                </span>
                            </div>
                        </div>
                        <div className="absolute bottom-10 flex items-center w-full h-0">
                            <div className="flex items-center gap-1.5 w-full">
                                <div className="w-2 h-[1.5px] bg-black/10" />
                                <span className="bg-white/90 px-1.5 py-0.5 rounded shadow-sm border border-black/5 whitespace-nowrap">
                                    {thresholds?.q5 != null ? Math.round(thresholds.q5) : '–'} {metric === 'trips' ? 'v/m' : 'min'} (P5)
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
