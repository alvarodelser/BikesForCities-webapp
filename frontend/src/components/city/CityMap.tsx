import React, { useState } from 'react';
import type { CityData } from '../../constants/cities';
import CityCanvas from './map/CityCanvas';
import CityLegend from './map/CityLegend';
import MapControls from './MapControls';
import { ThresholdsContext } from './map/ThresholdsContext';
import type { Thresholds } from './map/ThresholdsContext';
import { MapPin } from 'lucide-react';
import { MapContext, type MapContextValue } from './map/MapContext';
import maplibregl from 'maplibre-gl';
import { useCallback } from 'react';
import { useMapState } from '../../hooks/useMapState';
import { useViewport } from '../../hooks/useViewport';

import { MAP_MODES } from '../../constants/mapModes';

interface CityMapProps {
    city: CityData;
    selectedColor?: string;
}

const modeLabels: Record<string, string> = {
    [MAP_MODES.INFRASTRUCTURE]: 'Infraestructura Ciclista',
    [MAP_MODES.STATIONS]: 'Estaciones de Bici',
    [MAP_MODES.TRAFFIC]: 'Tráfico Ciclista',
    [MAP_MODES.TERRAIN]: 'Terreno',
    [MAP_MODES.INTERSECTIONS]: 'Intersecciones',
    [MAP_MODES.ACCIDENTS]: 'Accidentes',
};

const getColorScheme = (colorVar: string) => {
    const schemes: Record<string, { primary: string; secondary: string; accent: string; light: string }> = {
        'var(--red)': { primary: '#e74c3c', secondary: '#c0392b', accent: '#ff6b6b', light: '#ffebee' },
        'var(--green)': { primary: '#7BA492', secondary: '#027A76', accent: '#4ecdc4', light: '#e8f5e8' },
        'var(--blue)': { primary: '#3f7aba', secondary: '#2c5c8c', accent: '#5dade2', light: '#e3f2fd' },
        'var(--orange)': { primary: '#f4a24c', secondary: '#e67e22', accent: '#ffb74d', light: '#fff3e0' },
        'var(--yellow)': { primary: '#f1c40f', secondary: '#f39c12', accent: '#fff176', light: '#fffde7' },
        'var(--blue-dark)': { primary: '#2c5c8c', secondary: '#1a365d', accent: '#4299e1', light: '#e6f3ff' },
    };
    return schemes[colorVar] || schemes['var(--blue)'];
};

/**
 * CityMap is a presentational shell:
 * - Provides ThresholdsContext so layers can write and legends can read thresholds
 * - Renders the header chrome, canvas, legend, and controls
 * - Holds NO mode/metric state — all derived from URL via useMapState
 */
