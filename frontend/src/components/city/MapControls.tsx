import React, { useState } from 'react';
import { Layers, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface MapControlsProps {
    colorScheme: { primary: string; secondary: string; accent: string; light: string };
    onZoomIn?: () => void;
    onZoomOut?: () => void;
    onReset?: () => void;
    onToggleBackground?: (show: boolean) => void;
    vertical?: boolean;
}

const MapControls: React.FC<MapControlsProps> = ({
    colorScheme, onZoomIn, onZoomOut, onReset, onToggleBackground, vertical = false
}) => {
    const [showBackground, setShowBackground] = useState(false);

    const handleToggleBackground = () => {
        const newState = !showBackground;
        setShowBackground(newState);
        if (onToggleBackground) onToggleBackground(newState);
    };

    const btnStyle = (active = false) => ({
        backgroundColor: active ? `${colorScheme.accent}80` : `${colorScheme.accent}40`,
        border: `1px solid ${colorScheme.accent}60`,
    });

    const btnClass = `backdrop-blur-sm text-white p-3 rounded-full transition-all duration-300 hover:scale-110`;

    return (
        <div className={`flex ${vertical ? 'flex-col' : 'flex-row items-center'} gap-2`}>
            <button onClick={handleToggleBackground} className={btnClass} style={btnStyle(showBackground)} title="Toggle Base Map">
                <Layers className="w-5 h-5" />
            </button>
            <button onClick={onZoomIn} className={btnClass} style={btnStyle()} title="Zoom In">
                <ZoomIn className="w-5 h-5" />
            </button>
            <button onClick={onZoomOut} className={btnClass} style={btnStyle()} title="Zoom Out">
                <ZoomOut className="w-5 h-5" />
            </button>
            <button onClick={onReset} className={btnClass} style={btnStyle()} title="Reset View">
                <RotateCcw className="w-5 h-5" />
            </button>
        </div>
    );
};

export default MapControls;
