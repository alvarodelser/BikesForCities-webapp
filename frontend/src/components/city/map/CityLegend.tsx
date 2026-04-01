import { MODES } from './modes';
import { useMapState } from '../../../hooks/useMapState';
import { commonLegendItems } from './modes/common';

/**
 * Thin shell: resolves the active mode from URL, renders the matching Legend
 * component, and appends universal map legend items below it.
 */
export default function CityLegend() {
    const { mode } = useMapState();
    const config = MODES[mode];
    if (!config) return null;

    const Legend = config.legend;

    return (
        <div className="absolute bottom-4 left-4 z-20">
            <div className="bg-white/90 backdrop-blur-sm border border-black/10 shadow-xl rounded-2xl p-4 min-w-[200px]">
                <h3 className="text-black font-bold mb-3 text-sm border-b border-black/5 pb-1">Leyenda</h3>
                <div className="flex flex-col gap-y-2.5">
                    {/* Mode-specific legend (may include its own layer side-effect) */}
                    <Legend />

                    {/* Common items always shown below mode legend, filtered as needed */}
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
            </div>
        </div>
    );
}
