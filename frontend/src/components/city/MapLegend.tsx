import { MAP_MODES, type MapMode } from '../../constants/mapModes';

interface MapLegendProps {
    inline?: boolean;
    selectedMode?: MapMode | string;
    activeMetric?: 'trips' | 'downtime';
    onMetricChange?: (metric: 'trips' | 'downtime') => void;
    colorScheme?: { primary: string; secondary: string; accent: string; light: string };
    thresholds?: { q5: number; q50: number; q95: number; max: number; min: number } | null;
    showBikePathBuildings?: boolean;
    onToggleBikePathBuildings?: () => void;
}

const commonLegendItems = [
    { type: 'square', color: '#ead5c5', label: 'Edificios' },
    { type: 'dashed', color: '#4a5568', label: 'Límite Municipal' },
    { type: 'square', color: '#dde5e4', label: 'Parques y Bosques' },
    { type: 'square', color: '#a4b7ca', label: 'Agua y Mar' },
];

const LegendItem: React.FC<{ 
    type: string; 
    color: string; 
    label: string;
    isInteractable?: boolean;
    isActive?: boolean;
    onToggle?: () => void;
    thresholds?: { q5: number; q50: number; q95: number; max: number; min: number } | null;
    activeMetric?: 'trips' | 'downtime';
    onMetricChange?: (metric: 'trips' | 'downtime') => void;
}> = ({ type, color, label, isInteractable, isActive = true, onToggle, thresholds, activeMetric, onMetricChange }) => (
    <div 
        className={`flex flex-col gap-1 w-full ${isInteractable ? 'cursor-pointer hover:bg-black/5 p-1.5 -m-1.5 rounded-xl transition-all duration-300 group' : ''}`}
        onClick={isInteractable ? onToggle : undefined}
    >
        <div className="flex items-center justify-between gap-2 w-full">
            <div className="flex items-center gap-2">
                {type === 'line' && <div className="w-4 h-1 rounded-sm shadow-sm" style={{ backgroundColor: color }} />}
                {type === 'circle' && <div className="w-3 h-3 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: color }} />}
                {type === 'square' && (
                    <div 
                        className="w-3 h-3 rounded-sm shadow-sm transition-opacity" 
                        style={{ backgroundColor: color, opacity: isActive ? 1 : 0.3 }} 
                    />
                )}
                {type === 'dashed' && <div className="w-4 h-0 border-t-2 border-dashed shadow-sm" style={{ borderColor: color }} />}
                {type !== 'station-usage' && (
                    <span className={`text-xs font-semibold text-black/60 transition-colors ${!isActive && 'opacity-40'}`}>
                        {label}
                    </span>
                )}
            </div>

            {isInteractable && (
                <div className="flex items-center">
                    <div className={`w-7 h-3.5 rounded-full relative transition-colors duration-300 ${isActive ? 'bg-teal-500 shadow-[0_0_8px_rgba(20,184,166,0.4)]' : 'bg-gray-300'}`}>
                        <div className={`absolute top-0.5 w-2.5 h-2.5 bg-white rounded-full shadow-sm transition-all duration-300 cubic-bezier(0.4, 0, 0.2, 1) ${isActive ? 'left-4' : 'left-0.5'}`} />
                    </div>
                </div>
            )}
        </div>

        {(type === 'station-usage' || type === 'road-traffic') && (
            <div className="flex flex-col gap-2 mt-1 mb-2 w-full">
                <div className="flex flex-col gap-3 border-b border-black/5 pb-3 mb-2 font-[Archivo Narrow]">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black text-black/60 uppercase tracking-widest leading-tight">
                            {type === 'station-usage' 
                                ? (activeMetric === 'trips' ? 'Frecuencia de Uso' : 'Tiempo sin Bicis')
                                : 'Viajes por Calle'}
                        </span>
                        
                        {type === 'station-usage' && (
                            /* Metric Toggle */
                            <div className="flex p-0.5 bg-black/5 rounded-lg pointer-events-auto">
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onMetricChange?.('trips'); }}
                                    className={`px-2 py-0.5 text-[9px] font-bold rounded-md transition-all ${activeMetric === 'trips' ? 'bg-white shadow-sm text-black' : 'text-black/40 hover:text-black/60'}`}
                                >
                                    VIAJES
                                </button>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onMetricChange?.('downtime'); }}
                                    className={`px-2 py-0.5 text-[9px] font-bold rounded-md transition-all ${activeMetric === 'downtime' ? 'bg-white shadow-sm text-black' : 'text-black/40 hover:text-black/60'}`}
                                >
                                    TIEMPO
                                </button>
                            </div>
                        )}
                    </div>
                    <span className="text-[10px] font-medium text-black/40 italic">
                        ({type === 'station-usage' 
                            ? (activeMetric === 'trips' ? 'viajes/mes' : 'minutos sin bicis / día')
                            : 'viajes estimados / mes'})
                    </span>
                </div>
                
                <div className="flex gap-4 h-64 my-2 relative">
                    {/* The Bar Stack */}
                    <div className="flex flex-col w-4 h-full rounded-full overflow-hidden border border-black/10 shadow-sm bg-white/50 backdrop-blur-sm">
                         {type === 'station-usage' ? (
                             <>
                                <div className="h-10 w-full" style={{ backgroundColor: activeMetric === 'trips' ? '#042F2E' : '#450A0A' }} />
                                <div 
                                   className="flex-1 w-full" 
                                   style={{ 
                                       background: activeMetric === 'trips' 
                                           ? 'linear-gradient(to top, #D1FAE5, #34D399, #065F46)' 
                                           : 'linear-gradient(to top, #FEE2E2, #EF4444, #7F1D1D)'
                                   }} 
                                />
                                <div className="h-10 w-full bg-[#A0AEC0]" />
                             </>
                         ) : (
                             <div 
                                className="flex-1 w-full" 
                                style={{ 
                                    background: 'linear-gradient(to top, #edf8e9, #c7e9c0, #a1d99b, #74c476, #41ab5d, #238b45, #005a32)' 
                                }} 
                             />
                         )}
                    </div>
                    
                    {/* Precisely Positioned Labels */}
                    <div className="flex-1 relative h-full text-[10px] font-bold text-black/60 tracking-tight">
                        {/* Max Value */}
                        <div className="absolute top-0 flex items-center h-4">
                            <span className="opacity-40">{thresholds?.max ? Math.round(thresholds.max) : '-'} {type === 'station-usage' ? (activeMetric === 'trips' ? 'v/m' : 'min') : 'v/m'} {type === 'station-usage' ? '' : '(max)'}</span>
                        </div>
                        
                        {/* P95 Junction */}
                        <div className="absolute top-10 flex items-center w-full h-0">
                            <div className="flex items-center gap-1.5 w-full">
                                <div className="w-2 h-[1.5px] bg-black/10" />
                                <span className="bg-white/90 px-1.5 py-0.5 rounded shadow-sm border border-black/5 whitespace-nowrap">
                                    {thresholds?.q95 ? Math.round(thresholds.q95) : '-'} {type === 'station-usage' ? (activeMetric === 'trips' ? 'v/m' : 'min') : 'v/m'} (P95)
                                </span>
                            </div>
                        </div>

                        {/* Median */}
                        <div className="absolute top-1/2 flex items-center w-full h-0 -translate-y-1/2">
                            <div className="flex items-center gap-1.5 w-full">
                                <div className="w-4 h-[1.5px] bg-black/20" />
                                <span 
                                    className={`px-2 py-1 rounded-md border shadow-md backdrop-blur-md whitespace-nowrap transition-colors ${
                                        type === 'road-traffic'
                                            ? 'bg-green-100/90 text-black/80 border-green-200/60'
                                            : activeMetric === 'trips' 
                                                ? 'bg-emerald-100/90 text-black/80 border-emerald-200/60' 
                                                : 'bg-red-100/90 text-black/80 border-red-200/60'
                                    }`}
                                >
                                    {thresholds?.q50 ? Math.round(thresholds.q50) : '-'} {type === 'station-usage' ? (activeMetric === 'trips' ? 'v/m' : 'min') : 'v/m'} (mediana)
                                </span>
                            </div>
                        </div>

                        {/* P5 Junction */}
                        <div className="absolute bottom-10 flex items-center w-full h-0">
                            <div className="flex items-center gap-1.5 w-full">
                                <div className="w-2 h-[1.5px] bg-black/10" />
                                <span className="bg-white/90 px-1.5 py-0.5 rounded shadow-sm border border-black/5 whitespace-nowrap">
                                    {thresholds?.q5 ? Math.round(thresholds.q5) : '-'} {type === 'station-usage' ? (activeMetric === 'trips' ? 'v/m' : 'min') : 'v/m'} (P5)
                                </span>
                            </div>
                        </div>

                        {/* Min Value */}
                        <div className="absolute bottom-0 flex items-center h-4">
                            <span className="opacity-40">{thresholds?.min ? Math.round(thresholds.min) : '-'} {type === 'station-usage' ? (activeMetric === 'trips' ? 'v/m' : 'min') : 'v/m'}</span>
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
);

