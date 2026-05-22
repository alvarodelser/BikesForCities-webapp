import { useEffect, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import { cellToBoundary, gridDistance } from 'h3-js';
import { useMap } from '../../MapContext';
import { useMapState } from '../../../../../hooks/useMapState';
import { fetchODFlows } from '../../../../../services/api';
import type { SelectionDetail } from '../../../../../types/selection';
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

// ---- Force-Directed Edge Bundling (FDEB) ----

function fdebCompatibility(
    p0: [number, number], p1: [number, number],
    q0: [number, number], q1: [number, number],
): number {
    const px = p1[0]-p0[0], py = p1[1]-p0[1];
    const qx = q1[0]-q0[0], qy = q1[1]-q0[1];
    const lp = Math.sqrt(px*px+py*py), lq = Math.sqrt(qx*qx+qy*qy);
    if (lp < 1e-9 || lq < 1e-9) return 0;
    const Ca = Math.abs((px*qx+py*qy)/(lp*lq));
    const lavg = (lp+lq)/2;
    const Cs = 2/(lavg/Math.min(lp,lq)+Math.max(lp,lq)/lavg);
    const mpx=(p0[0]+p1[0])/2, mpy=(p0[1]+p1[1])/2;
    const mqx=(q0[0]+q1[0])/2, mqy=(q0[1]+q1[1])/2;
    const d = Math.sqrt((mpx-mqx)**2+(mpy-mqy)**2);
    const Cp = lavg/(lavg+d);
    return Ca*Cs*Cp;
}

function runFDEB(
    pairs: Array<{ orig: [number,number]; dest: [number,number]; count: number }>,
    { K=0.1, S0=0.004, I0=60, P0=6, cycles=4, compatThreshold=0.5 } = {},
): Array<{ coords: [number,number][]; count: number }> {
    const n = pairs.length;
    if (n === 0) return [];

    // Pre-compute compatibility matrix (only pairs above threshold)
    const compat: Float32Array[] = Array.from({length: n}, () => new Float32Array(n));
    for (let i = 0; i < n; i++) {
        for (let j = i+1; j < n; j++) {
            const c = fdebCompatibility(pairs[i].orig, pairs[i].dest, pairs[j].orig, pairs[j].dest);
            compat[i][j] = compat[j][i] = c;
        }
    }

    // Initialize subdivision points
    let P = P0;
    const pts: Array<Array<[number,number]>> = pairs.map(({orig, dest}) => {
        const arr: [number,number][] = [];
        for (let k = 0; k <= P; k++) {
            const t = k/P;
            arr.push([orig[0]+t*(dest[0]-orig[0]), orig[1]+t*(dest[1]-orig[1])]);
        }
        return arr;
    });

    let S = S0;
    let I = I0;
    for (let c = 0; c < cycles; c++) {
        for (let iter = 0; iter < I; iter++) {
            for (let e = 0; e < n; e++) {
                const ep = pts[e];
                for (let q = 1; q < ep.length-1; q++) {
                    const curr = ep[q];
                    const prev = ep[q-1], next = ep[q+1];
                    // Spring force toward midpoint of neighbours
                    let fx = K*((prev[0]+next[0])/2-curr[0]);
                    let fy = K*((prev[1]+next[1])/2-curr[1]);
                    // Attraction from compatible edges
                    const row = compat[e];
                    for (let f = 0; f < n; f++) {
                        const w = row[f];
                        if (w < compatThreshold) continue;
                        const cp = pts[f][q];
                        fx += w*(cp[0]-curr[0]);
                        fy += w*(cp[1]-curr[1]);
                    }
                    ep[q] = [curr[0]+S*fx, curr[1]+S*fy];
                }
            }
        }
        // Double subdivisions between cycles
        if (c < cycles-1) {
            P *= 2;
            for (let e = 0; e < n; e++) {
                const old = pts[e];
                const next: [number,number][] = [old[0]];
                for (let k = 1; k < old.length; k++) {
                    next.push([(old[k-1][0]+old[k][0])/2, (old[k-1][1]+old[k][1])/2]);
                    next.push(old[k]);
                }
                pts[e] = next;
            }
        }
        S /= 2;
        I = Math.max(1, Math.floor(I*2/3));
    }

    return pairs.map(({count}, e) => ({ coords: pts[e], count }));
}

// ---- end FDEB ----

function bezierArc(orig: [number, number], dest: [number, number], curvature: number, numPoints = 24): [number, number][] {
    const [x0, y0] = orig, [x1, y1] = dest;
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    const cx = mx - (y1 - y0) * curvature;
    const cy = my + (x1 - x0) * curvature;
    const pts: [number, number][] = [];
    for (let i = 0; i <= numPoints; i++) {
        const t = i / numPoints, u = 1 - t;
        pts.push([u * u * x0 + 2 * u * t * cx + t * t * x1, u * u * y0 + 2 * u * t * cy + t * t * y1]);
    }
    return pts;
}

function raySegmentIntersect(
    cx: number, cy: number,
    dx: number, dy: number,
    p1x: number, p1y: number,
    p2x: number, p2y: number,
): [number, number] | null {
    const ex = p2x - p1x, ey = p2y - p1y;
    const denom = dx * ey - dy * ex;
    if (Math.abs(denom) < 1e-12) return null;
    const t = ((p1x - cx) * ey - (p1y - cy) * ex) / denom;
    const s = ((p1x - cx) * dy - (p1y - cy) * dx) / denom;
    if (t > -1e-9 && s >= -1e-9 && s <= 1 + 1e-9) {
        return [cx + t * dx, cy + t * dy];
    }
    return null;
}

// Returns the point where the ray from (fromLng,fromLat) toward (toLng,toLat) exits hexId.
function hexEdgePoint(hexId: string, fromLng: number, fromLat: number, toLng: number, toLat: number): [number, number] {
    const boundary = cellToBoundary(hexId); // [lat, lng][]
    const ring = boundary.map(([lat, lng]) => [lng, lat] as [number, number]);
    ring.push(ring[0]);
    const dx = toLng - fromLng, dy = toLat - fromLat;
    for (let i = 0; i < ring.length - 1; i++) {
        const pt = raySegmentIntersect(fromLng, fromLat, dx, dy, ring[i][0], ring[i][1], ring[i + 1][0], ring[i + 1][1]);
        if (pt) return pt;
    }
    return [fromLng, fromLat];
}

function edgePointFeature(f: GeoJSON.Feature): GeoJSON.Feature {
    const coords = (f.geometry as GeoJSON.LineString).coordinates as [number, number][];
    if (coords.length < 2) return f;
    const [o, d] = coords;
    const oh = f.properties?.orig_hex as string | undefined;
    const dh = f.properties?.dest_hex as string | undefined;
    if (!oh || !dh) return f;

    const start = hexEdgePoint(oh, o[0], o[1], d[0], d[1]);
    const end   = hexEdgePoint(dh, d[0], d[1], o[0], o[1]);

    let newCoords: [number, number][];
    try {
        const dist = gridDistance(oh, dh);
        // Adjacent hexes: straight. Longer hops: gentle curve scaling with distance.
        const curvature = dist > 1 ? Math.min(0.25, (dist - 1) * 0.04) : 0;
        newCoords = curvature > 0 ? bezierArc(start, end, curvature) : [start, end];
    } catch {
        newCoords = [start, end];
    }

    return { ...f, geometry: { type: 'LineString', coordinates: newCoords } };
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

export default function TrafficTripsLayer() {
    const { map, city, setLayerState } = useMap();
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
        // Restore global flow overview when deselecting
        try {
            if (map.getLayer(OD_FLOW_LAYER)) map.setLayoutProperty(OD_FLOW_LAYER, 'visibility', 'visible');
        } catch { /* ok */ }
    }, [map]);

    const renderSpider = useCallback((origHex: string) => {
        if (!map) return;
        const outbound = odFlowsRef.current.filter(f => f.properties?.orig_hex === origHex);
        const inbound  = odFlowsRef.current.filter(f => f.properties?.dest_hex === origHex);

        clearSpider();

        // Hide the global overview while a hex is selected
        try {
            if (map.getLayer(OD_FLOW_LAYER)) map.setLayoutProperty(OD_FLOW_LAYER, 'visibility', 'none');
        } catch { /* ok */ }

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
                    'line-opacity': 0.85,
                    'line-width': ['interpolate', ['linear'], ['get', 'local_weight'], 0, 1, 1, 10],
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
                    'line-opacity': 0.85,
                    'line-width': ['interpolate', ['linear'], ['get', 'local_weight'], 0, 1, 1, 10],
                },
                layout: { 'line-cap': 'round' },
            });
        }

        // Dispatch selection panel with hex stats
        const outTrips = outbound.reduce((s, f) => s + (f.properties?.count ?? 0), 0);
        const inTrips  = inbound.reduce((s, f) => s + (f.properties?.count ?? 0), 0);
        const detail: SelectionDetail = {
            type: 'od_hex',
            title: `Zona ${origHex.slice(-6)}`,
            rows: [
                { label: 'DESTINOS', value: String(outbound.length) },
                { label: 'ORÍGENES', value: String(inbound.length) },
            ],
            pairRows: [[
                { label: 'SALIDAS', value: outTrips.toLocaleString('es-ES'), color: '#f59e0b' },
                { label: 'LLEGADAS', value: inTrips.toLocaleString('es-ES'), color: '#3b82f6' },
            ]],
        };
        window.dispatchEvent(new CustomEvent('map-selection', { detail }));
    }, [map, clearSpider]);

    // Coarse resolution used for bundling the global overview.
    const buildLayers = useCallback((geojson: GeoJSON.FeatureCollection) => {
        if (!map) return;
        console.log('[TrafficTripsLayer] buildLayers called with', geojson.features.length, 'features');

        odFlowsRef.current = geojson.features.map(edgePointFeature);

        // --- FDEB (Force-Directed Edge Bundling) ---
        // Sample top 250 OD pairs, run FDEB to pull compatible flows into corridors.
        const top250 = [...odFlowsRef.current]
            .sort((a, b) => (b.properties?.count ?? 0) - (a.properties?.count ?? 0))
            .slice(0, 250)
            .map(f => {
                const coords = (f.geometry as GeoJSON.LineString).coordinates as [number,number][];
                return { orig: coords[0], dest: coords[coords.length-1], count: (f.properties?.count ?? 0) as number };
            });

        console.log('[TrafficTripsLayer] running FDEB on', top250.length, 'pairs');
        const t0 = performance.now();
        const bundled = runFDEB(top250);
        console.log('[TrafficTripsLayer] FDEB done in', (performance.now()-t0).toFixed(0), 'ms');

        const maxCount = top250.length > 0 ? top250[0].count : 1;
        const bundleFeatures: GeoJSON.Feature[] = bundled.map(({ coords, count }) => ({
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: coords },
            properties: {
                count,
                log_weight: Math.log1p(count) / Math.log1p(maxCount),
            },
        }));

        const flowGeo: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: bundleFeatures };

        // Hex polygons from all fine-res hexes (orig + dest), coloured by total flow volume
        const hexFlow = new Map<string, number>();
        for (const f of geojson.features) {
            const oh = f.properties?.orig_hex as string | undefined;
            const dh = f.properties?.dest_hex as string | undefined;
            const cnt = (f.properties?.count ?? 0) as number;
            if (oh) hexFlow.set(oh, (hexFlow.get(oh) ?? 0) + cnt);
            if (dh) hexFlow.set(dh, (hexFlow.get(dh) ?? 0) + cnt);
        }
        const maxHexFlow = Math.max(...hexFlow.values(), 1);
        const hexFeatures: GeoJSON.Feature<GeoJSON.Polygon>[] = [];
        let idx = 0;
        for (const [hexId, total] of hexFlow) {
            const base = hexToPolygonFeature(hexId, idx++);
            hexFeatures.push({
                ...base,
                properties: { ...base.properties, flow_norm: total / maxHexFlow },
            });
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
                'fill-color': [
                    'interpolate', ['linear'], ['get', 'flow_norm'],
                    0, 'rgba(124,58,237,0.04)',
                    0.5, 'rgba(124,58,237,0.12)',
                    1, 'rgba(124,58,237,0.28)',
                ],
                'fill-opacity': 1,
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
                    'rgba(255,255,255,0.20)',
                ],
                'line-width': 0.5,
            },
        });

        map.addSource(OD_FLOW_SOURCE, { type: 'geojson', data: flowGeo });
        map.addLayer({
            id: OD_FLOW_LAYER,
            type: 'line',
            source: OD_FLOW_SOURCE,
            paint: {
                // Color encodes trip volume: lavender (few) → purple (mid) → amber (many)
                'line-color': [
                    'interpolate', ['linear'], ['get', 'log_weight'],
                    0,   '#ddd6fe',
                    0.4, '#7c3aed',
                    0.75,'#db2777',
                    1,   '#f59e0b',
                ],
                'line-opacity': ['interpolate', ['linear'], ['get', 'log_weight'], 0, 0.25, 1, 0.9],
                'line-width': ['interpolate', ['linear'], ['get', 'log_weight'], 0, 0.6, 1, 4],
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
        setLayerState?.('loading');
        try {
            const geojson = await fetchODFlows(city.id, generation, period || undefined, 9);
            console.log('[TrafficTripsLayer] received', geojson.features.length, 'features');
            buildLayers(geojson);
            setLayerState?.(geojson.features.length === 0 ? 'empty' : 'idle');
        } catch (err) {
            console.error('[TrafficTripsLayer] Failed to load OD flows:', err);
            setLayerState?.('error');
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
            window.dispatchEvent(new CustomEvent('map-selection', { detail: null }));
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
        window.dispatchEvent(new CustomEvent('map-selection', { detail: null }));
        loadData();
    }, [generation, period]); // eslint-disable-line react-hooks/exhaustive-deps

    // Handle SelectionPanel X-button close — restore overview and clear spider
    useEffect(() => {
        if (!map) return;
        const onSelectionClose = (e: Event) => {
            if ((e as CustomEvent).detail !== null) return;
            if (!selectedHexRef.current) return;
            clearSpider();
            try { map.removeFeatureState({ source: OD_HEX_SOURCE }); } catch { /* ok */ }
            selectedHexRef.current = null;
            window.dispatchEvent(new CustomEvent('trips-hex-selected', { detail: { hex: null } }));
        };
        window.addEventListener('map-selection', onSelectionClose);
        return () => window.removeEventListener('map-selection', onSelectionClose);
    }, [map, clearSpider]);

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
                window.dispatchEvent(new CustomEvent('map-selection', { detail: null }));
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
