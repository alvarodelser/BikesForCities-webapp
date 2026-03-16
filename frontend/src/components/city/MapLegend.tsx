import React from 'react';
import GlassCard from '../ui/GlassCard';

interface MapLegendProps {
    colorScheme: { primary: string; secondary: string; accent: string; light: string };
}

const MapLegend: React.FC<MapLegendProps> = ({ colorScheme }) => {
    return (
        <div className="absolute bottom-4 left-4 z-20">
            <GlassCard
                surface="glass"
                tint="rgba(255, 255, 255, 0.1)"
                className="p-4"
            >
                <h3 className="text-white font-semibold mb-3">Legend</h3>
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: colorScheme.primary }}
                        ></div>
                        <span className="text-white/80 text-sm">Primary Data</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: colorScheme.accent }}
                        ></div>
                        <span className="text-white/80 text-sm">Secondary Data</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: colorScheme.secondary }}
                        ></div>
                        <span className="text-white/80 text-sm">Supporting Data</span>
                    </div>
                </div>
            </GlassCard>
        </div>
    );
};

export default MapLegend;
