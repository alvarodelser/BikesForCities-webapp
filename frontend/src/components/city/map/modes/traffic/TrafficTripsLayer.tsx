import { useEffect, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import { useMap } from '../../MapContext';
import { useMapState } from '../../../../../hooks/useMapState';
import { fetchODFlows } from '../../../../../services/api';
import { ODAccumulationLayer, ACCUM_LAYER_ID } from './ODAccumulationLayer';
import type { SelectionDetail } from '../../../../../types/selection';
import type * as GeoJSON from 'geojson';

type Combo = { generation_type: string; algorithm: string };

const OD_NODE_SOURCE = 'od-node-source';
const OD_NODE_LAYER  = 'od-node-layer';
const OD_SEL_SOURCE  = 'od-sel-source';
const OD_SEL_LAYER   = 'od-sel-layer';

// ── Force-Directed Edge Bundling ──────────────────────────────────────────────

function fdebCompatibility(
    p0: [number,number], p1: [number,number],
    q0: [number,number], q1: [number,number],
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
    { K=0.3, S0=0.002, I0=40, P0=6, cycles=3, compatThreshold=0.65 } = {},
): Array<{ coords: [number,number][]; count: number }> {
    const n = pairs.length;
    if (n === 0) return [];

    // Compatibility + anti-parallel flags
    const compat: Float32Array[] = Array.from({length: n}, () => new Float32Array(n));
    const antipar: Uint8Array[]  = Array.from({length: n}, () => new Uint8Array(n));
    for (let i = 0; i < n; i++) {
        const dxi = pairs[i].dest[0]-pairs[i].orig[0];
        const dyi = pairs[i].dest[1]-pairs[i].orig[1];
        for (let j = i+1; j < n; j++) {
            const dxj = pairs[j].dest[0]-pairs[j].orig[0];
            const dyj = pairs[j].dest[1]-pairs[j].orig[1];
            antipar[i][j] = antipar[j][i] = (dxi*dxj + dyi*dyj < 0) ? 1 : 0;
            const c = fdebCompatibility(pairs[i].orig, pairs[i].dest, pairs[j].orig, pairs[j].dest);
            compat[i][j] = compat[j][i] = c;
        }
    }

    let P = P0;
    const pts: [number,number][][] = pairs.map(({orig, dest}) => {
        const arr: [number,number][] = [];
        for (let k = 0; k <= P; k++) {
            const t = k/P;
            arr.push([orig[0]+t*(dest[0]-orig[0]), orig[1]+t*(dest[1]-orig[1])]);
        }
        return arr;
    });

    let S = S0, I = I0;
    for (let c = 0; c < cycles; c++) {
        for (let iter = 0; iter < I; iter++) {
            for (let e = 0; e < n; e++) {
                const ep   = pts[e];
                const last = ep.length - 1;
                const row  = compat[e];
                const ap   = antipar[e];
                for (let q = 1; q < last; q++) {
                    const curr = ep[q];
                    let fx = K*((ep[q-1][0]+ep[q+1][0])/2 - curr[0]);
                    let fy = K*((ep[q-1][1]+ep[q+1][1])/2 - curr[1]);
                    for (let f = 0; f < n; f++) {
                        if (row[f] < compatThreshold) continue;
                        // Mirror index for anti-parallel edges so forces pull toward
                        // the geometrically matching point, not the opposite endpoint.
                        const qi = ap[f] ? last - q : q;
                        fx += row[f] * (pts[f][qi][0] - curr[0]);
                        fy += row[f] * (pts[f][qi][1] - curr[1]);
                    }
                    ep[q] = [curr[0]+S*fx, curr[1]+S*fy];
                }
            }
        }
        if (c < cycles-1) {
            P *= 2;
            for (let e = 0; e < n; e++) {
                const old = pts[e];
                const nxt: [number,number][] = [old[0]];
                for (let k = 1; k < old.length; k++) {
                    nxt.push([(old[k-1][0]+old[k][0])/2, (old[k-1][1]+old[k][1])/2]);
                    nxt.push(old[k]);
                }
                pts[e] = nxt;
            }
        }
        S /= 2;
        I = Math.max(1, Math.floor(I * 2/3));
    }

    return pairs.map(({count}, e) => ({ coords: pts[e], count }));
}

// Chaikin corner-cutting: each iteration doubles point count and rounds corners.
// 2 passes gives visually smooth curves without significantly altering the bundled paths.
function chaikinSmooth(pts: [number,number][], iterations = 2): [number,number][] {
    let p = pts;
    for (let i = 0; i < iterations; i++) {
        const next: [number,number][] = [p[0]];
        for (let j = 0; j < p.length - 1; j++) {
            next.push([0.75*p[j][0] + 0.25*p[j+1][0], 0.75*p[j][1] + 0.25*p[j+1][1]]);
            next.push([0.25*p[j][0] + 0.75*p[j+1][0], 0.25*p[j][1] + 0.75*p[j+1][1]]);
        }
        next.push(p[p.length - 1]);
        p = next;
    }
    return p;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TrafficTripsLayer() {
    const { map, city, setLayerState } = useMap();
    const { generation, period, periodFrom, setGeneration } = useMapState();

    useEffect(() => {
        if (generation) return;
        const combos = (city?.available_modes?.traffic_combinations as Combo[] | undefined) ?? [];
        if (combos.length > 0) setGeneration(combos[0].generation_type);
    }, [city?.id, generation]); // eslint-disable-line react-hooks/exhaustive-deps

    const odFlowsRef    = useRef<GeoJSON.Feature[]>([]);
    const accumLayerRef = useRef<ODAccumulationLayer | null>(null);
    const selectedHexRef  = useRef<string | null>(null);
    const selectedNodeRef = useRef<number | null>(null);
    const popupRef        = useRef<maplibregl.Popup | null>(null);

    // ── Selection helpers ─────────────────────────────────────────────────────

    const clearSelected = useCallback(() => {
        if (!map) return;
        try {
            if (map.getLayer(OD_SEL_LAYER))  map.removeLayer(OD_SEL_LAYER);
            if (map.getSource(OD_SEL_SOURCE)) map.removeSource(OD_SEL_SOURCE);
        } catch { /* ok */ }
        if (selectedNodeRef.current !== null) {
            try { map.setFeatureState({ source: OD_NODE_SOURCE, id: selectedNodeRef.current }, { selected: false }); } catch { /* ok */ }
            selectedNodeRef.current = null;
        }
        selectedHexRef.current = null;
    }, [map]);

    const renderSelected = useCallback((hexId: string, nodeFeatureId: number) => {
        if (!map) return;

        selectedNodeRef.current = nodeFeatureId;
        map.setFeatureState({ source: OD_NODE_SOURCE, id: nodeFeatureId }, { selected: true });

        const connected = odFlowsRef.current.filter(f =>
            f.properties?.orig_hex === hexId || f.properties?.dest_hex === hexId,
        );

        try {
            if (map.getLayer(OD_SEL_LAYER))  map.removeLayer(OD_SEL_LAYER);
            if (map.getSource(OD_SEL_SOURCE)) map.removeSource(OD_SEL_SOURCE);
        } catch { /* ok */ }

        if (connected.length > 0) {
            const maxCnt = Math.max(...connected.map(f => f.properties?.count ?? 1), 1);
            const selFeatures = connected.map(f => ({
                ...f,
                properties: {
                    ...f.properties,
                    sel_lw: Math.log1p(f.properties?.count ?? 0) / Math.log1p(maxCnt),
                },
            }));
            map.addSource(OD_SEL_SOURCE, { type: 'geojson', data: { type: 'FeatureCollection', features: selFeatures } });
            map.addLayer({
                id: OD_SEL_LAYER,
                type: 'line',
                source: OD_SEL_SOURCE,
                paint: {
                    'line-color': '#f59e0b',
                    'line-opacity': ['interpolate', ['linear'], ['get', 'sel_lw'], 0, 0.3, 1, 1.0],
                    'line-width': 1.5,
                },
                layout: { 'line-cap': 'round' },
            });
        }

        const total = connected.reduce((s, f) => s + (f.properties?.count ?? 0), 0);
        const detail: SelectionDetail = {
            type: 'od_hex',
            title: `Zona ${hexId.slice(-6)}`,
            rows: [
                { label: 'CONEXIONES', value: String(connected.length) },
                { label: 'VIAJES',     value: total.toLocaleString('es-ES') },
            ],
        };
        window.dispatchEvent(new CustomEvent('map-selection', { detail }));
    }, [map]);

    // ── Build layers ──────────────────────────────────────────────────────────

    const buildLayers = useCallback((geojson: GeoJSON.FeatureCollection) => {
        if (!map) return;

        // Undirected aggregation: merge A→B with B→A under canonical key min|max
        const hexCenter = new Map<string, [number,number]>();
        type UPair = { oh: string; dh: string; oC: [number,number]; dC: [number,number]; count: number };
        const undirected = new Map<string, UPair>();

        for (const f of geojson.features) {
            const coords = (f.geometry as GeoJSON.LineString).coordinates as [number,number][];
            const oh = f.properties?.orig_hex as string | undefined;
            const dh = f.properties?.dest_hex as string | undefined;
            if (!oh || !dh || oh === dh) continue;
            if (!hexCenter.has(oh)) hexCenter.set(oh, coords[0]);
            if (!hexCenter.has(dh)) hexCenter.set(dh, coords[coords.length-1]);

            const [a, b]   = oh < dh ? [oh, dh] : [dh, oh];
            const [aC, bC] = oh < dh
                ? [coords[0], coords[coords.length-1]]
                : [coords[coords.length-1], coords[0]];
            const cnt = (f.properties?.count ?? 0) as number;
            const key = `${a}|${b}`;
            const ex  = undirected.get(key);
            if (ex) { ex.count += cnt; }
            else    { undirected.set(key, { oh: a, dh: b, oC: aC, dC: bC, count: cnt }); }
        }

        // FDEB on top 500 undirected pairs by count
        const pairs = [...undirected.values()].sort((a, b) => b.count - a.count).slice(0, 500);
        const bundled = runFDEB(pairs.map(p => ({ orig: p.oC, dest: p.dC, count: p.count })));

        const maxCount = pairs.length > 0 ? pairs[0].count : 1;
        odFlowsRef.current = bundled.map(({ coords, count }, i) => ({
            type: 'Feature' as const,
            geometry: { type: 'LineString' as const, coordinates: chaikinSmooth(coords) },
            properties: {
                orig_hex:   pairs[i].oh,
                dest_hex:   pairs[i].dh,
                count,
                log_weight: Math.log1p(count) / Math.log1p(maxCount),
            },
        }));

        // One circle per unique hex in the sampled 500 pairs only
        const hexFlow = new Map<string, number>();
        for (const { oh, dh, count } of pairs) {
            hexFlow.set(oh, (hexFlow.get(oh) ?? 0) + count);
            hexFlow.set(dh, (hexFlow.get(dh) ?? 0) + count);
        }
        const maxHexFlow = Math.max(...hexFlow.values(), 1);
        const nodeFeatures: GeoJSON.Feature<GeoJSON.Point>[] = [];
        let nodeIdx = 0;
        for (const [hexId, total] of hexFlow) {
            const center = hexCenter.get(hexId);
            if (!center) continue;
            nodeFeatures.push({
                type: 'Feature',
                id: nodeIdx++,
                geometry: { type: 'Point', coordinates: center },
                properties: { hex_id: hexId, flow_norm: total / maxHexFlow },
            });
        }

        // Rebuild layers
        try {
            [OD_SEL_LAYER, OD_NODE_LAYER].forEach(l => { if (map.getLayer(l)) map.removeLayer(l); });
            [OD_SEL_SOURCE, OD_NODE_SOURCE].forEach(s => { if (map.getSource(s)) map.removeSource(s); });
        } catch { /* ok */ }

        // GPU accumulation layer (add once; update data via setData on subsequent calls)
        if (!accumLayerRef.current) {
            accumLayerRef.current = new ODAccumulationLayer();
        }
        if (!map.getLayer(ACCUM_LAYER_ID)) {
            map.addLayer(accumLayerRef.current);
        }
        accumLayerRef.current.setData(odFlowsRef.current);

        // Circle nodes on top of the flow rendering
        map.addSource(OD_NODE_SOURCE, {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: nodeFeatures },
        });
        map.addLayer({
            id: OD_NODE_LAYER,
            type: 'circle',
            source: OD_NODE_SOURCE,
            paint: {
                'circle-radius': ['interpolate', ['linear'], ['get', 'flow_norm'], 0, 2, 1, 6],
                'circle-color':  ['case', ['boolean', ['feature-state', 'selected'], false], '#f59e0b', '#7c3aed'],
                'circle-opacity':['case', ['boolean', ['feature-state', 'selected'], false], 1, 0.65],
                'circle-stroke-width': 1,
                'circle-stroke-color': 'rgba(255,255,255,0.5)',
            },
        });
    }, [map]);

    // ── Data loading ──────────────────────────────────────────────────────────

    const loadData = useCallback(async () => {
        if (!map || !city?.id || !generation) return;
        setLayerState?.('loading');
        try {
            const geojson = await fetchODFlows(city.id, generation, period || undefined, 9, periodFrom || undefined);
            buildLayers(geojson);
            setLayerState?.(geojson.features.length === 0 ? 'empty' : 'idle');
        } catch (err) {
            console.error('[TrafficTripsLayer] Failed to load OD flows:', err);
            setLayerState?.('error');
        }
    }, [map, city?.id, generation, period, periodFrom, buildLayers]);

    // ── Effects ───────────────────────────────────────────────────────────────

    useEffect(() => {
        if (!map) return;
        if (map.getLayer('stations-layer'))  map.setLayoutProperty('stations-layer',  'visibility', 'none');
        if (map.getLayer('bike-paths-layer')) map.setLayoutProperty('bike-paths-layer','visibility', 'none');
        loadData();
        return () => {
            try {
                [OD_SEL_LAYER, OD_NODE_LAYER, ACCUM_LAYER_ID].forEach(l => { if (map.getLayer(l)) map.removeLayer(l); });
                [OD_SEL_SOURCE, OD_NODE_SOURCE].forEach(s => { if (map.getSource(s)) map.removeSource(s); });
            } catch { /* map may have been removed */ }
            popupRef.current?.remove();
            accumLayerRef.current = null;
            odFlowsRef.current = [];
            selectedHexRef.current = null;
            selectedNodeRef.current = null;
            window.dispatchEvent(new CustomEvent('map-selection', { detail: null }));
        };
    }, [map]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!map || !city?.id) return;
        clearSelected();
        window.dispatchEvent(new CustomEvent('map-selection', { detail: null }));
        loadData();
    }, [generation, period, periodFrom]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!map) return;
        const onClose = (e: Event) => {
            if ((e as CustomEvent).detail !== null) return;
            if (!selectedHexRef.current) return;
            clearSelected();
        };
        window.addEventListener('map-selection', onClose);
        return () => window.removeEventListener('map-selection', onClose);
    }, [map, clearSelected]);

    useEffect(() => {
        if (!map) return;
        const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false });
        popupRef.current = popup;

        const onNodeEnter = () => { map.getCanvas().style.cursor = 'pointer'; };
        const onNodeLeave = () => { map.getCanvas().style.cursor = ''; };

        const onMapClick = (e: maplibregl.MapMouseEvent) => {
            const hits = map.queryRenderedFeatures(e.point, { layers: [OD_NODE_LAYER] });
            if (hits?.length) {
                const hexId  = hits[0].properties?.hex_id as string | undefined;
                const nodeId = hits[0].id as number;
                if (!hexId) return;
                if (selectedHexRef.current) clearSelected();
                selectedHexRef.current = hexId;
                renderSelected(hexId, nodeId);
            } else if (selectedHexRef.current) {
                clearSelected();
                window.dispatchEvent(new CustomEvent('map-selection', { detail: null }));
            }
        };

        map.on('mouseenter', OD_NODE_LAYER, onNodeEnter);
        map.on('mouseleave', OD_NODE_LAYER, onNodeLeave);
        map.on('click', onMapClick);

        return () => {
            map.off('mouseenter', OD_NODE_LAYER, onNodeEnter);
            map.off('mouseleave', OD_NODE_LAYER, onNodeLeave);
            map.off('click', onMapClick);
            popup.remove();
        };
    }, [map, renderSelected, clearSelected]);

    return null;
}
