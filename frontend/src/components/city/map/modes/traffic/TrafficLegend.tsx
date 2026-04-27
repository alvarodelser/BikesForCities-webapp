import { useState, useEffect } from 'react';
import { useThresholds } from '../../ThresholdsContext';
import { useMapState } from '../../../../../hooks/useMapState';
import { useMap } from '../../MapContext';
import { fetchTrafficModes, type TrafficMode } from '../../../../../services/api';

const GENERATION_LABELS: Record<string, string> = {
    real: 'GPS real',
    station_based: 'Estaciones',
    buildings_population: 'Población',
};

const ALGORITHM_LABELS: Record<string, string> = {
    map_matched: 'Map-matched',
    safest: 'Ruta segura',
    shortest: 'Ruta corta',
    grouped: 'Agrupado',
};

const GENERATION_ORDER = ['real', 'station_based', 'buildings_population'];
const ALGORITHM_ORDER = ['map_matched', 'safest', 'shortest', 'grouped'];

const TRAFFIC_SUBMODES = [
    { id: 'traces',  label: 'Trayecto' },
    { id: 'heatmap', label: 'Calor' },
];

export default function TrafficLegend() {
    const { thresholds } = useThresholds();
    const { submode, generation, routing, setGeneration, setRouting, setSubmode } = useMapState();
    const { city } = useMap();
    const [modes, setModes] = useState<TrafficMode[]>([]);
    const activeSubmode = submode || 'traces';

    useEffect(() => {
        if (!city?.id) return;
        fetchTrafficModes(city.id)
            .then(setModes)
            .catch(err => console.error('Failed to load traffic modes:', err));
    }, [city?.id]);

    const availableGenerations = GENERATION_ORDER.filter(g =>
        modes.some(m => m.generation_type === g)
    );
    const availableAlgorithms = ALGORITHM_ORDER.filter(a =>
        modes.some(m => m.generation_type === generation && m.algorithm === a)
    );

    const handleSetGeneration = (gen: string) => {
        setGeneration(gen);
        // If current algorithm has no data for the new generation, switch to best available
        const algosForGen = ALGORITHM_ORDER.filter(a =>
            modes.some(m => m.generation_type === gen && m.algorithm === a)
        );
        if (algosForGen.length > 0 && !algosForGen.includes(routing)) {
            setRouting(algosForGen[0]);
        }
    };

    return (
        <div className="flex flex-col gap-2 w-full">
            {/* Mode selectors */}
            <div className="flex flex-col gap-1.5 border-b border-black/5 pb-2 mb-1">
                {availableGenerations.length > 1 && (
                    <div className="flex gap-1 flex-wrap">
                        {availableGenerations.map(gen => (
                            <button
                                key={gen}
                                onClick={() => handleSetGeneration(gen)}
                                className={`px-2 py-0.5 rounded text-[9px] font-semibold border transition-colors ${
                                    generation === gen
                                        ? 'bg-green-600 text-white border-green-600'
                                        : 'bg-white text-black/50 border-black/15 hover:border-black/30'
                                }`}
                            >
                                {GENERATION_LABELS[gen] ?? gen}
                            </button>
                        ))}
                    </div>
                )}
                {availableAlgorithms.length > 1 && (
                    <div className="flex gap-1 flex-wrap">
                        {availableAlgorithms.map(algo => (
                            <button
                                key={algo}
                                onClick={() => setRouting(algo)}
                                className={`px-2 py-0.5 rounded text-[9px] font-semibold border transition-colors ${
                                    routing === algo
                                        ? 'bg-gray-700 text-white border-gray-700'
                                        : 'bg-white text-black/50 border-black/15 hover:border-black/30'
                                }`}
                            >
                                {ALGORITHM_LABELS[algo] ?? algo}
                            </button>
                        ))}
                    </div>
                )}
                {/* Route overlay submode — always visible so user knows what to expect on edge click */}
                <div className="flex gap-1 flex-wrap">
                    {TRAFFIC_SUBMODES.map(s => (
                        <button
                            key={s.id}
                            onClick={() => setSubmode(s.id)}
                            className={`px-2 py-0.5 rounded text-[9px] font-semibold border transition-colors ${
                                activeSubmode === s.id
                                    ? 'bg-teal-700 text-white border-teal-700'
                                    : 'bg-white text-black/50 border-black/15 hover:border-black/30'
                            }`}
                        >
                            {s.label}
                        </button>
                    ))}
                </div>
                <span className="text-[10px] font-medium text-black/40 italic">
                    {activeSubmode === 'heatmap' ? 'mapa de calor al clic' : 'viajes / mes — clic en tramo para rutas'}
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
