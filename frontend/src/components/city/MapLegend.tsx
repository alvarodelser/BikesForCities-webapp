import React from 'react';

interface MapLegendProps {
    inline?: boolean;
}

const legendItems = [
    { type: 'line', color: '#00cac3', label: 'Carril Bici' },
    { type: 'square', color: '#027A76', label: 'Edificios < 150m' },
    { type: 'square', color: '#ead5c5', label: 'Edificios' },
    { type: 'dashed', color: '#4a5568', label: 'Límite Municipal' },
    { type: 'square', color: '#dde5e4', label: 'Parques y Bosques' },
    { type: 'square', color: '#a4b7ca', label: 'Agua y Mar' },
];

const LegendItem: React.FC<{ type: string; color: string; label: string }> = ({ type, color, label }) => (
    <div className="flex items-center gap-2">
        {type === 'line' && <div className="w-4 h-1 rounded-sm" style={{ backgroundColor: color }} />}
        {type === 'square' && <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />}
        {type === 'dashed' && <div className="w-4 h-0 border-t-2 border-dashed" style={{ borderColor: color }} />}
        <span className="text-black/80 text-xs font-medium">{label}</span>
    </div>
);

const MapLegend: React.FC<MapLegendProps> = ({ inline = false }) => {
    if (inline) {
        return (
            <div className="flex flex-col gap-2">
                {legendItems.map((item) => (
                    <LegendItem key={item.label} {...item} />
                ))}
            </div>
        );
    }

    // Mobile: floating bottom-left pill
    return (
        <div className="absolute bottom-4 left-4 z-20">
            <div className="bg-white/90 backdrop-blur-sm border border-black/10 shadow-xl rounded-2xl p-4">
                <h3 className="text-black font-bold mb-3 text-sm border-b border-black/5 pb-1">Leyenda</h3>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                    {legendItems.map((item) => (
                        <LegendItem key={item.label} {...item} />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default MapLegend;
