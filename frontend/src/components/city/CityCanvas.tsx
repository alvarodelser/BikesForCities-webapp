import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { CityData } from '../../constants/cities';

const API_BASE = 'http://localhost:8000/api';

interface CityCanvasProps {
    city: CityData;
    selectedMode: string;
    colorScheme: { primary: string; secondary: string; accent: string; light: string };
}

export interface CityCanvasHandle {
    zoomIn: () => void;
    zoomOut: () => void;
    reset: () => void;
    toggleBackground: (show: boolean) => void;
}

const CityCanvas = forwardRef<CityCanvasHandle, CityCanvasProps>(({ city, colorScheme }, ref) => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<maplibregl.Map | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useImperativeHandle(ref, () => ({
        zoomIn: () => {
            map.current?.zoomIn();
        },
        zoomOut: () => {
            map.current?.zoomOut();
        },
        reset: () => {
            map.current?.easeTo({
                center: [city.geoCoords.longitude, city.geoCoords.latitude],
                zoom: 13,
                bearing: 0,
                pitch: 0,
                duration: 1000
            });
        },
        toggleBackground: (show: boolean) => {
            if (map.current && map.current.getLayer('carto-dark-layer')) {
                map.current.setLayoutProperty(
                    'carto-dark-layer',
                    'visibility',
                    show ? 'visible' : 'none'
                );
            }
        }
    }));

    useEffect(() => {
        if (!mapContainer.current) return;

        // Initialize MapLibre map
        const mapInstance = new maplibregl.Map({
            container: mapContainer.current,
            style: {
                version: 8,
                name: 'Dark',
                sources: {
                    'carto-dark': {
                        type: 'raster',
                        tiles: [
                            'https://a.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}@2x.png',
                            'https://b.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}@2x.png',
                            'https://c.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}@2x.png',
                        ],
                        tileSize: 256,
                        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
                    },
                },
                layers: [
                    {
                        id: 'carto-dark-layer',
                        type: 'raster',
                        source: 'carto-dark',
                        minzoom: 0,
                        maxzoom: 19,
                        layout: {
                            visibility: 'none'
                        }
                    },
                ],
            },
            center: [city.geoCoords.longitude, city.geoCoords.latitude],
            zoom: 13,
        });

        // Disable scroll zoom as requested
        mapInstance.scrollZoom.disable();

        map.current = mapInstance;

        mapInstance.on('load', async () => {
            try {
                // Fetch features GeoJSON from the backend (network_id=1 for Madrid)
                const [bikePathsRes, bikePathBuildingsRes, buildingsRes] = await Promise.all([
                    fetch(`${API_BASE}/networks/1/features/geojson?feature_type=bike_paths&limit=50000`),
                    fetch(`${API_BASE}/networks/1/features/geojson?feature_type=bike_path_buildings&limit=100000`),
                    fetch(`${API_BASE}/networks/1/features/geojson?feature_type=buildings&limit=350000`),
                ]);

                if (!bikePathsRes.ok || !bikePathBuildingsRes.ok || !buildingsRes.ok) {
                    throw new Error(`API error loading features`);
                }

                const [bikePathsData, bikePathBuildingsData, buildingsData] = await Promise.all([
                    bikePathsRes.json(),
                    bikePathBuildingsRes.json(),
                    buildingsRes.json(),
                ]);

                // 1. All Buildings (Background, dark grey)
                mapInstance.addSource('buildings', {
                    type: 'geojson',
                    data: buildingsData.data,
                });
                mapInstance.addLayer({
                    id: 'buildings-layer',
                    type: 'fill',
                    source: 'buildings',
                    paint: {
                        'fill-color': '#111111',
                        'fill-opacity': 0.4,
                    },
                });

                // 2. Bike Path Buildings (Coverage, green)
                mapInstance.addSource('bike-path-buildings', {
                    type: 'geojson',
                    data: bikePathBuildingsData.data,
                });
                mapInstance.addLayer({
                    id: 'bike-path-buildings-layer',
                    type: 'fill',
                    source: 'bike-path-buildings',
                    paint: {
                        'fill-color': '#027A76',
                        'fill-opacity': 0.8,
                    },
                });

                // 3. Bike Paths (Lines, bright cyan)
                mapInstance.addSource('bike-paths', {
                    type: 'geojson',
                    data: bikePathsData.data,
                });
                mapInstance.addLayer({
                    id: 'bike-paths-layer',
                    type: 'line',
                    source: 'bike-paths',
                    paint: {
                        'line-color': '#00cac3',
                        'line-width': 2.5,
                        'line-opacity': 1,
                    },
                });

                // Add a glow/halo effect for bike paths
                mapInstance.addLayer({
                    id: 'bike-paths-glow',
                    type: 'line',
                    source: 'bike-paths',
                    paint: {
                        'line-color': '#00cac3',
                        'line-width': 6,
                        'line-opacity': 0.3,
                        'line-blur': 4,
                    },
                });

                setLoading(false);
            } catch (err) {
                console.error('Failed to load map data:', err);
                setError(err instanceof Error ? err.message : 'Failed to load map data');
                setLoading(false);
            }
        });

        // Cleanup
        return () => {
            mapInstance.remove();
            map.current = null;
        };
    }, [city.geoCoords.latitude, city.geoCoords.longitude]);

    return (
        <div className="relative w-full h-full">
            <div ref={mapContainer} className="w-full h-full" />

            {/* Loading overlay */}
            {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-10">
                    <div className="text-center">
                        <div
                            className="w-16 h-16 rounded-full border-4 border-t-transparent animate-spin mx-auto mb-4"
                            style={{ borderColor: `${colorScheme.accent} transparent ${colorScheme.primary} transparent` }}
                        />
                        <p className="text-white text-lg font-medium">Loading {city.name} network...</p>
                        <p className="text-white/60 text-sm mt-1">Fetching road topology from database</p>
                    </div>
                </div>
            )}

            {/* Error overlay */}
            {error && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-10">
                    <div className="bg-red-900/80 border border-red-500/50 rounded-xl p-6 max-w-md text-center">
                        <p className="text-red-200 text-lg font-medium mb-2">Failed to load map</p>
                        <p className="text-red-300/70 text-sm">{error}</p>
                    </div>
                </div>
            )}
        </div>
    );
});

export default CityCanvas;
