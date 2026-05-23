import { useRef, useEffect, useState, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import { useMapState } from '../../../hooks/useMapState';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { CityData } from '../../../constants/cities';
import { TILE_SERVER_URL } from '../../../config/api';
import ActiveLayer from './ActiveLayer';
import LoadingContainer from '../../ui/LoadingContainer';
import ErrorContainer from '../../ui/ErrorContainer';

import { MAP_MODES } from '../../../constants/mapModes';

interface CityCanvasProps {
    city: CityData;
    onMapInstance: (map: maplibregl.Map | null) => void;
    layerState?: 'idle' | 'loading' | 'error' | 'empty';
    onRetry?: () => void;
    primaryColor?: string;
}

/**
 * Shell component that initialises the MapLibre map.
 * Reports the map instance to the parent via onMapInstance so it can be 
 * shared via MapContext to siblings like Legend and Controls.
 */
export default function CityCanvas({ city, onMapInstance, layerState = 'idle', onRetry, primaryColor = '#027A76' }: CityCanvasProps) {
    const { mode } = useMapState();
    const mapContainer = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const [mapReady, setMapReady] = useState(false);
    const [loading, setLoading] = useState(true);

    const hasValidCoords = city.geoCoords &&
        city.geoCoords.latitude !== null &&
        city.geoCoords.longitude !== null &&
        (city.geoCoords.latitude !== 0 || city.geoCoords.longitude !== 0);

    // All modes use a fixed radius so data is navigable without bounds restrictions.
    const bounds = useMemo(() => {
        if (!hasValidCoords) return null;
        const lat = city.geoCoords.latitude;
        const lon = city.geoCoords.longitude;
        const radiusKm = 50;
        const latDelta = radiusKm / 111.32;
        const lonDelta = radiusKm / (111.32 * Math.cos(lat * (Math.PI / 180)));
        return [
            [lon - lonDelta, lat - latDelta],
            [lon + lonDelta, lat + latDelta]
        ] as [[number, number], [number, number]];
    }, [city.geoCoords.latitude, city.geoCoords.longitude, hasValidCoords]);

    useEffect(() => {
        if (!mapContainer.current || !hasValidCoords) return;

        let mounted = true;

        const mapInstance = new maplibregl.Map({
            container: mapContainer.current,
            style: {
                version: 8,
                name: 'Clean',
                sources: {
                    'carto-nolabels': {
                        type: 'raster',
                        tiles: [
                            'https://a.basemaps.cartocdn.com/rastertiles/light_nolabels/{z}/{x}/{y}@2x.png',
                            'https://b.basemaps.cartocdn.com/rastertiles/light_nolabels/{z}/{x}/{y}@2x.png',
                            'https://c.basemaps.cartocdn.com/rastertiles/light_nolabels/{z}/{x}/{y}@2x.png',
                        ],
                        tileSize: 256,
                        attribution: '© CARTO',
                    },
                    'carto-labels': {
                        type: 'raster',
                        tiles: [
                            'https://a.basemaps.cartocdn.com/rastertiles/light_only_labels/{z}/{x}/{y}@2x.png',
                            'https://b.basemaps.cartocdn.com/rastertiles/light_only_labels/{z}/{x}/{y}@2x.png',
                            'https://c.basemaps.cartocdn.com/rastertiles/light_only_labels/{z}/{x}/{y}@2x.png',
                        ],
                        tileSize: 256,
                    },
                },
                layers: [
                    { id: 'background', type: 'background', paint: { 'background-color': '#FBF6EF' } } as any,
                    { id: 'carto-base-layer', type: 'raster', source: 'carto-nolabels', minzoom: 0, maxzoom: 19, layout: { visibility: 'visible' } } as any,
                ],
            },
            center: [city.geoCoords.longitude, city.geoCoords.latitude],
            zoom: 13,
            minZoom: 11,
            maxBounds: bounds || undefined,
            pitch: 0,
            bearing: 0,
            dragRotate: false,
            scrollZoom: true,
            cooperativeGestures: true,
            pitchWithRotate: false,
            attributionControl: false,
        });

        mapRef.current = mapInstance;

        mapInstance.on('load', () => {
            if (!mounted) return;

            // Hard-lock rotation / pitch
            mapInstance.dragRotate.disable();
            mapInstance.touchZoomRotate.disableRotation();
            mapInstance.touchPitch.disable();
            mapInstance.keyboard.disableRotation();

            mapInstance.addSource('martin-features', {
                type: 'vector',
                tiles: [`${TILE_SERVER_URL}/features/{z}/{x}/{y}`],
                minzoom: 0, maxzoom: 22,
            });

            // Static background layers (shared across all modes)
            const baseLayers = [
                { id: 'sea-layer', type: 'fill', filter: ['all', ['==', ['get', 'feature_type'], 'sea'], ['==', ['get', 'city_id'], city.id as number]], paint: { 'fill-color': '#a4b7ca' } },
                { id: 'coastline-layer', type: 'line', filter: ['all', ['==', ['get', 'feature_type'], 'coastline'], ['==', ['get', 'city_id'], city.id as number]], paint: { 'line-color': '#a4b7ca', 'line-width': 1 } },
                { id: 'waterways-layer', type: 'fill', filter: ['all', ['==', ['get', 'feature_type'], 'waterways'], ['==', ['get', 'city_id'], city.id as number]], paint: { 'fill-color': '#a4b7ca' } },
                { id: 'forest-layer', type: 'fill', filter: ['all', ['==', ['get', 'feature_type'], 'forest'], ['==', ['get', 'city_id'], city.id as number]], paint: { 'fill-color': '#dde5e4' } },
                { id: 'buildings-layer', type: 'fill', filter: ['all', ['==', ['get', 'feature_type'], 'buildings'], ['==', ['get', 'city_id'], city.id as number]], paint: { 'fill-color': '#ead5c5' } },
                { id: 'bike-path-buildings-layer', type: 'fill', filter: ['all', ['==', ['get', 'feature_type'], 'bike_path_buildings'], ['==', ['get', 'city_id'], city.id as number]], paint: { 'fill-color': '#ead5c5' } },
                { id: 'bike-paths-layer', type: 'line', filter: ['all', ['==', ['get', 'feature_type'], 'bike_paths'], ['==', ['get', 'city_id'], city.id as number]], paint: { 'line-color': '#00cac3', 'line-width': 2 } },
            ];

            baseLayers.forEach(def => {
                const initialVisibility = (def.id === 'bike-paths-layer') ? 'none' : 'visible';
                mapInstance.addLayer({
                    ...def,
                    source: 'martin-features',
                    'source-layer': 'features',
                    layout: { ...((def as any).layout || {}), visibility: initialVisibility },
                } as any);
            });

            // Stations GeoJSON source
            mapInstance.addSource('stations-source', {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] },
            });
            mapInstance.addLayer({
                id: 'stations-layer',
                type: 'circle',
                source: 'stations-source',
                layout: { visibility: 'none' },
                paint: {
                    'circle-radius': 6,
                    'circle-color': '#A0AEC0',
                    'circle-stroke-width': 2,
                    'circle-stroke-color': '#FFFFFF',
                },
            });

            // Edges vector source for traffic.
            // Initialized with the parameterless edges_with_traffic URL (trip_count=0 for
            // all edges) so MapLibre never fires 404 requests against the non-existent
            // /edges/ endpoint. TrafficLayer calls setTiles() after resolving
            // (generation_type, algorithm, month) to swap in the parameterised URL.
            // promoteId is still needed for feature-state selection highlight.
            mapInstance.addSource('edges-source', {
                type: 'vector',
                tiles: [`${TILE_SERVER_URL}/edges_with_traffic/{z}/{x}/{y}`],
                minzoom: 0, maxzoom: 22,
                promoteId: 'id',
            });
            mapInstance.addLayer({
                id: 'traffic-layer',
                type: 'line',
                source: 'edges-source',
                'source-layer': 'edges',
                layout: { visibility: 'none' },
                filter: ['==', ['get', 'city_id'], city.id as number],
                paint: {
                    'line-width': [
                        'case',
                        ['==', ['feature-state', 'selected'], true], 5,
                        1.5,
                    ],
                    // TrafficLayer.setPaintProperty replaces color+opacity with
                    // percentile-based expressions that read ['get','trip_count'] from tiles
                    'line-color': [
                        'case',
                        ['==', ['feature-state', 'selected'], true], '#f0c040',
                        '#edf8e9',
                    ],
                    'line-opacity': 0,
                },
            });

            // Labels added last so they sit on top of all geometry layers by default.
            // toggleBackground also calls moveLayer to keep them on top after mode layers are added.
            mapInstance.addLayer({
                id: 'carto-labels-layer', type: 'raster', source: 'carto-labels',
                minzoom: 0, maxzoom: 19, layout: { visibility: 'visible' },
            });

            setLoading(false);
            setMapReady(true);
            onMapInstance(mapInstance);
        });

        return () => {
            mounted = false;
            onMapInstance(null);
            mapRef.current = null;
            setMapReady(false);
            setLoading(true);
            // Synchronous removal is safe because:
            // - React cleanups run child→parent, so AccidentsLayer (child) already
            //   removed its layer/source before this runs on real unmount.
            // - On StrictMode's simulated cleanup, mapReady was never true (load
            //   was blocked by the mounted guard), so <ActiveLayer> was never
            //   mounted and there are no child effects accessing this map's style.
            mapInstance.remove();
        };
    }, [city.geoCoords.latitude, city.geoCoords.longitude, city.id]);

    // Update bounds dynamically when mode changes without re-initializing the whole map
    useEffect(() => {
        if (mapRef.current && bounds) {
            mapRef.current.setMaxBounds(bounds);
        }
    }, [bounds]);

    return (
        <div className="relative w-full h-full bg-[var(--blue-dark)] flex items-center justify-center">
            {hasValidCoords ? (
                <>
                    <div ref={mapContainer} className="w-full h-full" />
                    {(loading || layerState === 'loading') && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/10 backdrop-blur-[2px] z-10 transition-all duration-500">
                            <LoadingContainer 
                                className="w-52 h-52" 
                                color={mode === MAP_MODES.STATIONS ? '#AF4749' : primaryColor} 
                            />
                        </div>
                    )}
                    {layerState === 'error' && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm z-10">
                            <ErrorContainer 
                                title="Error cargando datos"
                                message="No se pudieron cargar los datos de esta capa. Por favor, inténtelo de nuevo."
                                showRetry={!!onRetry}
                                onRetry={onRetry}
                                variant="inline"
                                className="bg-white p-6 rounded-xl shadow-xl max-w-sm"
                            />
                        </div>
                    )}
                    {layerState === 'empty' && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm z-10">
                            <div className="bg-white p-6 rounded-xl shadow-xl text-center max-w-sm flex flex-col items-center gap-2">
                                <h3 className="text-lg font-bold text-slate-800">Sin datos</h3>
                                <p className="text-sm text-slate-600 mb-2">No hay datos disponibles para este modo en {city.name}.</p>
                                {onRetry && (
                                    <button 
                                        onClick={onRetry}
                                        className="px-4 py-2 text-white rounded-lg font-semibold transition-colors"
                                        style={{ backgroundColor: primaryColor }}
                                    >
                                        Recargar
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                    {/* ActiveLayer mounts only after map load — critical for MapLibre */}
                    {mapReady && <ActiveLayer />}
                </>
            ) : (
                <div className="flex flex-col items-center gap-4 p-8 text-center max-w-sm">
                    <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-2 animate-pulse">
                        <span className="text-3xl">📍</span>
                    </div>
                    <h3 className="text-lg font-bold text-white tracking-tight">Geographic Data Unavailable</h3>
                    <p className="text-sm text-slate-400 leading-relaxed">
                        The coordinates for <span className="text-[var(--blue)] font-bold">{city.name}</span> are not set in the database.
                        Run the city ingestion script to update.
                    </p>
                </div>
            )}
        </div>
    );
}
