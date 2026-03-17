import React from 'react';
import GlassCard from '../ui/GlassCard';

interface MapLegendProps { }

const MapLegend: React.FC<MapLegendProps> = () => {
    return (
        <div className="absolute bottom-4 left-4 z-20">
            <GlassCard
                surface="glass"
                tint="rgba(255, 255, 255, 0.1)"
                className="p-4"
            >
                <h3 className="text-white font-semibold mb-3">Leyenda</h3>
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <div
                            className="w-4 h-1 rounded-sm"
                            style={{ backgroundColor: '#00cac3' }}
                        ></div>
                        <span className="text-white/80 text-sm">Carril Bici</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div
                            className="w-3 h-3 rounded-sm opacity-80"
                            style={{ backgroundColor: '#027A76' }}
                        ></div>
                        <span className="text-white/80 text-sm">Edificios a 150m de un carril bici</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div
                            className="w-3 h-3 rounded-sm opacity-60"
                            style={{ backgroundColor: '#111111', border: '1px solid rgba(255,255,255,0.2)' }}
                        ></div>
                        <span className="text-white/80 text-sm">Otros edificios</span>
                    </div>
                </div>
            </GlassCard>
        </div>
    );
};

export default MapLegend;
