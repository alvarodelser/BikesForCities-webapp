import { useRef, useEffect, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { CityData } from '../../constants/cities';
import { TILE_SERVER_URL } from '../../config/api';
import { fetchStations, fetchTrafficResolve } from '../../services/api';
import LoadingContainer from '../ui/LoadingContainer';

export type CompareMode = 'infrastructure' | 'stations' | 'traffic';

const MODE_SPINNER_COLOR: Record<CompareMode, string> = {
    infrastructure: '#027A76',
    stations: '#ffa585',
    traffic: '#3A6C7F',
};

interface StaticCityMapProps {
    city: CityData;
    mode?: CompareMode;
}

export default function StaticCityMap({ city, mode = 'infrastructure' }: StaticCityMapProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [ready, setReady] = useState(false);

    const lat = city.geoCoords.latitude;
    const lon = city.geoCoords.longitude;

    useEffect(() => {
        if (!containerRef.current || !city.id) return;

        const halfLat = 5000 / 111320;
        const halfLon = 5000 / (111320 * Math.cos((lat * Math.PI) / 180));
        const sw: [number, number] = [lon - halfLon, lat - halfLat];
        const ne: [number, number] = [lon + halfLon, lat + halfLat];

        const map = new maplibregl.Map({
            container: containerRef.current,
            style: {
                version: 8,
                sources: {
                    carto: {
                        type: 'raster',
                        tiles: ['https://a.basemaps.cartocdn.com/rastertiles/light_nolabels/{z}/{x}/{y}@2x.png'],
                        tileSize: 256,
                        attribution: '© CARTO',
                    },
                },
                layers: [
                    { id: 'bg', type: 'background', paint: { 'background-color': '#FBF6EF' } } as any,
                    { id: 'carto', type: 'raster', source: 'carto', minzoom: 0, maxzoom: 19 } as any,
                ],
            },
            bounds: [sw, ne],
            fitBoundsOptions: { padding: 12 },
            interactive: false,
            attributionControl: false,
        });

        map.resize();

        let cancelled = false;

        map.on('load', async () => {
            if (cancelled) return;

            const cityIdFilter = ['==', ['get', 'city_id'], city.id as number];

            // ── Martin features vector tiles (buildings, bike paths, etc.) ──
            map.addSource('martin-features', {
                type: 'vector',
                tiles: [`${TILE_SERVER_URL}/features/{z}/{x}/{y}`],
                minzoom: 0, maxzoom: 22,
            });

            map.addLayer({
                id: 'bld-fill', type: 'fill',
                source: 'martin-features', 'source-layer': 'features',
                filter: ['all', ['==', ['get', 'feature_type'], 'buildings'], cityIdFilter],
                paint: { 'fill-color': '#ead5c5' },
            } as any);

            // bike_path_buildings: highlighted green only in infrastructure mode
            map.addLayer({
                id: 'bpbld-fill', type: 'fill',
                source: 'martin-features', 'source-layer': 'features',
                filter: ['all', ['==', ['get', 'feature_type'], 'bike_path_buildings'], cityIdFilter],
                paint: { 'fill-color': mode === 'infrastructure' ? '#027A76' : '#ead5c5' },
            } as any);

            // ── Mode-specific foreground ──────────────────────────────────────
            if (mode === 'infrastructure') {
                map.addLayer({
                    id: 'bk-line', type: 'line',
                    source: 'martin-features', 'source-layer': 'features',
                    filter: ['all', ['==', ['get', 'feature_type'], 'bike_paths'], cityIdFilter],
                    paint: { 'line-color': '#00cac3', 'line-width': 2.5 },
                } as any);
                if (!cancelled) setReady(true);

            } else if (mode === 'stations') {
                map.addSource('stn', {
                    type: 'geojson',
                    data: { type: 'FeatureCollection', features: [] } as any,
                });
                map.addLayer({
                    id: 'stn-circles', type: 'circle', source: 'stn',
                    paint: {
                        'circle-radius': 3.5,
                        'circle-color': '#ffa585',
                        'circle-stroke-width': 1,
                        'circle-stroke-color': '#FFFFFF',
                    },
                } as any);
                if (!cancelled) setReady(true);

                fetchStations(city.id!)
                    .then(stationsData => {
                        if (cancelled || !map.getSource('stn')) return;
                        (map.getSource('stn') as maplibregl.GeoJSONSource).setData({
                            type: 'FeatureCollection',
                            features: stationsData.map(s => ({
                                type: 'Feature',
                                geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
                                properties: { id: s.id },
                            })),
                        } as any);
                    })
                    .catch(() => {});

            } else if (mode === 'traffic') {
                let tileUrl = `${TILE_SERVER_URL}/edges_with_traffic/{z}/{x}/{y}`;
                let q5 = 1, q50 = 50, q95 = 200;

                try {
                    const resolved = await fetchTrafficResolve(city.id!);
                    if (cancelled) return;
                    if (resolved.generation_type && resolved.algorithm && resolved.month) {
                        const params = new URLSearchParams();
                        params.set('generation_type', resolved.generation_type);
                        params.set('algorithm', resolved.algorithm);
                        params.set('month', resolved.month);
                        tileUrl = `${TILE_SERVER_URL}/edges_with_traffic/{z}/{x}/{y}?${params.toString()}`;
                    }
                    if (resolved.stats?.q5 != null && resolved.stats.q50 != null && resolved.stats.q95 != null) {
                        q5 = Math.max(resolved.stats.q5, 0);
                        q50 = Math.max(resolved.stats.q50, q5 + 1);
                        q95 = Math.max(resolved.stats.q95, q50 + 1);
                    }
                } catch { /* use fallback URL and default thresholds */ }

                if (cancelled) return;

                map.addSource('edges', {
                    type: 'vector',
                    tiles: [tileUrl],
                    minzoom: 0, maxzoom: 22,
                });
                map.addLayer({
                    id: 'edges-line', type: 'line',
                    source: 'edges', 'source-layer': 'edges',
                    paint: {
                        'line-color': [
                            'interpolate', ['linear'],
                            ['coalesce', ['get', 'trip_count'], 0],
                            q5, '#edf8e9', q50, '#74c476', q95, '#005a32',
                        ],
                        'line-width': 2.5,
                        'line-opacity': [
                            'case',
                            ['>=', ['coalesce', ['get', 'trip_count'], 0], q5], 0.9,
                            0,
                        ],
                    },
                } as any);

                if (!cancelled) setReady(true);
            }
        });

        return () => {
            cancelled = true;
            setReady(false);
            map.remove();
        };
    }, [city.id, lat, lon, mode]);

    return (
        <div className="relative w-full h-full">
            <div ref={containerRef} className="w-full h-full" />
            {!ready && (
                <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: '#FBF6EF' }}>
                    <LoadingContainer className="w-24 h-24" color={MODE_SPINNER_COLOR[mode]} text="" />
                </div>
            )}
        </div>
    );
}
