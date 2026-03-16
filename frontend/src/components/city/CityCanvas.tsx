import React from 'react';
import type { CityData } from '../../constants/cities';
import { MapPin } from 'lucide-react';

interface CityCanvasProps {
    city: CityData;
    selectedMode: string;
    colorScheme: { primary: string; secondary: string; accent: string; light: string };
}

const CityCanvas: React.FC<CityCanvasProps> = ({ city, selectedMode, colorScheme }) => {
    return (
        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-8 text-center max-w-2xl mx-8">
            <div
                className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg"
                style={{
                    background: `linear-gradient(135deg, ${colorScheme.primary}, ${colorScheme.secondary})`
                }}
            >
                <MapPin className="w-12 h-12 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-4">Interactive Canvas map</h2>
            <p className="text-xl text-white/80 mb-6">
                {selectedMode === 'traffic' && 'Real-time traffic flow visualization'}
                {selectedMode === 'stations' && 'Bike sharing stations and availability'}
                {selectedMode === 'network' && 'Cycling infrastructure network analysis'}
                {selectedMode === 'topography' && 'Elevation and terrain mapping'}
                {selectedMode === 'usage' && 'Cycling usage patterns and analytics'}
                {selectedMode === 'demographics' && 'Population density and demographics'}
            </p>
            <div className="bg-white/10 rounded-xl p-4 border border-white/20">
                <p className="text-white/70">
                    Canvas integration coming soon... This will display an interactive canvas of {city.name}
                    with {selectedMode.replace('-', ' ')} data overlay.
                </p>
            </div>
        </div>
    );
};

export default CityCanvas;
