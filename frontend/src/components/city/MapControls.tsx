import React from 'react';
import { Layers, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface MapControlsProps {
    colorScheme: { primary: string; secondary: string; accent: string; light: string };
}

const MapControls: React.FC<MapControlsProps> = ({ colorScheme }) => {
    return (
        <div className="flex items-center gap-3">
            <button
                className="backdrop-blur-sm text-white p-3 rounded-full transition-all duration-300 hover:scale-110"
                style={{
                    backgroundColor: `${colorScheme.accent}40`,
                    border: `1px solid ${colorScheme.accent}60`
                }}
            >
                <Layers className="w-5 h-5" />
            </button>
            <button
                className="backdrop-blur-sm text-white p-3 rounded-full transition-all duration-300 hover:scale-110"
                style={{
                    backgroundColor: `${colorScheme.accent}40`,
                    border: `1px solid ${colorScheme.accent}60`
                }}
            >
                <ZoomIn className="w-5 h-5" />
            </button>
            <button
                className="backdrop-blur-sm text-white p-3 rounded-full transition-all duration-300 hover:scale-110"
                style={{
                    backgroundColor: `${colorScheme.accent}40`,
                    border: `1px solid ${colorScheme.accent}60`
                }}
            >
                <ZoomOut className="w-5 h-5" />
            </button>
            <button
                className="backdrop-blur-sm text-white p-3 rounded-full transition-all duration-300 hover:scale-110"
                style={{
                    backgroundColor: `${colorScheme.accent}40`,
                    border: `1px solid ${colorScheme.accent}60`
                }}
            >
                <RotateCcw className="w-5 h-5" />
            </button>
        </div>
    );
};

export default MapControls;
