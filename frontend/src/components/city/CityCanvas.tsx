import { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { CityData } from '../../constants/cities';
import { TILE_SERVER_URL } from '../../config/api';
import ErrorState from '../ui/ErrorState';
import Spinner from '../ui/Spinner';

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
                zoom: 14,
                bearing: city.angle || 0,
                pitch: 0,
                duration: 1000
            });
        },
        toggleBackground: (show: boolean) => {
            const visibility = show ? 'visible' : 'none';
            if (map.current?.getLayer('carto-base-layer')) {
                map.current.setLayoutProperty('carto-base-layer', 'visibility', visibility);
            }
            if (map.current?.getLayer('carto-labels-layer')) {
                map.current.setLayoutProperty('carto-labels-layer', 'visibility', visibility);
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
                    'carto-nolabels': {
                        type: 'raster',
                        tiles: [
                            'https://a.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}@2x.png',
                            'https://b.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}@2x.png',
                            'https://c.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}@2x.png',
                        ],
                        tileSize: 256,
                        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
                    },
                },
                layers: [
                    {
                        id: 'carto-base-layer',
                        type: 'raster',
                        source: 'carto-nolabels',
                        minzoom: 0,
                        maxzoom: 19,
                        layout: { visibility: 'none' },
                    },
                ],
            },
            center: [city.geoCoords.longitude, city.geoCoords.latitude],
            zoom: 14.5,
            bearing: city.angle || 0,
            minZoom: 13,
            maxZoom: 22,
            maxBounds: city.maxBounds,
        });

        // Disable scroll zoom as requested
        mapInstance.scrollZoom.disable();

        map.current = mapInstance;

        mapInstance.on('load', async () => {
            try {
                // Calculate rectangular boundary (8x10km) centered on city
                const generateRectBoundary = (lon: number, lat: number, angleDeg: number) => {
                    const widthLimit = 8000;  // 8km
                    const heightLimit = 10000; // 10km
                    
                    // Convert degrees to radians
                    const angleRad = (angleDeg * Math.PI) / 180;
                    
                    // Meters per degree (approximate for the current latitude)
                    const metersPerLat = 111320;
                    const metersPerLon = 111320 * Math.cos((lat * Math.PI) / 180);
                    
                    // Unrotated corners offset in meters
                    const offsets = [
                        [-widthLimit / 2, -heightLimit / 2],
                        [widthLimit / 2, -heightLimit / 2],
                        [widthLimit / 2, heightLimit / 2],
                        [-widthLimit / 2, heightLimit / 2],
                        [-widthLimit / 2, -heightLimit / 2] // Close the polygon
                    ];
                    
                    // Rotate and convert to coordinates
                    const coords = offsets.map(([dx, dy]) => {
                        // Rotate clockwise: 
                        // x' = x*cos(theta) + y*sin(theta)
                        // y' = -x*sin(theta) + y*cos(theta)
                        const rx = dx * Math.cos(angleRad) + dy * Math.sin(angleRad);
                        const ry = -dx * Math.sin(angleRad) + dy * Math.cos(angleRad);
                        
                        return [
                            lon + rx / metersPerLon,
                            lat + ry / metersPerLat
                        ];
                    });
                    
                    return {
                        type: 'Feature',
                        geometry: {
                            type: 'Polygon',
                            coordinates: [coords]
                        },
                        properties: { feature_type: 'boundary' }
                    };
                };

                const rectBoundary = generateRectBoundary(
                    city.geoCoords.longitude, 
                    city.geoCoords.latitude, 
                    city.angle || 0
                );

                // Calculate a "mask" polygon (world-wide polygon with a hole for the city region)
                const generateFocusMask = (boundaryCoords: number[][]) => {
                    const worldCoords = [
                        [-180, -90],
                        [180, -90],
                        [180, 90],
                        [-180, 90],
                        [-180, -90]
                    ];
                    return {
                        type: 'Feature',
                        geometry: {
                            type: 'Polygon',
                            coordinates: [worldCoords, boundaryCoords]
                        }
                    };
                };

                const focusMask = generateFocusMask(rectBoundary.geometry.coordinates[0]);

                // Calculate bounding box for maxBounds
                const lons = rectBoundary.geometry.coordinates[0].map(c => c[0]);
                const lats = rectBoundary.geometry.coordinates[0].map(c => c[1]);
                const padding = 0.01; // Small buffer for movement
                const bounds: [number, number, number, number] = [
                    Math.min(...lons) - padding,
                    Math.min(...lats) - padding,
                    Math.max(...lons) + padding,
                    Math.max(...lats) + padding
                ];

                mapInstance.setMaxBounds([
                    [bounds[0], bounds[1]],
                    [bounds[2], bounds[3]]
                ]);

                // Add Sources
                mapInstance.addSource('viewport-boundary', {
                    type: 'geojson',
                    data: rectBoundary as any
                });

                mapInstance.addSource('focus-mask', {
                    type: 'geojson',
                    data: focusMask as any
                });

                mapInstance.addSource('martin-features', {
                    type: 'vector',
                    tiles: [`${TILE_SERVER_URL}/features/{z}/{x}/{y}`],
                    minzoom: 0,
                    maxzoom: 22
                });

                // 1. Focus Mask (Bottommost focus layer)
                mapInstance.addLayer({
                    id: 'focus-mask-layer',
                    type: 'fill',
                    source: 'focus-mask',
                    paint: {
                        'fill-color': '#000000',
                        'fill-opacity': 0.4,
                    },
                });

                // 2. Sea
                mapInstance.addLayer({
                    id: 'sea-layer',
                    type: 'fill',
                    source: 'martin-features',
                    'source-layer': 'features',
                    filter: ['==', ['get', 'feature_type'], 'sea'],
                    paint: {
                        'fill-color': '#a4b7ca',
                        'fill-opacity': 1,
                    },
                });
                
                // 3. Coastline
                mapInstance.addLayer({
                    id: 'coastline-layer',
                    type: 'line',
                    source: 'martin-features',
                    'source-layer': 'features',
                    filter: ['==', ['get', 'feature_type'], 'coastline'],
                    paint: {
                        'line-color': '#a4b7ca',
                        'line-width': 1,
                        'line-opacity': 1,
                    },
                });

                // 4. Waterways
                mapInstance.addLayer({
                    id: 'waterways-layer',
                    type: 'fill',
                    source: 'martin-features',
                    'source-layer': 'features',
                    filter: ['==', ['get', 'feature_type'], 'waterways'],
                    paint: {
                        'fill-color': '#a4b7ca',
                        'fill-opacity': 1,
                    },
                });

                // 5. Forest
                mapInstance.addLayer({
                    id: 'forest-layer',
                    type: 'fill',
                    source: 'martin-features',
                    'source-layer': 'features',
                    filter: ['==', ['get', 'feature_type'], 'forest'],
                    paint: {
                        'fill-color': '#dde5e4',
                        'fill-opacity': 1,
                    },
                });

                // 6. Buildings
                mapInstance.addLayer({
                    id: 'buildings-layer',
                    type: 'fill',
                    source: 'martin-features',
                    'source-layer': 'features',
                    filter: ['==', ['get', 'feature_type'], 'buildings'],
                    paint: {
                        'fill-color': '#ead5c5',
                        'fill-opacity': 1,
                    },
                });

                // 7. Bike Path Buildings
                mapInstance.addLayer({
                    id: 'bike-path-buildings-layer',
                    type: 'fill',
                    source: 'martin-features',
                    'source-layer': 'features',
                    filter: ['==', ['get', 'feature_type'], 'bike_path_buildings'],
                    paint: {
                        'fill-color': '#027A76',
                        'fill-opacity': 1,
                    },
                });

                // 8. City Boundary (Rectangular)
                mapInstance.addLayer({
                    id: 'boundary-layer-rect',
                    type: 'line',
                    source: 'viewport-boundary',
                    paint: {
                        'line-color': '#4a5568',
                        'line-width': 1.5,
                        'line-dasharray': [4, 2],
                        'line-opacity': 1,
                    },
                });

                // 9. Bike Paths
                mapInstance.addLayer({
                    id: 'bike-paths-layer',
                    type: 'line',
                    source: 'martin-features',
                    'source-layer': 'features',
                    filter: ['==', ['get', 'feature_type'], 'bike_paths'],
                    paint: {
                        'line-color': '#00cac3',
                        'line-width': 1,
                        'line-opacity': 1,
                    },
                });

                // Add a glow/halo effect for bike paths
                mapInstance.addLayer({
                    id: 'bike-paths-glow',
                    type: 'line',
                    source: 'martin-features',
                    'source-layer': 'features',
                    filter: ['==', ['get', 'feature_type'], 'bike_paths'],
                    paint: {
                        'line-color': '#00cac3',
                        'line-width': 10,
                        'line-opacity': 0.5,
                        'line-blur': 8,
                    },
                });

                // 10. Labels (always on top via separate source)
                mapInstance.addSource('carto-labels', {
                    type: 'raster',
                    tiles: [
                        'https://a.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}@2x.png',
                        'https://b.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}@2x.png',
                        'https://c.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}@2x.png',
                    ],
                    tileSize: 256,
                });
                mapInstance.addLayer({
                    id: 'carto-labels-layer',
                    type: 'raster',
                    source: 'carto-labels',
                    minzoom: 0,
                    maxzoom: 19,
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
            <div ref={mapContainer} className="w-full h-full" style={{ backgroundColor: '#FBF6EF' }} />

            {/* Loading overlay */}
            {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-10">
                    <div className="text-center">
                        <Spinner
                            className="w-16 h-16 mx-auto mb-4"
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
                    <ErrorState
                        title="Failed to load map"
                        message={error}
                        showRetry={true}
                    />
                </div>
            )}
        </div>
    );
});

export default CityCanvas;