const CityMap: React.FC<CityMapProps> = ({ city, selectedColor = 'var(--blue)' }) => {
    const { mode } = useMapState();
    const [mapInstance, setMapInstance] = useState<maplibregl.Map | null>(null);
    const [thresholds, setThresholds] = useState<Thresholds | null>(null);
    const colorScheme = getColorScheme(selectedColor);
    const modeLabel = modeLabels[mode] || mode;
    const { isMobile } = useViewport();

    // --- Control callbacks (moved from CityCanvas) ---
    const zoomIn = useCallback(() => mapInstance?.zoomIn(), [mapInstance]);
    const zoomOut = useCallback(() => mapInstance?.zoomOut(), [mapInstance]);

    const reset = useCallback(() => {
        if (!mapInstance) return;
        const generateRectBoundary = (lon: number, lat: number, angleDeg: number) => {
            const limit = 10000;
            const angleRad = (angleDeg * Math.PI) / 180;
            const metersPerLat = 111320;
            const metersPerLon = 111320 * Math.cos((lat * Math.PI) / 180);
            const offsets: [number, number][] = [[-limit / 2, -limit / 2], [limit / 2, -limit / 2], [limit / 2, limit / 2], [-limit / 2, limit / 2]];
            return offsets.map(([dx, dy]) => [
                lon + (dx * Math.cos(angleRad) + dy * Math.sin(angleRad)) / metersPerLon,
                lat + (-dx * Math.sin(angleRad) + dy * Math.cos(angleRad)) / metersPerLat,
            ]);
        };
        const coords = generateRectBoundary(city.geoCoords.longitude, city.geoCoords.latitude, city.angle || 0);
        const lons = coords.map(c => c[0]);
        const lats = coords.map(c => c[1]);
        const bounds: [number, number, number, number] = [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
        mapInstance.fitBounds([[bounds[0], bounds[1]], [bounds[2], bounds[3]]], { padding: 40, duration: 1000 });
    }, [mapInstance, city]);

    const toggleBackground = useCallback((show: boolean) => {
        if (!mapInstance) return;
        const visibility = show ? 'visible' : 'none';
        if (mapInstance.getLayer('carto-base-layer')) mapInstance.setLayoutProperty('carto-base-layer', 'visibility', visibility);
        if (mapInstance.getLayer('carto-labels-layer')) mapInstance.setLayoutProperty('carto-labels-layer', 'visibility', visibility);
    }, [mapInstance]);

    const contextValue: MapContextValue = {
        map: mapInstance,
        city,
        zoomIn,
        zoomOut,
        reset,
        toggleBackground,
    };


    return (
        <MapContext.Provider value={contextValue}>
            <ThresholdsContext.Provider value={{ thresholds, setThresholds }}>
                <div
                    className={`w-full relative overflow-hidden map-section-bg ${isMobile ? 'h-screen' : 'h-screen'}`}
                    style={{
                        '--mode-primary': colorScheme.primary,
                        '--mode-secondary': colorScheme.secondary,
                        '--mode-accent': colorScheme.accent,
                    } as React.CSSProperties}
                >
                    {/* Atmospheric background */}
                    <div className="absolute inset-0 map-section-bg__base" />
                    <div className="absolute inset-0 map-section-bg__radial" />
                    <div className="absolute inset-0 map-section-bg__noise" />


                    {/* Floating header - hidden on mobile as MapMobile provides its own overlay */}
                    {!isMobile && (
                        <div className="absolute top-0 left-0 right-0 z-20 p-4">
                            <div
                                className="mx-auto rounded-2xl px-6 py-3 flex items-center justify-between"
                                style={{
                                    background: 'rgba(255,255,255,0.12)',
                                    backdropFilter: 'blur(20px)',
                                    WebkitBackdropFilter: 'blur(20px)',
                                    border: '1px solid rgba(255,255,255,0.22)',
                                    boxShadow: '0 8px 32px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.3)',
                                }}
                            >
                                <div className="flex items-center gap-4">
                                    <div
                                        className="w-11 h-11 rounded-xl flex items-center justify-center shadow-lg"
                                        style={{
                                            background: `linear-gradient(135deg, ${colorScheme.primary}, ${colorScheme.secondary})`,
                                            boxShadow: `0 4px 12px ${colorScheme.primary}55`,
                                        }}
                                    >
                                        <MapPin className="w-5 h-5 text-white" />
                                    </div>
                                    <div>
                                        <h1
                                            className="text-xl font-bold font-[Archivo_Narrow] leading-tight"
                                            style={{ color: '#ffffffee' }}
                                        >
                                            {city.name} - {modeLabel}
                                        </h1>
                                    </div>
                                </div>

                                {/* MapControls reads map instance from MapContext — hidden on mobile (rendered separately at bottom-right) */}
                                {!isMobile && <MapControls colorScheme={colorScheme} />}
                            </div>
                        </div>
                    )}

                    {/* Mobile: vertical MapControls floating at bottom-RIGHT, above pull-up sheet */}
                    {isMobile && (
                        <div className="absolute bottom-[150px] right-4 z-20">
                            <MapControls colorScheme={colorScheme} vertical />
                        </div>
                    )}

                    {/* Map canvas */}
                    <div className={`absolute inset-0 z-10 ${isMobile ? '' : 'pt-24 pb-4 px-4'}`}>
                        <div
                            className={`w-full h-full overflow-hidden transition-colors duration-500 ${isMobile ? '' : 'rounded-2xl shadow-2xl'}`}
                            style={isMobile ? {} : {
                                border: `2px solid ${colorScheme.primary}55`,
                                boxShadow: `0 0 0 1px ${colorScheme.primary}22, 0 24px 64px rgba(0,0,0,0.35)`,
                            }}
                        >
                            <CityCanvas city={city} onMapInstance={setMapInstance} />
                        </div>
                    </div>

                    {/* Legend — floats over canvas */}
                    <CityLegend />
                </div>
            </ThresholdsContext.Provider>
        </MapContext.Provider>
    );
};

export default CityMap;
