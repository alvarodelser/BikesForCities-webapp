import React from 'react';
import type { CityData } from '../../constants/cities';
import { MapPin } from 'lucide-react';
import MapControls from './MapControls';

interface MapHeaderProps {
    city: CityData;
    selectedMode: string;
    colorScheme: { primary: string; secondary: string; accent: string; light: string };
}

const MapHeader: React.FC<MapHeaderProps> = ({ city, selectedMode, colorScheme }) => {
    return (
        <div className="absolute top-0 left-0 right-0 z-20 bg-white/10 backdrop-blur-md border-b border-white/20 p-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div
                        className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg"
                        style={{
                            background: `linear-gradient(135deg, ${colorScheme.primary}, ${colorScheme.secondary})`
                        }}
                    >
                        <MapPin className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white">{city.name} — Infraestructura Ciclista</h1>
                        <p className="text-white/80 capitalize">Modo: {selectedMode.replace('-', ' ')}</p>
                    </div>
                </div>

                {/* Map Controls */}
                <MapControls colorScheme={colorScheme} />
            </div>
        </div>
    );
};

export default MapHeader;
