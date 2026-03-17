import React, { useState } from 'react';
import { Layers, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface MapControlsProps {
    colorScheme: { primary: string; secondary: string; accent: string; light: string };
    onZoomIn?: () => void;
    onZoomOut?: () => void;
    onReset?: () => void;
    onToggleBackground?: (show: boolean) => void;
}

const MapControls: React.FC<MapControlsProps> = ({ colorScheme, onZoomIn, onZoomOut, onReset, onToggleBackground }) => {
    // Background is off by default as requested
    const [showBackground, setShowBackground] = useState(false);

    const handleToggleBackground = () => {
        const newState = !showBackground;
        setShowBackground(newState);
        if (onToggleBackground) {
            onToggleBackground(newState);
        }
    };

    return (
        <div className="flex items-center gap-3">
            <button
                onClick={handleToggleBackground}
                className="backdrop-blur-sm text-white p-3 rounded-full transition-all duration-300 hover:scale-110"
                style={{
                    backgroundColor: showBackground ? `${colorScheme.accent}80` : `${colorScheme.accent}40`,
                    border: `1px solid ${colorScheme.accent}60`
                }}
                title="Toggle Base Map"
            >
                <Layers className="w-5 h-5" />
            </button>
            <button
                onClick={onZoomIn}
                className="backdrop-blur-sm text-white p-3 rounded-full transition-all duration-300 hover:scale-110"
                style={{
                    backgroundColor: `${colorScheme.accent}40`,
                    border: `1px solid ${colorScheme.accent}60`
                }}
                title="Zoom In"
            >
                <ZoomIn className="w-5 h-5" />
            </button>
            <button
                onClick={onZoomOut}
                className="backdrop-blur-sm text-white p-3 rounded-full transition-all duration-300 hover:scale-110"
                style={{
                    backgroundColor: `${colorScheme.accent}40`,
                    border: `1px solid ${colorScheme.accent}60`
                }}
                title="Zoom Out"
            >
                <ZoomOut className="w-5 h-5" />
            </button>
            <button
                onClick={onReset}
                className="backdrop-blur-sm text-white p-3 rounded-full transition-all duration-300 hover:scale-110"
                style={{
                    backgroundColor: `${colorScheme.accent}40`,
                    border: `1px solid ${colorScheme.accent}60`
                }}
                title="Reset View"
            >
                <RotateCcw className="w-5 h-5" />
            </button>
        </div>
    );
};

export default MapControls;
