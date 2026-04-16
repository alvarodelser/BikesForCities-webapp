import { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { CityData } from '../../constants/cities';
import { TILE_SERVER_URL } from '../../config/api';
import ErrorState from '../ui/ErrorState';
import Spinner from '../ui/Spinner';
import { fetchStations, fetchTraffic } from '../../services/api';
import type { StationData, TrafficCount } from '../../services/api';

export interface CityCanvasHandle {
    zoomIn: () => void;
    zoomOut: () => void;
    reset: () => void;
    toggleBackground: (show: boolean) => void;
}

interface CityCanvasProps {
    city: CityData;
    selectedMode: string;
    activeMetric: 'trips' | 'downtime';
    colorScheme: { primary: string; secondary: string; accent: string; light: string };
    showBikePathBuildings?: boolean;
    onThresholdsChange?: (thresholds: { q5: number; q50: number; q95: number; max: number; min: number }) => void;
}

// Helper to interpolate between two hex colors
const interpolateColor = (color1: string, color2: string, factor: number) => {
    const r1 = parseInt(color1.substring(1, 3), 16);
    const g1 = parseInt(color1.substring(3, 5), 16);
    const b1 = parseInt(color1.substring(5, 7), 16);

    const r2 = parseInt(color2.substring(1, 3), 16);
    const g2 = parseInt(color2.substring(3, 5), 16);
    const b2 = parseInt(color2.substring(5, 7), 16);

    const r = Math.round(r1 + factor * (r2 - r1));
    const g = Math.round(g1 + factor * (g2 - g1));
    const b = Math.round(b1 + factor * (b2 - b1));

    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};

// Helper for popup color matching MapLibre logic
const getMetricColor = (val: number, q5: number, q50: number, q95: number, metric: 'trips' | 'downtime') => {
    if (val < q5) return '#A0AEC0';
    if (val > q95) return metric === 'trips' ? '#042F2E' : '#450A0A';
    
    const colors = metric === 'trips' 
        ? ['#D1FAE5', '#34D399', '#065F46'] 
        : ['#FEE2E2', '#EF4444', '#7F1D1D'];

    if (val < q50) {
        const factor = (val - q5) / (q50 - q5 || 1);
        return interpolateColor(colors[0], colors[1], Math.max(0, Math.min(1, factor)));
    } else {
        const factor = (val - q50) / (q95 - q50 || 1);
        return interpolateColor(colors[1], colors[2], Math.max(0, Math.min(1, factor)));
    }
};

const CityCanvas = forwardRef<CityCanvasHandle, CityCanvasProps>(({ 
    city, 
    selectedMode, 
    activeMetric,
    showBikePathBuildings = true,
    onThresholdsChange
}, ref) => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<maplibregl.Map | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [stations, setStations] = useState<StationData[]>([]);
    const [trafficData, setTrafficData] = useState<TrafficCount[]>([]);
    const [styleLoaded, setStyleLoaded] = useState(false);

    useImperativeHandle(ref, () => ({
        zoomIn: () => {
            map.current?.zoomIn();
        },
        zoomOut: () => {
            map.current?.zoomOut();
        },
        reset: () => {
            const generateRectBoundary = (lon: number, lat: number, angleDeg: number) => {
                const limit = 10000;
                const angleRad = (angleDeg * Math.PI) / 180;
                const metersPerLat = 111320;
                const metersPerLon = 111320 * Math.cos((lat * Math.PI) / 180);
                const offsets = [[-limit / 2, -limit / 2], [limit / 2, -limit / 2], [limit / 2, limit / 2], [-limit / 2, limit / 2]];
                const coords = offsets.map(([dx, dy]) => [
                    lon + (dx * Math.cos(angleRad) + dy * Math.sin(angleRad)) / metersPerLon,
                    lat + (-dx * Math.sin(angleRad) + dy * Math.cos(angleRad)) / metersPerLat
                ]);
                return coords;
            };
            const coords = generateRectBoundary(city.geoCoords.longitude, city.geoCoords.latitude, city.angle || 0);
            const lons = coords.map(c => c[0]);
            const lats = coords.map(c => c[1]);
            const bounds: [number, number, number, number] = [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];

            map.current?.fitBounds([[bounds[0], bounds[1]], [bounds[2], bounds[3]]], {
                padding: 40,
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

    // Data fetching
    useEffect(() => {
        const loadStations = async () => {
            if (!city.id) return;
            setLoading(true);
            setStations([]); // Clear previous stations
            try {
                const data = await fetchStations(city.id);
                setStations(data);
            } catch (err) {
                console.error('Failed to load stations:', err);
                setError('No se pudieron cargar las estaciones.');
            } finally {
                setLoading(false);
            }
        };
        loadStations();
    }, [city.id]);

    useEffect(() => {
        const loadTraffic = async () => {
            if (!city.id || selectedMode !== 'traffic') return;
            try {
                const data = await fetchTraffic(city.id);
                setTrafficData(data);
            } catch (err) {
                console.error('Failed to load traffic data:', err);
            }
        };
        loadTraffic();
    }, [city.id, selectedMode]);

    // Visibility logic manager
    const updateVisibility = (m: maplibregl.Map, mode: string, showBuildings: boolean) => {
        const stationsVisibility = mode === 'stations' ? 'visible' : 'none';
        const infraVisibility = mode === 'infrastructure' ? 'visible' : 'none';

        if (m.getLayer('stations-layer')) m.setLayoutProperty('stations-layer', 'visibility', stationsVisibility);
        if (m.getLayer('bike-paths-layer')) m.setLayoutProperty('bike-paths-layer', 'visibility', infraVisibility);
        
        const trafficVisibility = mode === 'traffic' ? 'visible' : 'none';
        if (m.getLayer('traffic-layer')) m.setLayoutProperty('traffic-layer', 'visibility', trafficVisibility);

        // Update buildings highlight color
        const buildingsLayerId = 'bike-path-buildings-layer';
        if (m.getLayer(buildingsLayerId)) {
            const targetColor = (mode === 'infrastructure' && showBuildings) ? '#027A76' : '#ead5c5';
            m.setPaintProperty(buildingsLayerId, 'fill-color', targetColor);
        }
    };

    useEffect(() => {
        if (!map.current || !styleLoaded) return;
        updateVisibility(map.current, selectedMode, showBikePathBuildings);
    }, [selectedMode, styleLoaded, showBikePathBuildings]);

    // Sync stations data to map source and update dynamic scale
    useEffect(() => {
        if (!map.current || !styleLoaded) return;
        const m = map.current;

        const source = m.getSource('stations-source') as maplibregl.GeoJSONSource;
        if (source) {
            const features = stations.map(s => {
                const usage = s.estimated_monthly_trips || 0;
                let normalizedName = (s.name || 'Sin nombre')
                    .replace(/^[^a-zA-Z\xC0-\xFF]+/, '')
                    .toLowerCase()
                    .split(/[\s_-]+/)
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(' ');

                return {
                    type: 'Feature' as const,
                    geometry: { type: 'Point' as const, coordinates: [s.lon, s.lat] },
                    properties: { 
                        name: normalizedName, 
                        id: s.station_id,
                        usage: usage,
                        downtime: s.downtime_minutes || 0
                    }
                };
            });
            source.setData({ type: 'FeatureCollection', features });

            const usages = stations.map(s => (activeMetric === 'trips' ? s.estimated_monthly_trips : s.downtime_minutes) || 0).sort((a, b) => a - b);
            if (usages.length > 0) {
                const q5 = usages[Math.floor(usages.length * 0.05)] || 5;
                const q50 = usages[Math.floor(usages.length * 0.5)] || 20;
                const q95 = usages[Math.floor(usages.length * 0.95)] || 100;
                const max = Math.max(...usages);
                const min = Math.min(...usages);

                const metricProp = activeMetric === 'trips' ? 'usage' : 'downtime';
                const extremeColor = activeMetric === 'trips' ? '#042F2E' : '#450A0A';
                const gradientColors = activeMetric === 'trips' 
                    ? ['#D1FAE5', '#34D399', '#065F46'] 
                    : ['#FEE2E2', '#EF4444', '#7F1D1D'];

                m.setPaintProperty('stations-layer', 'circle-color', [
                    'case',
                    ['<', ['get', metricProp], q5], '#A0AEC0',
                    ['>', ['get', metricProp], q95], extremeColor,
                    [
                        'interpolate',
                        ['linear'],
                        ['get', metricProp],
                        q5, gradientColors[0],
                        q50, gradientColors[1],
                        q95, gradientColors[2]
                    ]
                ]);

                if (onThresholdsChange) {
                    onThresholdsChange({ q5, q50, q95, max, min });
                }
            }
        }
    }, [stations, styleLoaded, activeMetric, onThresholdsChange]);

    // Sync traffic data to feature state
    useEffect(() => {
        if (!map.current || !styleLoaded || trafficData.length === 0) return;
        const m = map.current;

        trafficData.forEach(t => {
            m.setFeatureState(
                { source: 'edges-source', sourceLayer: 'edges', id: t.edge_id },
                { trip_count: t.trip_count }
            );
        });

        // Calculate thresholds for legend if in traffic mode
        if (selectedMode === 'traffic' && onThresholdsChange) {
            const counts = trafficData.map(t => t.trip_count).sort((a, b) => a - b);
            if (counts.length > 0) {
                const q5 = counts[Math.floor(counts.length * 0.05)];
                const q50 = counts[Math.floor(counts.length * 0.5)];
                const q95 = counts[Math.floor(counts.length * 0.95)];
                onThresholdsChange({
                    q5, q50, q95,
                    max: Math.max(...counts),
                    min: Math.min(...counts)
                });
            }
        }
    }, [trafficData, styleLoaded, selectedMode]);
    
    // Reactive event listeners for station popups
    useEffect(() => {
        if (!map.current || !styleLoaded) return;
        const m = map.current;
        const popup = (m as any)._popup as maplibregl.Popup;
        if (!popup) return;

        const onMouseEnter = (e: maplibregl.MapLayerMouseEvent) => {
            m.getCanvas().style.cursor = 'pointer';
            const features = e.features;
            if (!features || features.length === 0) return;
            
            const coordinates = (features[0].geometry as any).coordinates.slice();
            const props = features[0].properties!;
            const name = props.name;
            const usage = props.usage || 0;
            const downtime = props.downtime || 0;

            const activeUsages = stations.map(s => (activeMetric === 'trips' ? s.estimated_monthly_trips : s.downtime_minutes) || 0).sort((a,b)=>a-b);
            const cq5 = activeUsages.length > 0 ? activeUsages[Math.floor(activeUsages.length * 0.05)] : 5;
            const cq50 = activeUsages.length > 0 ? activeUsages[Math.floor(activeUsages.length * 0.5)] : 20;
            const cq95 = activeUsages.length > 0 ? activeUsages[Math.floor(activeUsages.length * 0.95)] : 100;
            
            const val = activeMetric === 'trips' ? usage : downtime;
            const unit = activeMetric === 'trips' ? 'Viajes por Mes' : 'minutos sin bicis / día';
            
            const color = getMetricColor(val, cq5, cq50, cq95, activeMetric);
            const textColor = (color === '#042F2E' || color === '#450A0A' || color === '#065F46' || color === '#7F1D1D') ? 'white' : 'black';

            popup.setLngLat(coordinates as [number, number]).setHTML(`
                <div style="font-family: 'Archivo Narrow', sans-serif; padding: 2px;">
                    <div style="font-weight: 700; font-size: 13px; margin-bottom: 6px; color: #1a202c; border-bottom: 1px solid rgba(0,0,0,0.05); padding-bottom: 4px;">
                        ${name}
                    </div>
                    <div style="background: ${color}; color: ${textColor}; padding: 4px 10px; border-radius: 6px; font-size: 13px; font-weight: 800; display: inline-block; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        ${Math.round(val)} <span style="font-size: 10px; font-weight: 500; opacity: 0.9;">${unit}</span>
                    </div>
                </div>
            `).addTo(m);
        };

        const onMouseLeave = () => {
            m.getCanvas().style.cursor = '';
            popup.remove();
        };

        m.on('mouseenter', 'stations-layer', onMouseEnter);
        m.on('mouseleave', 'stations-layer', onMouseLeave);

        return () => {
            m.off('mouseenter', 'stations-layer', onMouseEnter);
            m.off('mouseleave', 'stations-layer', onMouseLeave);
        };
    }, [styleLoaded, activeMetric, stations]);

    useEffect(() => {
        if (!mapContainer.current) return;

        const mapInstance = new maplibregl.Map({
            container: mapContainer.current,
            style: {
                version: 8,
                name: 'Dark',
                sources: {
                    'carto-nolabels': {
                        type: 'raster',
                        tiles: [
                            'https://a.basemaps.cartocdn.com/rastertiles/light_nolabels/{z}/{x}/{y}@2x.png',
                            'https://b.basemaps.cartocdn.com/rastertiles/light_nolabels/{z}/{x}/{y}@2x.png',
                            'https://c.basemaps.cartocdn.com/rastertiles/light_nolabels/{z}/{x}/{y}@2x.png',
                        ],
                        tileSize: 256,
                        attribution: '© CARTO'
                    },
                    'carto-labels': {
                        type: 'raster',
                        tiles: [
                            'https://a.basemaps.cartocdn.com/rastertiles/light_only_labels/{z}/{x}/{y}@2x.png',
                            'https://b.basemaps.cartocdn.com/rastertiles/light_only_labels/{z}/{x}/{y}@2x.png',
                            'https://c.basemaps.cartocdn.com/rastertiles/light_only_labels/{z}/{x}/{y}@2x.png',
                        ],
                        tileSize: 256,
                    }
                },
                layers: [
                    { id: 'carto-base-layer', type: 'raster', source: 'carto-nolabels', minzoom: 0, maxzoom: 19 }
                ]
            },
            center: [city.geoCoords.longitude, city.geoCoords.latitude],
            zoom: 12,
            pitch: 0,
            bearing: city.angle || 0,
            dragRotate: false,
            scrollZoom: false,
            pitchWithRotate: false
        });

        map.current = mapInstance;

        mapInstance.on('load', () => {
            // Hard-lock rotation, pitch and scroll-zoom to ensure no accidental changes
            mapInstance.dragRotate.disable();
            mapInstance.scrollZoom.disable();
            mapInstance.touchZoomRotate.disableRotation();
            mapInstance.touchPitch.disable();
            mapInstance.keyboard.disableRotation();
            
            mapInstance.addLayer({ id: 'carto-labels-layer', type: 'raster', source: 'carto-labels', minzoom: 0, maxzoom: 19, layout: { visibility: 'none' } });

            mapInstance.addSource('martin-features', {
                type: 'vector',
                tiles: [`${TILE_SERVER_URL}/features/{z}/{x}/{y}`],
                minzoom: 0, maxzoom: 22
            });

            // Add standard layers
            const layerDefs = [
                { id: 'sea-layer', type: 'fill', filter: ['all', ['==', ['get', 'feature_type'], 'sea'], ['==', ['get', 'city_id'], city.id as number]], paint: { 'fill-color': '#a4b7ca' } },
                { id: 'coastline-layer', type: 'line', filter: ['all', ['==', ['get', 'feature_type'], 'coastline'], ['==', ['get', 'city_id'], city.id as number]], paint: { 'line-color': '#a4b7ca', 'line-width': 1 } },
                { id: 'waterways-layer', type: 'fill', filter: ['all', ['==', ['get', 'feature_type'], 'waterways'], ['==', ['get', 'city_id'], city.id as number]], paint: { 'fill-color': '#a4b7ca' } },
                { id: 'forest-layer', type: 'fill', filter: ['all', ['==', ['get', 'feature_type'], 'forest'], ['==', ['get', 'city_id'], city.id as number]], paint: { 'fill-color': '#dde5e4' } },
                { id: 'buildings-layer', type: 'fill', filter: ['all', ['==', ['get', 'feature_type'], 'buildings'], ['==', ['get', 'city_id'], city.id as number]], paint: { 'fill-color': '#ead5c5' } },
                { id: 'bike-path-buildings-layer', type: 'fill', filter: ['all', ['==', ['get', 'feature_type'], 'bike_path_buildings'], ['==', ['get', 'city_id'], city.id as number]], paint: { 'fill-color': '#ead5c5' } },
                { id: 'bike-paths-layer', type: 'line', filter: ['all', ['==', ['get', 'feature_type'], 'bike_paths'], ['==', ['get', 'city_id'], city.id as number]], paint: { 'line-color': '#00cac3', 'line-width': 2 } }
            ];

            layerDefs.forEach(def => {
                const initialVisibility = (def.id === 'bike-paths-layer') ? 'none' : 'visible';
                mapInstance.addLayer({ 
                    ...def, 
                    source: 'martin-features', 
                    'source-layer': 'features',
                    layout: { ...((def as any).layout || {}), visibility: initialVisibility }
                } as any);
            });

            mapInstance.addSource('stations-source', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
            mapInstance.addLayer({
                id: 'stations-layer',
                type: 'circle',
                source: 'stations-source',
                layout: { visibility: 'none' },
                paint: {
                    'circle-radius': 6,
                    'circle-color': '#A0AEC0',
                    'circle-stroke-width': 2,
                    'circle-stroke-color': '#FFFFFF'
                }
            });

            // Add edges source for traffic
            mapInstance.addSource('edges-source', {
                type: 'vector',
                tiles: [`${TILE_SERVER_URL}/edges/{z}/{x}/{y}`],
                minzoom: 0, maxzoom: 22
            });

            mapInstance.addLayer({
                id: 'traffic-layer',
                type: 'line',
                source: 'edges-source',
                'source-layer': 'edges',
                layout: { visibility: 'none' },
                filter: ['==', ['get', 'city_id'], city.id as number],
                paint: {
                    'line-width': 3,
                    'line-color': [
                        'case',
                        ['!=', ['feature-state', 'trip_count'], null],
                        [
                            'interpolate',
                            ['linear'],
                            ['feature-state', 'trip_count'],
                            0, '#edf8e9',
                            10, '#c7e9c0',
                            50, '#a1d99b',
                            100, '#74c476',
                            500, '#41ab5d',
                            1000, '#238b45',
                            5000, '#005a32'
                        ],
                        '#edf8e9' // Fallback for no trip_count state
                    ]
                }
            });

            const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, className: 'station-popup' });
            (mapInstance as any)._popup = popup; // Store popup in map instance for the and listeners

            setLoading(false);
            setStyleLoaded(true);
            
            // Critical: Force initial visibility sync once loaded
            updateVisibility(mapInstance, selectedMode, showBikePathBuildings);
        });

        return () => {
            mapInstance.remove();
            map.current = null;
        };
    }, [city.geoCoords.latitude, city.geoCoords.longitude]);

    return (
        <div className="relative w-full h-full">
            <div ref={mapContainer} className="w-full h-full" />
            {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm z-10">
                    <Spinner className="w-12 h-12" />
                </div>
            )}
            {error && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
                    <ErrorState title="Error de mapa" message={error} />
                </div>
            )}
        </div>
    );
});

CityCanvas.displayName = 'CityCanvas';
export default CityCanvas;
