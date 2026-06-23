import React, { useState } from 'react';
import { Layers, ZoomIn, ZoomOut, RotateCcw, HelpCircle } from 'lucide-react';
import { useMap } from './map/MapContext';

interface MapControlsProps {
    colorScheme: { primary: string; secondary: string; accent: string; light: string };
    vertical?: boolean;
    onHelpClick?: () => void;
}

const MapControls: React.FC<MapControlsProps> = ({ colorScheme, vertical = false, onHelpClick }) => {
    const { zoomIn, zoomOut, reset, toggleBackground } = useMap();
    const [showBackground, setShowBackground] = useState(false);

    const handleToggleBackground = () => {
        const next = !showBackground;
        setShowBackground(next);
        toggleBackground(next);
    };

    const btnStyle = (active = false) => ({
        backgroundColor: active ? `${colorScheme.accent}80` : `${colorScheme.accent}20`,
        color: colorScheme.secondary,
        border: `1px solid ${colorScheme.accent}60`,
    });

    const btnClass = `backdrop-blur-sm text-white p-3 rounded-full transition-all duration-300 hover:scale-110`;

    return (
        <div className={`flex ${vertical ? 'flex-col' : 'flex-row items-center'} gap-2`}>
            {onHelpClick && (
                <button onClick={onHelpClick} className={btnClass} style={btnStyle()} title="Ayuda del mapa">
                    <HelpCircle className="w-5 h-5" />
                </button>
            )}
            <button onClick={handleToggleBackground} className={btnClass} style={btnStyle(showBackground)} title="Toggle Base Map">
                <Layers className="w-5 h-5" />
            </button>
            <button onClick={zoomIn} className={btnClass} style={btnStyle()} title="Zoom In">
                <ZoomIn className="w-5 h-5" />
            </button>
            <button onClick={zoomOut} className={btnClass} style={btnStyle()} title="Zoom Out">
                <ZoomOut className="w-5 h-5" />
            </button>
            <button onClick={reset} className={btnClass} style={btnStyle()} title="Reset View">
                <RotateCcw className="w-5 h-5" />
            </button>
        </div>
    );
};

export default MapControls;
