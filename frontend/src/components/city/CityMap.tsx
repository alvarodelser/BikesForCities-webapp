import React, { useState } from 'react';
import type { CityData } from '../../constants/cities';
import CityCanvas from './map/CityCanvas';
import CityLegend from './map/CityLegend';
import MapControls from './MapControls';
import { ThresholdsContext } from './map/ThresholdsContext';
import type { Thresholds } from './map/ThresholdsContext';
import { MapContext, type MapContextValue } from './map/MapContext';
import maplibregl from 'maplibre-gl';
import { useCallback } from 'react';
import { useMapState } from '../../hooks/useMapState';
import { useViewport } from '../../hooks/useViewport';

import { MAP_MODES } from '../../constants/mapModes';

interface CityMapProps {
    city: CityData;
    selectedColor?: string;
    bottomOffset?: number;
    onEdgeSelect?: (id: number | null) => void;
}

const modeLabels: Record<string, string> = {
    [MAP_MODES.INFRASTRUCTURE]: 'Infraestructura Ciclista',
    [MAP_MODES.STATIONS]: 'Estaciones de Bici',
    [MAP_MODES.TRAFFIC]: 'Tráfico Ciclista',
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
const CityMap: React.FC<CityMapProps> = ({ city, selectedColor = 'var(--blue)', bottomOffset = 0, onEdgeSelect }) => {
    const { mode } = useMapState();
    const [mapInstance, setMapInstance] = useState<maplibregl.Map | null>(null);
    const [thresholds, setThresholds] = useState<Thresholds | null>(null);

    const [selectedEdgeId, setSelectedEdgeIdInternal] = useState<number | null>(null);
    const setSelectedEdgeId = useCallback((id: number | null) => {
        setSelectedEdgeIdInternal(id);
        onEdgeSelect?.(id);
    }, [onEdgeSelect]);
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
        if (mapInstance.getLayer('carto-labels-layer')) {
            mapInstance.setLayoutProperty('carto-labels-layer', 'visibility', visibility);
            // Re-float labels to the top of the layer stack so they render above any
            // mode-specific layers (traffic, stations, etc.) that were added after map load.
            if (show) mapInstance.moveLayer('carto-labels-layer');
        }
    }, [mapInstance]);

    const contextValue: MapContextValue = {
        map: mapInstance,
        city,
        zoomIn,
        zoomOut,
        reset,
        toggleBackground,
        selectedEdgeId,
        setSelectedEdgeId,
    };


    return (
        <MapContext.Provider value={contextValue}>
            <ThresholdsContext.Provider value={{ thresholds, setThresholds }}>
                <div
                    className="w-full relative overflow-hidden h-full flex flex-col"
                    style={{
                        '--mode-primary': colorScheme.primary,
                        '--mode-secondary': colorScheme.secondary,
                        '--mode-accent': colorScheme.accent,
                    } as React.CSSProperties}
                >


                    {/* Separated header - hidden on mobile as MapMobile provides its own overlay */}
                    {!isMobile && (
                        <div className="z-20 pb-4 shrink-0">
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
                                <div>
                                    <h1
                                        className="text-xl font-bold leading-tight"
                                        style={{ color: '#ffffffee', fontFamily: "'Archivo Narrow', sans-serif" }}
                                    >
                                        {city.name} - {modeLabel}
                                    </h1>
                                </div>

                                {/* MapControls reads map instance from MapContext — hidden on mobile (rendered separately at bottom-right) */}
                                {!isMobile && <MapControls colorScheme={colorScheme} />}
                            </div>
                        </div>
                    )}

                    {/* Mobile: vertical MapControls floating at bottom-RIGHT, above pull-up sheet */}
                    {isMobile && (
                        <div 
                            className="absolute right-4 z-20 transition-all duration-300"
                            style={{ bottom: `${bottomOffset + 12}px` }}
                        >
                            <MapControls colorScheme={colorScheme} vertical />
                        </div>
                    )}

                    {/* Map canvas */}
                    <div className={`z-10 ${isMobile ? 'absolute inset-0' : 'relative flex-1 min-h-0 pb-4'}`}>
                        <div
                            className={`w-full h-full overflow-hidden transition-all duration-500 ${isMobile ? '' : 'rounded-2xl'}`}
                            style={isMobile ? {} : {
                                border: '1px solid rgba(0, 0, 0, 0.25)',
                            }}
                        >
                            <CityCanvas city={city} onMapInstance={setMapInstance} />
                        </div>
                    </div>

                    {/* Legend — floats over canvas */}
                    <CityLegend colorScheme={colorScheme} bottomOffset={bottomOffset} defaultOpen={!isMobile ? true : false} />
                </div>
            </ThresholdsContext.Provider>
        </MapContext.Provider>
    );
};

export default CityMap;
