import React, { useState, useEffect } from 'react';
import { useMap } from '../../MapContext';

interface LegendItemProps {
    type: string;
    color: string;
    label: string;
    isInteractable?: boolean;
    isActive?: boolean;
    onToggle?: () => void;
}

const LegendItem: React.FC<LegendItemProps> = ({ type, color, label, isInteractable, isActive = true, onToggle }) => (
    <div
        className={`flex items-center justify-between gap-2 w-full ${isInteractable ? 'cursor-pointer hover:bg-black/5 p-1.5 -m-1.5 rounded-xl transition-all duration-300 group' : ''}`}
        onClick={isInteractable ? onToggle : undefined}
    >
        <div className="flex items-center gap-2">
            {type === 'line' && <div className="w-4 h-1 rounded-sm shadow-sm" style={{ backgroundColor: color }} />}
            {type === 'square' && (
                <div
                    className="w-3 h-3 rounded-sm shadow-sm transition-opacity"
                    style={{ backgroundColor: color, opacity: isActive ? 1 : 0.3 }}
                />
            )}
            {type === 'dashed' && <div className="w-4 h-0 border-t-2 border-dashed shadow-sm" style={{ borderColor: color }} />}
            <span className={`text-xs font-semibold text-black/60 transition-colors ${!isActive && 'opacity-40'}`}>
                {label}
            </span>
        </div>

        {isInteractable && (
            <div className="flex items-center">
                <div className={`w-7 h-3.5 rounded-full relative transition-colors duration-300 ${isActive ? 'bg-teal-500 shadow-[0_0_8px_rgba(20,184,166,0.4)]' : 'bg-gray-300'}`}>
                    <div className={`absolute top-0.5 w-2.5 h-2.5 bg-white rounded-full shadow-sm transition-all duration-300 ${isActive ? 'left-4' : 'left-0.5'}`} />
                </div>
            </div>
        )}
    </div>
);

const BUILDINGS_LAYER_ID = 'bike-path-buildings-layer';

export default function InfrastructureLegend() {
    const [showBikePathBuildings, setShowBikePathBuildings] = useState(true);
    const { map } = useMap();

    useEffect(() => {
        if (!map || !map.getLayer(BUILDINGS_LAYER_ID)) return;
        const targetColor = showBikePathBuildings ? '#027A76' : '#ead5c5';
        map.setPaintProperty(BUILDINGS_LAYER_ID, 'fill-color', targetColor);

        return () => {
            // Restore default color when leaving the infrastructure mode
            if (map.getLayer(BUILDINGS_LAYER_ID)) {
                map.setPaintProperty(BUILDINGS_LAYER_ID, 'fill-color', '#ead5c5');
            }
        };
    }, [map, showBikePathBuildings]);

    return (
        <div className="flex flex-col gap-y-2.5">
            <LegendItem type="line" color="#00cac3" label="Carril Bici" />
            <LegendItem
                type="square"
                color="#027A76"
                label="Edificios < 150m"
                isInteractable
                isActive={showBikePathBuildings}
                onToggle={() => setShowBikePathBuildings(v => !v)}
            />
        </div>
    );
}
