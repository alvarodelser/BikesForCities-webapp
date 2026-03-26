import React from 'react';

interface MapLegendProps {
    inline?: boolean;
}

const legendItems = [
    { type: 'line', color: '#00cac3', label: 'Bike Path' },
    { type: 'square', color: '#027A76', label: 'Buildings < 150m' },
    { type: 'square', color: '#ead5c5', label: 'Buildings' },
    { type: 'dashed', color: '#4a5568', label: 'City Boundary' },
    { type: 'square', color: '#dde5e4', label: 'Parks & Forest' },
    { type: 'square', color: '#a4b7ca', label: 'Water & Sea' },
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

    // Mobile: floating bottom-center pill
    return (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
            <div className="bg-white/90 backdrop-blur-sm border border-black/10 shadow-xl rounded-2xl p-4">
                <h3 className="text-black font-bold mb-3 text-sm border-b border-black/5 pb-1">Map Legend</h3>
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