const MapLegend: React.FC<MapLegendProps> = ({ 
    inline = false,
    selectedMode = MAP_MODES.INFRASTRUCTURE,
    activeMetric = 'trips',
    onMetricChange,
    showBikePathBuildings = true,
    onToggleBikePathBuildings,
    thresholds
}) => {
    const getItems = () => {
        switch (selectedMode) {
            case MAP_MODES.STATIONS:
                return [
                    { type: 'station-usage', color: '', label: 'Frecuencia de Uso', thresholds: thresholds },
                    ...commonLegendItems
                ];
            case MAP_MODES.INFRASTRUCTURE:
                return [
                    { type: 'line', color: '#00cac3', label: 'Carril Bici' },
                    { type: 'square', color: '#027A76', label: 'Edificios < 150m' },
                    ...commonLegendItems
                ];
            case MAP_MODES.TRAFFIC:
                return [
                    { type: 'road-traffic', color: '', label: 'Intensidad de Tráfico', thresholds: thresholds },
                    ...commonLegendItems
                ];
            case MAP_MODES.TERRAIN:
                return [
                    { type: 'square', color: '#8d6e63', label: 'Zonas de Pendiente' },
                    ...commonLegendItems
                ];
            case MAP_MODES.ACCIDENTS:
                return [
                    { type: 'circle', color: 'var(--red)', label: 'Punto Negro' },
                    ...commonLegendItems
                ];
            default:
                return [...commonLegendItems];
        }
    };

    const renderItems = () => getItems().map((item) => {
        const isBikePathBuildings = item.label === 'Edificios < 150m';
        
        let isActive = true;
        let isInteractable = false;
        let onToggle = undefined;

        if (isBikePathBuildings) {
            isActive = showBikePathBuildings;
            isInteractable = true;
            onToggle = onToggleBikePathBuildings;
        }

        return (
            <LegendItem 
                key={item.label} 
                {...item} 
                isInteractable={isInteractable}
                isActive={isActive}
                onToggle={onToggle}
                activeMetric={activeMetric}
                onMetricChange={onMetricChange}
            />
        );
    });

    if (inline) {
        return (
            <div className="flex flex-col gap-2">
                {renderItems()}
            </div>
        );
    }

    // Mobile: floating bottom-left pill
    return (
        <div className="absolute bottom-4 left-4 z-20">
            <div className="bg-white/90 backdrop-blur-sm border border-black/10 shadow-xl rounded-2xl p-4 min-w-[200px]">
                <h3 className="text-black font-bold mb-3 text-sm border-b border-black/5 pb-1">Leyenda</h3>
                <div className="grid grid-cols-1 gap-y-2.5">
                    {renderItems()}
                </div>
            </div>
        </div>
    );
};

export default MapLegend;
