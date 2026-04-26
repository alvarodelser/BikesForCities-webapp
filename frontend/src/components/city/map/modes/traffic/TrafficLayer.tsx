import { useEffect, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import { useMap } from '../../MapContext';
import { useThresholds } from '../../ThresholdsContext';
import { useMapState } from '../../../../../hooks/useMapState';
import { fetchTraffic, fetchTrafficModes, fetchEdgeRoutes } from '../../../../../services/api';
import type * as GeoJSON from 'geojson';

const LAYER_ID = 'traffic-layer';
const SOURCE_ID = 'edges-source';
const TRACES_SOURCE = 'route-traces-source';
const TRACES_LAYER = 'route-traces-layer';
const OD_SOURCE = 'route-od-source';
const OD_LAYER = 'route-od-layer';

interface TrafficLayerProps {
    submode: string;
}

// ---- DOM popup builder ----
function buildEdgePopupDOM(
    edgeName: string | null,
    tripCount: number | null,
    onClose: () => void,
): HTMLElement {
    const container = document.createElement('div');
    container.style.cssText = "font-family:'Archivo Narrow',sans-serif;padding:2px;min-width:150px;";

    const header = document.createElement('div');
    header.style.cssText = 'display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:6px;border-bottom:1px solid rgba(0,0,0,0.05);padding-bottom:4px;';

    const nameSpan = document.createElement('span');
    nameSpan.style.cssText = 'font-size:12px;font-weight:700;color:#1a202c;';
    nameSpan.textContent = edgeName ?? 'Tramo sin nombre';
    header.appendChild(nameSpan);

    const closeBtn = document.createElement('span');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = 'cursor:pointer;color:rgba(0,0,0,0.3);font-size:11px;flex-shrink:0;';
    closeBtn.onclick = (ev) => { ev.stopPropagation(); onClose(); };
    header.appendChild(closeBtn);
    container.appendChild(header);

    const badge = document.createElement('div');
    badge.style.cssText = 'display:inline-block;padding:3px 10px;border-radius:5px;font-size:12px;font-weight:800;background:#238b45;color:white;';
    if (tripCount != null) {
        badge.innerHTML = `${Math.round(tripCount)} <span style="font-size:10px;font-weight:500;opacity:0.85;">v/mes</span>`;
    } else {
        badge.innerHTML = '<span style="font-size:10px;font-weight:500;">Sin datos</span>';
    }
    container.appendChild(badge);

    const routeInfo = document.createElement('div');
    routeInfo.dataset.routeInfo = 'true';
    routeInfo.style.cssText = 'margin-top:6px;font-size:10px;color:rgba(0,0,0,0.4);';
    routeInfo.textContent = 'Cargando rutas…';
    container.appendChild(routeInfo);

    return container;
}

// Builds a MapLibre color expression: P5→lightest green, P50→mid, P95+→dark (clamped).
function buildColorExpr(q5: number, q50: number, q95: number): unknown[] {
    const s1 = Math.max(q5, 0);
    const s2 = Math.max(q50, s1 + 1);
    const s3 = Math.max(q95, s2 + 1);
    return [
        'case',
        ['==', ['feature-state', 'selected'], true], '#f0c040',
        ['interpolate', ['linear'],
            ['coalesce', ['feature-state', 'trip_count'], 0],
            s1, '#edf8e9',
            s2, '#74c476',
            s3, '#005a32',
        ],
    ];
}

// Edges below P5 (and no-data edges) are hidden; selected edges always visible.
function buildOpacityExpr(q5: number): unknown[] {
    const s1 = Math.max(q5, 0);
    return [
        'case',
        ['==', ['feature-state', 'selected'], true], 1,
        ['>=', ['coalesce', ['feature-state', 'trip_count'], -1], s1], 1,
        0,
    ];
}

export default function TrafficLayer({ submode }: TrafficLayerProps) {
    const { map, city, setSelectedEdgeId } = useMap();
    const { setThresholds } = useThresholds();
    const { generation, routing, setGeneration, setRouting } = useMapState();

    const popupRef = useRef<maplibregl.Popup | null>(null);
    const stickyRef = useRef<{ edgeId: number; lngLat: maplibregl.LngLat } | null>(null);
    const submodeRef = useRef<string>(submode);
    const trafficDataRef = useRef<Map<number, number>>(new Map());
    const routeInfoRef = useRef<HTMLElement | null>(null);

    useEffect(() => { submodeRef.current = submode; }, [submode]);

    // --- Overlay helpers ---
    const clearOverlay = useCallback(() => {
        if (!map) return;
        if (map.getLayer(TRACES_LAYER)) map.removeLayer(TRACES_LAYER);
        if (map.getSource(TRACES_SOURCE)) map.removeSource(TRACES_SOURCE);
        if (map.getLayer(OD_LAYER)) map.removeLayer(OD_LAYER);
        if (map.getSource(OD_SOURCE)) map.removeSource(OD_SOURCE);
    }, [map]);

    const renderOverlay = useCallback((geojson: GeoJSON.FeatureCollection, mode: string) => {
        if (!map) return;
        clearOverlay();
        if (mode === 'heatmap') {
            map.addSource(OD_SOURCE, { type: 'geojson', data: geojson });
            map.addLayer({
                id: OD_LAYER,
                type: 'heatmap',
                source: OD_SOURCE,
                paint: {
                    'heatmap-radius': 20,
                    'heatmap-opacity': 0.72,
                    'heatmap-color': [
                        'interpolate', ['linear'], ['heatmap-density'],
                        0, 'rgba(68,1,84,0)',
                        0.2, '#3b528b',
                        0.4, '#21908c',
                        0.6, '#5ec962',
                        1.0, '#fde725',
                    ],
                },
            });
        } else {
            map.addSource(TRACES_SOURCE, { type: 'geojson', data: geojson });
            map.addLayer({
                id: TRACES_LAYER,
                type: 'line',
                source: TRACES_SOURCE,
                paint: {
                    'line-color': '#f59e0b',
                    'line-width': 1.5,
                    'line-opacity': 0.28,
                },
            }, LAYER_ID);
        }
    }, [map, clearOverlay]);

    const doDeselect = useCallback(() => {
        if (!map || !stickyRef.current) return;
        map.setFeatureState(
            { source: SOURCE_ID, sourceLayer: 'edges', id: stickyRef.current.edgeId },
            { selected: false }
        );
        stickyRef.current = null;
        routeInfoRef.current = null;
        popupRef.current?.remove();
        clearOverlay();
        setSelectedEdgeId(null);
    }, [map, clearOverlay, setSelectedEdgeId]);

    const loadRoutes = useCallback(async (
        edgeId: number,
        mode: string,
        routeInfoEl: HTMLElement | null,
    ) => {
        if (!city?.id) return;
        try {
            const result = await fetchEdgeRoutes(city.id, edgeId, mode as 'traces' | 'heatmap');
            // Bail if the user has already moved to a different edge
            if (!stickyRef.current || stickyRef.current.edgeId !== edgeId) return;
            if (routeInfoEl) {
                routeInfoEl.textContent = result.count > 0
                    ? `${result.count} rutas`
                    : 'Sin rutas registradas';
            }
            if (result.count > 0) renderOverlay(result.data, mode);
        } catch (err) {
            console.error('Failed to fetch edge routes:', err);
            if (routeInfoEl) routeInfoEl.textContent = '';
        }
    }, [city?.id, renderOverlay]);

    // --- Mount: show layer, hide others ---
    useEffect(() => {
        if (!map) return;
        if (map.getLayer(LAYER_ID)) map.setLayoutProperty(LAYER_ID, 'visibility', 'visible');
        if (map.getLayer('stations-layer')) map.setLayoutProperty('stations-layer', 'visibility', 'none');
        if (map.getLayer('bike-paths-layer')) map.setLayoutProperty('bike-paths-layer', 'visibility', 'none');
        return () => {
            if (map.getLayer(LAYER_ID)) map.setLayoutProperty(LAYER_ID, 'visibility', 'none');
            clearOverlay();
            popupRef.current?.remove();
            if (stickyRef.current) {
                map.setFeatureState(
                    { source: SOURCE_ID, sourceLayer: 'edges', id: stickyRef.current.edgeId },
                    { selected: false }
                );
                stickyRef.current = null;
            }
            setSelectedEdgeId(null);
            setThresholds(null);
        };
    }, [map]); // eslint-disable-line react-hooks/exhaustive-deps

    // --- Initialize URL params from best available mode ---
    useEffect(() => {
        if (!city?.id || (generation && routing)) return;
        fetchTrafficModes(city.id).then(modes => {
            if (!modes.length) return;
            const best = modes[0]; // already sorted by priority from backend
            if (!generation) setGeneration(best.generation_type);
            if (!routing) setRouting(best.algorithm);
        }).catch(err => console.error('Failed to load traffic modes:', err));
    }, [city?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    // --- Data fetch: traffic counts (re-runs when generation or routing change) ---
    useEffect(() => {
        if (!map || !city?.id || !generation || !routing) return;
        let cancelled = false;

        // Clear old feature states so stale edge colors don't persist across mode changes
        if (map.getSource(SOURCE_ID)) {
            map.removeFeatureState({ source: SOURCE_ID, sourceLayer: 'edges' });
        }

        fetchTraffic(city.id, generation, routing).then(result => {
            if (cancelled || !map) return;

            result.data.forEach(t => {
                map.setFeatureState(
                    { source: SOURCE_ID, sourceLayer: 'edges', id: t.edge_id },
                    { trip_count: t.trip_count }
                );
            });

            const dataMap = new Map<number, number>();
            result.data.forEach(t => { dataMap.set(t.edge_id, t.trip_count); });
            trafficDataRef.current = dataMap;

            if (result.stats) {
                const { q5, q50, q95, min, max } = result.stats;
                setThresholds({ q5, q50, q95, max, min });
                if (map.getLayer(LAYER_ID)) {
                    map.setPaintProperty(LAYER_ID, 'line-color', buildColorExpr(q5, q50, q95));
                    map.setPaintProperty(LAYER_ID, 'line-opacity', buildOpacityExpr(q5));
                }
            } else {
                setThresholds(null);
            }
        }).catch(err => console.error('Failed to load traffic:', err));

        return () => { cancelled = true; };
    }, [map, city?.id, generation, routing]); // eslint-disable-line react-hooks/exhaustive-deps

    // --- Click handling ---
    useEffect(() => {
        if (!map) return;

        const popup = new maplibregl.Popup({
            closeButton: false,
            closeOnClick: false,
            maxWidth: '200px',
        });
        popupRef.current = popup;

        const onMouseEnter = () => { map.getCanvas().style.cursor = 'pointer'; };
        const onMouseLeave = () => { map.getCanvas().style.cursor = ''; };

        const onClick = (e: maplibregl.MapLayerMouseEvent) => {
            const feature = e.features?.[0];
            if (!feature) return;

            const rawId = feature.id;
            if (rawId == null) return;
            const edgeId = Number(rawId);
            if (stickyRef.current?.edgeId === edgeId) return; // no-op: same edge

            // Deselect previous
            if (stickyRef.current) {
                map.setFeatureState(
                    { source: SOURCE_ID, sourceLayer: 'edges', id: stickyRef.current.edgeId },
                    { selected: false }
                );
                clearOverlay();
                popup.remove();
            }

            const edgeName = (feature.properties?.name as string | undefined) ?? null;
            const tripCount = trafficDataRef.current.get(edgeId) ?? null;

            map.setFeatureState(
                { source: SOURCE_ID, sourceLayer: 'edges', id: edgeId },
                { selected: true }
            );
            stickyRef.current = { edgeId, lngLat: e.lngLat };
            setSelectedEdgeId(edgeId);

            const dom = buildEdgePopupDOM(edgeName, tripCount, () => doDeselect());
            popup.setLngLat(e.lngLat).setDOMContent(dom).addTo(map);

            const routeInfoEl = dom.querySelector<HTMLElement>('[data-route-info]');
            routeInfoRef.current = routeInfoEl;
            loadRoutes(edgeId, submodeRef.current, routeInfoEl);
        };

        const onMapClick = (e: maplibregl.MapMouseEvent) => {
            if (!stickyRef.current) return;
            const hits = map.queryRenderedFeatures(e.point, { layers: [LAYER_ID] });
            if (!hits?.length) doDeselect();
        };

        map.on('mouseenter', LAYER_ID, onMouseEnter);
        map.on('mouseleave', LAYER_ID, onMouseLeave);
        map.on('click', LAYER_ID, onClick);
        map.on('click', onMapClick);

        return () => {
            map.off('mouseenter', LAYER_ID, onMouseEnter);
            map.off('mouseleave', LAYER_ID, onMouseLeave);
            map.off('click', LAYER_ID, onClick);
            map.off('click', onMapClick);
            popup.remove();
        };
    }, [map, loadRoutes, clearOverlay, doDeselect]); // eslint-disable-line react-hooks/exhaustive-deps

    // --- Submode change: re-fetch overlay if an edge is selected ---
    useEffect(() => {
        if (!stickyRef.current) return;
        clearOverlay();
        const routeInfoEl = routeInfoRef.current;
        if (routeInfoEl) routeInfoEl.textContent = 'Cargando rutas…';
        loadRoutes(stickyRef.current.edgeId, submode, routeInfoEl);
    }, [submode]); // intentionally omit clearOverlay/loadRoutes — only re-run on submode change

    return null;
}
