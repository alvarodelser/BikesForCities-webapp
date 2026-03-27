import React from 'react';

interface MapLegendProps {
    inline?: boolean;
    showBikePathBuildings?: boolean;
    onToggleBikePathBuildings?: () => void;
}

const legendItems = [
    { type: 'line', color: '#00cac3', label: 'Carril Bici' },
    { type: 'square', color: '#027A76', label: 'Edificios < 150m' },
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
}> = ({ type, color, label, isInteractable, isActive = true, onToggle }) => (
    <div 
        className={`flex items-center gap-2 ${isInteractable ? 'cursor-pointer hover:bg-black/5 p-1 -m-1 rounded-lg transition-colors group' : ''}`}
        onClick={isInteractable ? onToggle : undefined}
    >
        {type === 'line' && <div className="w-4 h-1 rounded-sm shadow-sm" style={{ backgroundColor: color }} />}
        {type === 'square' && (
            <div 
                className="w-3 h-3 rounded-sm shadow-sm transition-opacity" 
                style={{ backgroundColor: color, opacity: isActive ? 1 : 0.3 }} 
            />
        )}
        {type === 'dashed' && <div className="w-4 h-0 border-t-2 border-dashed shadow-sm" style={{ borderColor: color }} />}
        <span className={`text-xs font-medium transition-colors ${isActive ? 'text-black/80' : 'text-black/40'}`}>
            {label}
        </span>
        {isInteractable && (
            <div className="ml-auto pl-4">
                <div className={`w-6 h-3 rounded-full relative transition-colors ${isActive ? 'bg-teal-500' : 'bg-gray-300'}`}>
                    <div className={`absolute top-0.5 w-2 h-2 bg-white rounded-full transition-all ${isActive ? 'left-3.5' : 'left-0.5'}`} />
                </div>
            </div>
        )}
    </div>
);

const MapLegend: React.FC<MapLegendProps> = ({ 
    inline = false,
    showBikePathBuildings = true,
    onToggleBikePathBuildings
}) => {
    const renderItems = () => legendItems.map((item) => {
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
