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

    const isGenerationAvailable = (gen: string) => modes.some(m => m.generation_type === gen);
    const isAlgorithmAvailable = (algo: string) => modes.some(m => m.generation_type === generation && m.algorithm === algo);

    const handleSetGeneration = (gen: string) => {
        if (!isGenerationAvailable(gen)) return;
        setGeneration(gen);
        const algosForGen = ALGORITHM_ORDER.filter(a =>
            modes.some(m => m.generation_type === gen && m.algorithm === a)
        );
        if (algosForGen.length > 0 && !algosForGen.includes(routing)) {
            setRouting(algosForGen[0]);
        }
    };

    const handleSetRouting = (algo: string) => {
        if (!isAlgorithmAvailable(algo)) return;
        setRouting(algo);
    };

    if (modes.length === 0) return null;

    const PillButton = ({ label, active, disabled, onClick }: { label: string; active: boolean; disabled: boolean; onClick: () => void }) => (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`px-2 py-0.5 rounded-full text-[9px] font-bold border transition-all duration-150 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
            style={active ? {
                backgroundColor: accent,
                color: 'white',
                border: `1px solid ${accent}`,
                opacity: 1,
            } : {
                backgroundColor: disabled ? 'rgba(0,0,0,0.02)' : 'rgba(0,0,0,0.04)',
                color: disabled ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.45)',
                border: disabled ? '1px solid rgba(0,0,0,0.04)' : '1px solid rgba(0,0,0,0.08)',
                opacity: disabled ? 0.6 : 1,
            }}
        >
            {label}
        </button>
    );

    return (
        <div className="flex flex-col gap-1.5 pt-2 border-t border-black/5">
            <div className="flex flex-col gap-1">
                <span className="text-[8px] font-black text-black/30 uppercase tracking-widest">Fuente de datos</span>
                <div className="flex gap-1 flex-wrap">
                    {GENERATION_ORDER.map(gen => (
                        <PillButton
                            key={gen}
                            label={GENERATION_LABELS[gen] ?? gen}
                            active={generation === gen}
                            disabled={!isGenerationAvailable(gen)}
                            onClick={() => handleSetGeneration(gen)}
                        />
                    ))}
                </div>
            </div>

            <div className="flex flex-col gap-1">
                <span className="text-[8px] font-black text-black/30 uppercase tracking-widest">Algoritmo</span>
                <div className="flex gap-1 flex-wrap">
                    {ALGORITHM_ORDER.map(algo => (
                        <PillButton
                            key={algo}
                            label={ALGORITHM_LABELS[algo] ?? algo}
                            active={routing === algo}
                            disabled={!isAlgorithmAvailable(algo)}
                            onClick={() => handleSetRouting(algo)}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
