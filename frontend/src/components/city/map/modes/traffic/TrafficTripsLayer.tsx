import { useEffect, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import { cellToBoundary } from 'h3-js';
import { useMap } from '../../MapContext';
import { useMapState } from '../../../../../hooks/useMapState';
import { fetchODFlows } from '../../../../../services/api';
import type * as GeoJSON from 'geojson';

type Combo = { generation_type: string; algorithm: string };

const OD_HEX_SOURCE = 'od-hex-source';
const OD_HEX_FILL_LAYER = 'od-hex-fill-layer';
const OD_HEX_LINE_LAYER = 'od-hex-line-layer';
const OD_FLOW_SOURCE = 'od-flow-source';
const OD_FLOW_LAYER = 'od-flow-layer';
const OD_SPIDER_OUT_SOURCE = 'od-spider-out-source';
const OD_SPIDER_OUT_LAYER = 'od-spider-out-layer';
const OD_SPIDER_IN_SOURCE = 'od-spider-in-source';
const OD_SPIDER_IN_LAYER = 'od-spider-in-layer';

function bezierArc(orig: [number, number], dest: [number, number], numPoints = 20, curvature = 0.35): [number, number][] {
    const [x0, y0] = orig;
    const [x1, y1] = dest;
    const dx = x1 - x0;
    const dy = y1 - y0;
    const mx = (x0 + x1) / 2;
    const my = (y0 + y1) / 2;
    const cx = mx - dy * curvature;
    const cy = my + dx * curvature;
    const pts: [number, number][] = [];
    for (let i = 0; i <= numPoints; i++) {
        const t = i / numPoints;
        const u = 1 - t;
        pts.push([
            u * u * x0 + 2 * u * t * cx + t * t * x1,
            u * u * y0 + 2 * u * t * cy + t * t * y1,
        ]);
    }
    return pts;
}

function hexToPolygonFeature(hexId: string, featureId: number): GeoJSON.Feature<GeoJSON.Polygon> {
    const boundary = cellToBoundary(hexId); // returns [lat, lng][]
    const ring: [number, number][] = boundary.map(([lat, lng]) => [lng, lat]);
    ring.push(ring[0]); // close GeoJSON ring
    return {
        type: 'Feature',
        id: featureId,
        geometry: { type: 'Polygon', coordinates: [ring] },
        properties: { orig_hex: hexId },
    };
}

function arcFeature(f: GeoJSON.Feature): GeoJSON.Feature {
    const geom = f.geometry as GeoJSON.LineString;
    if (!geom?.coordinates || geom.coordinates.length < 2) return f;
    const coords = geom.coordinates as [number, number][];
    const arced = bezierArc(coords[0], coords[coords.length - 1]);
    return { ...f, geometry: { type: 'LineString', coordinates: arced } };
}

export default function TrafficTripsLayer() {
    const { map, city } = useMap();
    const { generation, period, setGeneration } = useMapState();

    // Resolve generation from city data if not in URL (e.g. direct navigation to ?submode=od)
    useEffect(() => {
        if (generation) return;
        const combos = (city?.available_modes?.traffic_combinations as Combo[] | undefined) ?? [];
        if (combos.length > 0) setGeneration(combos[0].generation_type);
    }, [city?.id, generation]); // eslint-disable-line react-hooks/exhaustive-deps

    const odFlowsRef = useRef<GeoJSON.Feature[]>([]);
    const selectedHexRef = useRef<string | null>(null);
    const prevHoverIdRef = useRef<number | null>(null);
    const popupRef = useRef<maplibregl.Popup | null>(null);

    const clearSpider = useCallback(() => {
        if (!map) return;
        try {
            if (map.getLayer(OD_SPIDER_OUT_LAYER)) map.removeLayer(OD_SPIDER_OUT_LAYER);
            if (map.getSource(OD_SPIDER_OUT_SOURCE)) map.removeSource(OD_SPIDER_OUT_SOURCE);
            if (map.getLayer(OD_SPIDER_IN_LAYER)) map.removeLayer(OD_SPIDER_IN_LAYER);
            if (map.getSource(OD_SPIDER_IN_SOURCE)) map.removeSource(OD_SPIDER_IN_SOURCE);
        } catch { /* ok */ }
    }, [map]);

    const renderSpider = useCallback((origHex: string) => {
        if (!map) return;
        const outbound = odFlowsRef.current.filter(f => f.properties?.orig_hex === origHex);
        const inbound = odFlowsRef.current.filter(f => f.properties?.dest_hex === origHex);

        clearSpider();

        const normalize = (features: GeoJSON.Feature[]): GeoJSON.Feature[] => {
            const max = Math.max(...features.map(f => f.properties?.count ?? 1), 1);
            return features.map(f => ({
                ...f,
                properties: { ...f.properties, local_weight: (f.properties?.count ?? 1) / max },
            }));
        };

        if (outbound.length > 0) {
            const geo: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: normalize(outbound) };
            map.addSource(OD_SPIDER_OUT_SOURCE, { type: 'geojson', data: geo });
            map.addLayer({
                id: OD_SPIDER_OUT_LAYER,
                type: 'line',
                source: OD_SPIDER_OUT_SOURCE,
                paint: {
                    'line-color': '#f59e0b',
                    'line-opacity': ['interpolate', ['linear'], ['get', 'local_weight'], 0, 0.4, 1, 0.95],
                    'line-width': ['interpolate', ['linear'], ['get', 'local_weight'], 0, 1, 1, 7],
                },
                layout: { 'line-cap': 'round' },
            });
        }

        if (inbound.length > 0) {
            const geo: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: normalize(inbound) };
            map.addSource(OD_SPIDER_IN_SOURCE, { type: 'geojson', data: geo });
            map.addLayer({
                id: OD_SPIDER_IN_LAYER,
                type: 'line',
                source: OD_SPIDER_IN_SOURCE,
                paint: {
                    'line-color': '#3b82f6',
                    'line-opacity': ['interpolate', ['linear'], ['get', 'local_weight'], 0, 0.4, 1, 0.95],
                    'line-width': ['interpolate', ['linear'], ['get', 'local_weight'], 0, 1, 1, 7],
                },
                layout: { 'line-cap': 'round' },
            });
        }
    }, [map, clearSpider]);

    const buildLayers = useCallback((geojson: GeoJSON.FeatureCollection) => {
        if (!map) return;
        console.log('[TrafficTripsLayer] buildLayers called with', geojson.features.length, 'features');

        // Store all arched features for spider filtering
        odFlowsRef.current = geojson.features.map(arcFeature);

        // Top 150 by count for the global flow layer
        const top150 = [...odFlowsRef.current]
            .sort((a, b) => (b.properties?.count ?? 0) - (a.properties?.count ?? 0))
            .slice(0, 150);

        const flowGeo: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: top150 };

        // Hex polygons from unique origin hexes
        const origHexes = new Set<string>(
            geojson.features.map(f => f.properties?.orig_hex as string).filter(Boolean)
        );
        const hexFeatures: GeoJSON.Feature<GeoJSON.Polygon>[] = [];
        let idx = 0;
        for (const hexId of origHexes) {
            hexFeatures.push(hexToPolygonFeature(hexId, idx++));
        }
        const hexGeo: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: hexFeatures };

        // Remove existing layers/sources before re-adding
        try {
            [OD_HEX_FILL_LAYER, OD_HEX_LINE_LAYER, OD_FLOW_LAYER].forEach(l => {
                if (map.getLayer(l)) map.removeLayer(l);
            });
            [OD_HEX_SOURCE, OD_FLOW_SOURCE].forEach(s => {
                if (map.getSource(s)) map.removeSource(s);
            });
        } catch { /* ok */ }

        map.addSource(OD_HEX_SOURCE, { type: 'geojson', data: hexGeo });
        map.addLayer({
            id: OD_HEX_FILL_LAYER,
            type: 'fill',
            source: OD_HEX_SOURCE,
            paint: {
                'fill-color': 'white',
                'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.18, 0.06],
            },
        });
        map.addLayer({
            id: OD_HEX_LINE_LAYER,
            type: 'line',
            source: OD_HEX_SOURCE,
            paint: {
                'line-color': [
                    'case',
                    ['boolean', ['feature-state', 'hover'], false],
                    'rgba(255,255,255,0.70)',
                    'rgba(255,255,255,0.35)',
                ],
                'line-width': 1,
            },
        });

        map.addSource(OD_FLOW_SOURCE, { type: 'geojson', data: flowGeo });
        map.addLayer({
            id: OD_FLOW_LAYER,
            type: 'line',
            source: OD_FLOW_SOURCE,
            paint: {
                'line-color': '#7c3aed',
                'line-opacity': ['interpolate', ['linear'], ['get', 'weight'], 0, 0.2, 1, 0.65],
                'line-width': ['interpolate', ['linear'], ['get', 'weight'], 0, 0.8, 1, 5],
            },
            layout: { 'line-cap': 'round' },
        });
    }, [map]);

    const loadData = useCallback(async () => {
        if (!map || !city?.id || !generation) {
            console.log('[TrafficTripsLayer] loadData skipped — map:', !!map, 'cityId:', city?.id, 'generation:', generation);
            return;
        }
        console.log('[TrafficTripsLayer] fetching OD flows — cityId:', city.id, 'generation:', generation, 'period:', period);
        try {
            const geojson = await fetchODFlows(city.id, generation, period || undefined);
            console.log('[TrafficTripsLayer] received', geojson.features.length, 'features');
            buildLayers(geojson);
        } catch (err) {
            console.error('[TrafficTripsLayer] Failed to load OD flows:', err);
        }
    }, [map, city?.id, generation, period, buildLayers]);

    // Mount: hide unneeded layers, load data; unmount: clean up all sources/layers
    useEffect(() => {
        if (!map) return;
        if (map.getLayer('stations-layer')) map.setLayoutProperty('stations-layer', 'visibility', 'none');
        if (map.getLayer('bike-paths-layer')) map.setLayoutProperty('bike-paths-layer', 'visibility', 'none');

        loadData();

        return () => {
            try {
                [OD_SPIDER_OUT_LAYER, OD_SPIDER_IN_LAYER, OD_HEX_FILL_LAYER, OD_HEX_LINE_LAYER, OD_FLOW_LAYER].forEach(l => {
                    if (map.getLayer(l)) map.removeLayer(l);
                });
                [OD_SPIDER_OUT_SOURCE, OD_SPIDER_IN_SOURCE, OD_HEX_SOURCE, OD_FLOW_SOURCE].forEach(s => {
                    if (map.getSource(s)) map.removeSource(s);
                });
            } catch { /* map may have been removed */ }
            popupRef.current?.remove();
            odFlowsRef.current = [];
            selectedHexRef.current = null;
            prevHoverIdRef.current = null;
            window.dispatchEvent(new CustomEvent('trips-hex-selected', { detail: { hex: null } }));
        };
    }, [map]); // eslint-disable-line react-hooks/exhaustive-deps

    // Reload when generation or period changes
    useEffect(() => {
        if (!map || !city?.id) return;
        clearSpider();
        if (selectedHexRef.current !== null) {
            try { map.removeFeatureState({ source: OD_HEX_SOURCE }); } catch { /* ok */ }
            selectedHexRef.current = null;
        }
        window.dispatchEvent(new CustomEvent('trips-hex-selected', { detail: { hex: null } }));
        loadData();
    }, [generation, period]); // eslint-disable-line react-hooks/exhaustive-deps

    // Hex and spider interactions
    useEffect(() => {
        if (!map) return;

        const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false });
        popupRef.current = popup;

        const onHexEnter = (e: maplibregl.MapLayerMouseEvent) => {
            if (!e.features?.length) return;
            const id = e.features[0].id as number;
            if (prevHoverIdRef.current !== null && prevHoverIdRef.current !== id) {
                map.setFeatureState({ source: OD_HEX_SOURCE, id: prevHoverIdRef.current }, { hover: false });
            }
            map.setFeatureState({ source: OD_HEX_SOURCE, id }, { hover: true });
            prevHoverIdRef.current = id;
            map.getCanvas().style.cursor = 'pointer';
        };

        const onHexLeave = () => {
            if (prevHoverIdRef.current !== null) {
                map.setFeatureState({ source: OD_HEX_SOURCE, id: prevHoverIdRef.current }, { hover: false });
                prevHoverIdRef.current = null;
            }
            map.getCanvas().style.cursor = '';
        };

        const onMapClick = (e: maplibregl.MapMouseEvent) => {
            const hexHits = map.queryRenderedFeatures(e.point, { layers: [OD_HEX_FILL_LAYER] });
            if (hexHits?.length) {
                const origHex = hexHits[0].properties?.orig_hex as string;
                if (!origHex) return;

                if (selectedHexRef.current !== null) {
                    try { map.removeFeatureState({ source: OD_HEX_SOURCE }); } catch { /* ok */ }
                }

                selectedHexRef.current = origHex;
                // Re-apply hover to keep cursor hex highlighted
                if (prevHoverIdRef.current !== null) {
                    map.setFeatureState({ source: OD_HEX_SOURCE, id: prevHoverIdRef.current }, { hover: true });
                }
                window.dispatchEvent(new CustomEvent('trips-hex-selected', { detail: { hex: origHex } }));
                renderSpider(origHex);
            } else if (selectedHexRef.current) {
                clearSpider();
                try { map.removeFeatureState({ source: OD_HEX_SOURCE }); } catch { /* ok */ }
                selectedHexRef.current = null;
                window.dispatchEvent(new CustomEvent('trips-hex-selected', { detail: { hex: null } }));
            }
        };

        const onSpiderEnter = (e: maplibregl.MapLayerMouseEvent) => {
            if (!selectedHexRef.current || !e.features?.length) return;
            const count = e.features[0].properties?.count ?? 0;
            popup
                .setLngLat(e.lngLat)
                .setHTML(`<span style="font-size:11px;font-weight:700;color:#111">${count} viajes</span>`)
                .addTo(map);
        };

        const onSpiderLeave = () => popup.remove();

        map.on('mouseenter', OD_HEX_FILL_LAYER, onHexEnter);
        map.on('mouseleave', OD_HEX_FILL_LAYER, onHexLeave);
        map.on('click', onMapClick);
        map.on('mouseenter', OD_SPIDER_OUT_LAYER, onSpiderEnter);
        map.on('mouseleave', OD_SPIDER_OUT_LAYER, onSpiderLeave);
        map.on('mouseenter', OD_SPIDER_IN_LAYER, onSpiderEnter);
        map.on('mouseleave', OD_SPIDER_IN_LAYER, onSpiderLeave);

        return () => {
            map.off('mouseenter', OD_HEX_FILL_LAYER, onHexEnter);
            map.off('mouseleave', OD_HEX_FILL_LAYER, onHexLeave);
            map.off('click', onMapClick);
            map.off('mouseenter', OD_SPIDER_OUT_LAYER, onSpiderEnter);
            map.off('mouseleave', OD_SPIDER_OUT_LAYER, onSpiderLeave);
            map.off('mouseenter', OD_SPIDER_IN_LAYER, onSpiderEnter);
            map.off('mouseleave', OD_SPIDER_IN_LAYER, onSpiderLeave);
            popup.remove();
        };
    }, [map, renderSpider, clearSpider]);

    return null;
}
