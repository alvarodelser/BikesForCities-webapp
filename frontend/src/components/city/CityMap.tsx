import React, { useState } from 'react';
import type { CityData } from '../../constants/cities';
import CityCanvas from './map/CityCanvas';
import CityLegend from './map/CityLegend';
import MapControls from './MapControls';
import MapHelpPanel from './map/MapHelpPanel';
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
    locked?: boolean;
}

const modeLabels: Record<string, string> = {
    [MAP_MODES.INFRASTRUCTURE]: 'Infraestructura Ciclista',
    [MAP_MODES.STATIONS]:       'Servicio Bici',
    [MAP_MODES.TRAFFIC]:        'Modelo de Movilidad',
    [MAP_MODES.ACCIDENTS]:      'Accidentalidad',
};

const submodeLabels: Partial<Record<string, string>> = {
    rutas:    'Trayectos',
    od:       'Desplazamientos',
    trips:    'Demanda',
    downtime: 'Disponibilidad',
    reach:    'Cobertura',
};


const getColorScheme = (colorVar: string) => {
    const schemes: Record<string, { primary: string; secondary: string; accent: string; light: string }> = {
        'var(--red)':      { primary: '#e74c3c', secondary: '#c0392b', accent: '#ff6b6b', light: '#ffebee' },
        'var(--green)':    { primary: '#7BA492', secondary: '#027A76', accent: '#4ecdc4', light: '#e8f5e8' },
        'var(--blue)':     { primary: '#3f7aba', secondary: '#2c5c8c', accent: '#5dade2', light: '#e3f2fd' },
        'var(--orange)':   { primary: '#f4a24c', secondary: '#e67e22', accent: '#ffb74d', light: '#fff3e0' },
        'var(--yellow)':   { primary: '#f1c40f', secondary: '#f39c12', accent: '#fff176', light: '#fffde7' },
        'var(--blue-dark)':{ primary: '#2c5c8c', secondary: '#1a365d', accent: '#4299e1', light: '#e6f3ff' },
        '#027A76': { primary: '#027A76', secondary: '#015c58', accent: '#3A6C7F', light: '#e0f7f6' },
        '#3A6C7F': { primary: '#3A6C7F', secondary: '#2a5060', accent: '#6fa8bc', light: '#e3f0f4' },
        '#ffa585': { primary: '#ffa585', secondary: '#ff7a57', accent: '#ffb8a0', light: '#fff5f2' },
    };
    return schemes[colorVar] || schemes['var(--blue)'];
};

