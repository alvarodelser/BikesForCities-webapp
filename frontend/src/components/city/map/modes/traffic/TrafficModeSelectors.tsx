import { useMapState } from '../../../../../hooks/useMapState';
import { useMap } from '../../MapContext';

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

type Combo = { generation_type: string; algorithm: string };

interface TrafficModeSelectorsProps {
    accent?: string;
}

export default function TrafficModeSelectors({ accent = '#027A76' }: TrafficModeSelectorsProps) {
    const { generation, routing, setGeneration, setRouting } = useMapState();
    const { city } = useMap();

    const modes = (city?.available_modes?.traffic_combinations as Combo[] | undefined) ?? [];

    const availableGenerations = GENERATION_ORDER.filter(g =>
        modes.some(m => m.generation_type === g)
    );
    const availableAlgorithms = ALGORITHM_ORDER.filter(a =>
        modes.some(m => m.generation_type === generation && m.algorithm === a)
    );

    const handleSetGeneration = (gen: string) => {
        setGeneration(gen);
        const algosForGen = ALGORITHM_ORDER.filter(a =>
            modes.some(m => m.generation_type === gen && m.algorithm === a)
        );
        if (algosForGen.length > 0 && !algosForGen.includes(routing)) {
            setRouting(algosForGen[0]);
        }
    };

    if (availableGenerations.length === 0) return null;

    const PillButton = ({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) => (
        <button
            onClick={onClick}
            className="px-2 py-0.5 rounded-full text-[9px] font-bold border transition-all duration-150"
            style={active ? {
                backgroundColor: accent,
                color: 'white',
                border: `1px solid ${accent}`,
            } : {
                backgroundColor: 'rgba(0,0,0,0.04)',
                color: 'rgba(0,0,0,0.45)',
                border: '1px solid rgba(0,0,0,0.08)',
            }}
        >
            {label}
        </button>
    );

    return (
        <div className="flex flex-col gap-1.5 pt-2 border-t border-black/5">
            <span className="text-[8px] font-black text-black/30 uppercase tracking-widest">Datos</span>
            {availableGenerations.length > 1 && (
                <div className="flex gap-1 flex-wrap">
                    {availableGenerations.map(gen => (
                        <PillButton
                            key={gen}
                            label={GENERATION_LABELS[gen] ?? gen}
                            active={generation === gen}
                            onClick={() => handleSetGeneration(gen)}
                        />
                    ))}
                </div>
            )}
            {availableAlgorithms.length > 1 && (
                <div className="flex gap-1 flex-wrap">
                    {availableAlgorithms.map(algo => (
                        <PillButton
                            key={algo}
                            label={ALGORITHM_LABELS[algo] ?? algo}
                            active={routing === algo}
                            onClick={() => setRouting(algo)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
