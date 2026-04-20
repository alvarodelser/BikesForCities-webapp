import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import type { CityData } from '../../constants/cities';
import { getModeStats } from '../../constants/cityStats';
import { useMapState } from '../../hooks/useMapState';
import { useViewport } from '../../hooks/useViewport';
import MapFilters from './MapFilters';
import CityMap from './CityMap';
import CityStats from './CityStats';
import DualPanel from './DualPanel';
import { ChevronsUp, ChevronsDown } from 'lucide-react';

const modeNames: Record<string, string> = {
    'infrastructure': 'Infraestructura',
    'traffic':        'Tráfico',
    'stations':       'Estaciones',
    'terrain':        'Terreno',
    'intersections':  'Intersecciones',
    'accidents':      'Accidentes',
};

const modeColors: Record<string, string> = {
    'infrastructure': 'var(--blue)',
    'traffic':        'var(--red)',
    'stations':       'var(--green)',
    'terrain':        'var(--orange)',
    'intersections':  'var(--yellow)',
    'accidents':      'var(--red)',
};

interface MapSectionProps {
    city: CityData;
}

const MapSection: React.FC<MapSectionProps> = ({ city }) => {
    const { mode, setMode } = useMapState();
    const { isUltrawide, isMobile } = useViewport();
    const [,setSearchParams] = useSearchParams();
    const mapRef = useRef<HTMLDivElement>(null);
    const [showScrollHint, setShowScrollHint] = useState(true);
    const [isAnimating, setIsAnimating] = useState(false);

    const isModeAvailable = (m: string | null): boolean => {
        if (!m) return false;
        if (m === 'infrastructure' || m === 'traffic') return true;
        if (!modeNames[m]) return false;
        if (city.available_modes) return city.available_modes[m] === true;
        if (m === 'stations') return (city.stations_count || 0) > 0;
        return false;
    };

    // Auto-scroll when 50%+ of canvas is in view
    useEffect(() => {
        if (!isMobile || !mapRef.current) return;

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
                        setShowScrollHint(true);
                        setIsAnimating(true);
                        // Auto-scroll to position map at top
                        setTimeout(() => {
                            mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }, 100);
                    }
                });
            },
            { threshold: [0.5] }
        );

        observer.observe(mapRef.current);
        return () => observer.disconnect();
    }, [isMobile]);

    // Stop animation after text fades
    useEffect(() => {
        if (isAnimating) {
            const timer = setTimeout(() => {
                setIsAnimating(false);
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [isAnimating]);

    // Redirect to infrastructure if the mode param is invalid for this city
    useEffect(() => {
        if (!isModeAvailable(mode)) {
            setSearchParams(prev => {
                const next = new URLSearchParams(prev);
                next.set('mode', 'infrastructure');
                next.delete('submode');
                return next;
            }, { replace: true });
        }
    }, [mode, city.id]);

    const selectedColor = modeColors[mode] || 'var(--blue)';
    const modeStats = getModeStats(mode, city);
    const modeName  = modeNames[mode] || mode;
    const title    = `Estadísticas de ${modeName}`;
    const subtitle = `Análisis detallado de datos de ${modeName.toLowerCase()} en ${city.name}`;

    const filters = (
        <MapFilters
            city={city}
            selectedMode={mode}
            onModeChange={(newMode) => setMode(newMode)}
            isModeAvailable={isModeAvailable}
        />
    );
    const map   = <CityMap city={city} selectedColor={selectedColor} />;
    const stats = <CityStats title={title} subtitle={subtitle} modeStats={modeStats} />;

    if (!isUltrawide) {
        return (
            <div className="w-full">
                {filters}
                <div ref={mapRef} className="relative">
                    {map}
                    {isMobile && showScrollHint && (
                        <div className="absolute inset-0 z-30 flex flex-col justify-between pointer-events-none px-4">
                            {/* Scroll up indicator */}
                            <button
                                className={`flex justify-center pointer-events-auto ${isAnimating ? 'animate-bounce' : ''}`}
                                style={{ paddingTop: '100px' }}
                                onClick={() => {
                                    setIsAnimating(true);
                                    window.scrollBy({ top: -300, behavior: 'smooth' });
                                }}
                                aria-label="Scroll up"
                            >
                                <div className="p-2 rounded-xl backdrop-blur-md bg-black/30 border border-white/30 hover:bg-black/40 transition-colors">
                                    <ChevronsUp className="w-6 h-6 text-white/70" />
                                </div>
                            </button>

                            {/* Scroll down indicator */}
                            <button
                                className={`flex justify-center pb-8 pointer-events-auto ${isAnimating ? 'animate-bounce' : ''}`}
                                onClick={() => {
                                    setIsAnimating(true);
                                    window.scrollBy({ top: 300, behavior: 'smooth' });
                                }}
                                aria-label="Scroll down"
                            >
                                <div className="relative flex flex-col items-center gap-2">
                                    <div className="p-2 rounded-xl backdrop-blur-md bg-black/30 border border-white/30 hover:bg-black/40 transition-colors">
                                        <ChevronsDown className="w-6 h-6 text-white/70" />
                                    </div>
                                    {isAnimating && (
                                        <span className="text-xs font-semibold text-white/70 animate-fade-out whitespace-nowrap">
                                            Tap to scroll
                                        </span>
                                    )}
                                </div>
                            </button>
                        </div>
                    )}
                </div>
                {stats}
            </div>
        );
    }

    return (
        <div className="w-full">
            <DualPanel>
                <DualPanel.Left>
                    {filters}
                    {stats}
                </DualPanel.Left>
                <DualPanel.Right>
                    {map}
                </DualPanel.Right>
            </DualPanel>
        </div>
    );
};

export default MapSection;