const CityMap: React.FC<CityMapProps> = ({ city, selectedColor = 'var(--blue)', bottomOffset = 0, onEdgeSelect, locked = false }) => {
    const { mode, submode } = useMapState();
    const [mapInstance, setMapInstance] = useState<maplibregl.Map | null>(null);
    const [thresholds, setThresholds] = useState<Thresholds | null>(null);
    const [helpOpen, setHelpOpen] = useState(false);
    const [helpAnchor, setHelpAnchor] = useState<string | null>(null);

    const [selectedEdgeId, setSelectedEdgeIdInternal] = useState<number | null>(null);
    const setSelectedEdgeId = useCallback((id: number | null) => {
        setSelectedEdgeIdInternal(id);
        onEdgeSelect?.(id);
    }, [onEdgeSelect]);

    const [layerState, setLayerState] = useState<'idle' | 'loading' | 'error' | 'empty'>('idle');
    const layerRetryRef = React.useRef<(() => void) | null>(null);
    const setLayerRetry = useCallback((retryFn: () => void) => {
        layerRetryRef.current = retryFn;
    }, []);
    const retryLayerRequest = useCallback(() => {
        if (layerRetryRef.current) layerRetryRef.current();
    }, []);

    const colorScheme = getColorScheme(selectedColor);
    const modeLabel = modeLabels[mode] || mode;
    const submodeLabel = submode ? submodeLabels[submode] : undefined;
    const titleText = submodeLabel ? `${city.name} — ${modeLabel} (${submodeLabel})` : `${city.name} — ${modeLabel}`;
    const { isMobile } = useViewport();

    const openMapHelp = useCallback((anchor?: string) => {
        setHelpAnchor(anchor ?? null);
        setHelpOpen(true);
    }, []);
    const closeMapHelp = useCallback(() => {
        setHelpOpen(false);
        setHelpAnchor(null);
    }, []);

    // --- Control callbacks ---
    const zoomIn = useCallback(() => mapInstance?.zoomIn(), [mapInstance]);
    const zoomOut = useCallback(() => mapInstance?.zoomOut(), [mapInstance]);

    const reset = useCallback(() => {
        if (!mapInstance) return;
        if (city.maxBounds) {
            mapInstance.fitBounds(city.maxBounds, { padding: 40, duration: 1000 });
        } else {
            const limit = 0.05;
            const { longitude: lon, latitude: lat } = city.geoCoords;
            mapInstance.fitBounds([
                [lon - limit, lat - limit],
                [lon + limit, lat + limit]
            ], { padding: 40, duration: 1000 });
        }
    }, [mapInstance, city]);

    const toggleBackground = useCallback((show: boolean) => {
        if (!mapInstance) return;
        const visibility = show ? 'visible' : 'none';
        if (mapInstance.getLayer('carto-base-layer')) mapInstance.setLayoutProperty('carto-base-layer', 'visibility', visibility);
        if (mapInstance.getLayer('carto-labels-layer')) {
            mapInstance.setLayoutProperty('carto-labels-layer', 'visibility', visibility);
            if (show) mapInstance.moveLayer('carto-labels-layer');
        }
    }, [mapInstance]);

    // When locked, hide base tiles and zoom in; restore when unlocked
    React.useEffect(() => {
        if (!mapInstance) return;
        if (locked) {
            toggleBackground(false);
            mapInstance.easeTo({ zoom: 14.5, duration: 800 });
        } else {
            toggleBackground(true);
        }
    }, [locked, mapInstance, toggleBackground]);

    const contextValue: MapContextValue = {
        map: mapInstance,
        city,
        zoomIn,
        zoomOut,
        reset,
        toggleBackground,
        selectedEdgeId,
        setSelectedEdgeId,
        layerState,
        setLayerState,
        setLayerRetry,
        helpOpen,
        helpAnchor,
        openMapHelp,
        closeMapHelp,
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
                    {/* Separated header — hidden on mobile */}
                    {!isMobile && !locked && (
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
                                        {titleText}
                                    </h1>
                                </div>

                                <MapControls
                                    colorScheme={colorScheme}
                                    onHelpClick={() => helpOpen ? closeMapHelp() : openMapHelp()}
                                />
                            </div>
                        </div>
                    )}

                    {/* Mobile: vertical MapControls floating at bottom-RIGHT */}
                    {isMobile && !locked && (
                        <div
                            className="absolute right-4 z-20 transition-all duration-300"
                            style={{ bottom: `${bottomOffset + 12}px` }}
                        >
                            <MapControls
                                colorScheme={colorScheme}
                                vertical
                                onHelpClick={() => helpOpen ? closeMapHelp() : openMapHelp()}
                            />
                        </div>
                    )}

                    {/* Map canvas */}
                    <div className={`z-10 ${isMobile ? 'absolute inset-0' : 'relative flex-1 min-h-0 pb-4'}`} style={locked ? { pointerEvents: 'none' } : undefined}>
                        <div
                            className={`w-full h-full overflow-hidden transition-all duration-500 ${isMobile ? '' : 'rounded-2xl'}`}
                            style={isMobile ? {} : { border: '1px solid rgba(0, 0, 0, 0.25)' }}
                        >
                            <CityCanvas
                                city={city}
                                onMapInstance={setMapInstance}
                                layerState={layerState}
                                onRetry={retryLayerRequest}
                                primaryColor={colorScheme.primary}
                            />
                        </div>
                    </div>

                    {/* Map help panel */}
                    {!locked && <MapHelpPanel />}

                    {/* Legend — floats over canvas */}
                    {!locked && <CityLegend colorScheme={colorScheme} bottomOffset={bottomOffset} defaultOpen={!isMobile} />}
                </div>
            </ThresholdsContext.Provider>
        </MapContext.Provider>
    );
};

export default CityMap;
