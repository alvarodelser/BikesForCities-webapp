import { useEffect, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import { useMap } from '../../MapContext';
import { useThresholds } from '../../ThresholdsContext';
import { useMapState } from '../../../../../hooks/useMapState';
import { fetchTrafficResolve, fetchEdgeRoutes } from '../../../../../services/api';
import { TILE_SERVER_URL } from '../../../../../config/api';
import type * as GeoJSON from 'geojson';
import type { SelectionDetail } from '../../../../../types/selection';

const LAYER_ID = 'traffic-layer';
const SOURCE_ID = 'edges-source';
const TRACES_SOURCE = 'traces-source';
const TRACES_LAYER = 'traces-layer';
const OD_SOURCE = 'od-source';
const OD_LAYER = 'od-layer';

export interface TrafficLayerProps {
    submode: string;
}

function buildEdgePopupDOM(edgeName: string | null, tripCount: number | null, onClose: () => void): HTMLElement {
    const container = document.createElement('div');
    container.style.cssText = 'padding:10px;min-width:200px;';
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;';
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
    badge.style.cssText = 'display:inline-block;padding:3px 10px;border-radius:5px;font-size:12px;font-weight:800;background:#027A76;color:white;';
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

// Builds a MapLibre color expression using tile property 'trip_count' (baked in by Martin).
// P5→lightest green, P50→mid, P95+→dark (clamped).
function buildColorExpr(q5: number, q50: number, q95: number): unknown[] {
    const s1 = Math.max(q5, 0);
    const s2 = Math.max(q50, s1 + 1);
    const s3 = Math.max(q95, s2 + 1);
    return [
        'case',
        ['==', ['feature-state', 'selected'], true], '#f0c040',
        ['interpolate', ['linear'],
            ['coalesce', ['get', 'trip_count'], 0],
            s1, '#edf8e9',
            s2, '#74c476',
            s3, '#005a32',
        ],
    ];
}

// Edges with trip_count below P5 (and zero-count edges) are hidden; selected always visible.
function buildOpacityExpr(q5: number): unknown[] {
    const s1 = Math.max(q5, 0);
    return [
        'case',
        ['==', ['feature-state', 'selected'], true], 1,
        ['>=', ['coalesce', ['get', 'trip_count'], 0], s1], 1,
        0,
    ];
}


export default function TrafficLayer({ submode }: TrafficLayerProps) {
    const { map, city, setSelectedEdgeId, setLayerState, setLayerRetry } = useMap();
    const { setThresholds } = useThresholds();
    const { generation, routing, period, setGeneration, setRouting, setPeriod, setSubmode } = useMapState();

    const stickyRef = useRef<{ edgeId: number; lngLat: maplibregl.LngLat } | null>(null);
    const submodeRef = useRef<string>(submode);
    const routeInfoRef = useRef<HTMLElement | null>(null);
    const lastSelectionRef = useRef<SelectionDetail | null>(null);
    // Stores the latest percentile stats so doDeselect can restore the opacity expression
    const thresholdsRef = useRef<{ q5: number; q50: number; q95: number; min: number; max: number } | null>(null);
    // Track previous generation/routing to detect actual mode changes vs. initial auto-resolve
    const prevGenRef = useRef<string>('');
    const prevRouteRef = useRef<string>('');
    // Aborts in-flight pagination loops when the selection or filters change
    const routeLoadAbortRef = useRef<AbortController | null>(null);


    useEffect(() => { submodeRef.current = submode; }, [submode]);

    // --- Overlay helpers ---
    const clearOverlay = useCallback(() => {
        if (!map) return;
        try {
            if (map.getLayer(TRACES_LAYER)) map.removeLayer(TRACES_LAYER);
            if (map.getSource(TRACES_SOURCE)) map.removeSource(TRACES_SOURCE);
            if (map.getLayer(OD_LAYER)) map.removeLayer(OD_LAYER);
            if (map.getSource(OD_SOURCE)) map.removeSource(OD_SOURCE);
        } catch { /* map may have been removed */ }
    }, [map]);

    const renderOverlay = useCallback((geojson: GeoJSON.FeatureCollection, mode: string) => {
        if (!map) return;
        if (mode === 'heatmap') {
            // Drop traces if switching modes mid-load
            if (map.getLayer(TRACES_LAYER)) map.removeLayer(TRACES_LAYER);
            if (map.getSource(TRACES_SOURCE)) map.removeSource(TRACES_SOURCE);
            const existing = map.getSource(OD_SOURCE) as maplibregl.GeoJSONSource | undefined;
            if (existing) {
                existing.setData(geojson);
            } else {
                map.addSource(OD_SOURCE, { type: 'geojson', data: geojson });
                map.addLayer({
                    id: OD_LAYER,
                    type: 'heatmap',
                    source: OD_SOURCE,
                    paint: {
                        // Radius grows with zoom so blobs stay readable at any scale
                        'heatmap-radius': [
                            'interpolate', ['linear'], ['zoom'],
                            10, 6,
                            13, 14,
                            16, 28,
                            19, 60,
                        ],
                        // Intensity climbs with zoom to keep density visible as points spread out
                        'heatmap-intensity': [
                            'interpolate', ['linear'], ['zoom'],
                            10, 0.6,
                            13, 1.0,
                            16, 1.6,
                            19, 2.4,
                        ],
                        // Fade slightly when zoomed in so individual points don't drown the basemap
                        'heatmap-opacity': [
                            'interpolate', ['linear'], ['zoom'],
                            10, 0.85,
                            16, 0.7,
                            19, 0.55,
                        ],
                        'heatmap-color': [
                            'interpolate', ['linear'], ['heatmap-density'],
                            0, 'rgba(0,0,0,0)',
                            0.2, '#BFDDCE',
                            0.45, '#7BA492',
                            0.75, '#027A76',
                            1.0, '#014440',
                        ],
                    },
                });
            }
        } else {
            if (map.getLayer(OD_LAYER)) map.removeLayer(OD_LAYER);
            if (map.getSource(OD_SOURCE)) map.removeSource(OD_SOURCE);
            const existing = map.getSource(TRACES_SOURCE) as maplibregl.GeoJSONSource | undefined;
            if (existing) {
                existing.setData(geojson);
            } else {
                map.addSource(TRACES_SOURCE, { type: 'geojson', data: geojson });
                map.addLayer({
                    id: TRACES_LAYER,
                    type: 'line',
                    source: TRACES_SOURCE,
                    paint: {
                        'line-color': '#027A76',
                        'line-width': 1.5,
                        'line-opacity': 0.35,
                    },
                }, LAYER_ID);
            }
        }
    }, [map]);

    const doDeselect = useCallback(() => {
        if (!map || !stickyRef.current) return;
        routeLoadAbortRef.current?.abort();
        routeLoadAbortRef.current = null;
        map.setFeatureState(
            { source: SOURCE_ID, sourceLayer: 'edges', id: stickyRef.current.edgeId },
            { selected: false }
        );
        stickyRef.current = null;
        routeInfoRef.current = null;
        lastSelectionRef.current = null;
        clearOverlay();
        setSelectedEdgeId(null);
        window.dispatchEvent(new CustomEvent('map-selection', { detail: null }));
        // Restore full traffic opacity (re-show all edges above P5)
        if (map.getLayer(LAYER_ID) && thresholdsRef.current) {
            map.setPaintProperty(LAYER_ID, 'line-opacity', buildOpacityExpr(thresholdsRef.current.q5));
        }
    }, [map, clearOverlay, setSelectedEdgeId]);


    const ROUTE_PAGE_SIZE = 100;

    /**
     * Iteratively loads all routes for an edge in pages of ROUTE_PAGE_SIZE,
     * appending features to the map source and updating the selection-panel
     * label as progress advances ("123 / 4567 rutas"). Cancels via AbortController
     * when the user picks a different edge or changes filters.
     */
    const loadRoutes = useCallback(async (
        edgeId: number,
        mode: string,
        routeInfoEl: HTMLElement | null,
    ) => {
        if (!city?.id) return;

        // Cancel any in-flight pagination loop and start a fresh one
        routeLoadAbortRef.current?.abort();
        const controller = new AbortController();
        routeLoadAbortRef.current = controller;

        // Drop any stale overlay (different edge or different filters) so the
        // first batch of the new load isn't painted on top of the old data.
        clearOverlay();

        const accumulated: GeoJSON.Feature[] = [];
        let offset = 0;
        let total = 0;

        const updateLabel = (loaded: number, knownTotal: number) => {
            if (knownTotal === 0) {
                const label = 'Sin rutas';
                if (routeInfoEl) routeInfoEl.textContent = label;
                const prev = lastSelectionRef.current;
                if (prev && prev.type === 'edge') {
                    window.dispatchEvent(new CustomEvent('map-selection', {
                        detail: {
                            ...prev,
                            rows: [{ label: 'Rutas', value: label }],
                        } as SelectionDetail
                    }));
                }
                return;
            }
            const label = loaded >= knownTotal
                ? `${knownTotal} rutas`
                : `${loaded} / ${knownTotal} rutas`;
            if (routeInfoEl) routeInfoEl.textContent = label;
            const prev = lastSelectionRef.current;
            if (prev && prev.type === 'edge') {
                window.dispatchEvent(new CustomEvent('map-selection', {
                    detail: {
                        ...prev,
                        rows: [{ label: 'Rutas', value: label }],
                    } as SelectionDetail
                }));
            }
        };

        try {
            do {
                if (controller.signal.aborted) return;
                const result = await fetchEdgeRoutes(city.id, edgeId, {
                    mode: mode as 'traces' | 'heatmap',
                    limit: ROUTE_PAGE_SIZE,
                    offset,
                    generationType: generation || undefined,
                    algorithm: routing || undefined,
                    month: period || undefined,
                });

                if (controller.signal.aborted) return;
                if (!stickyRef.current || stickyRef.current.edgeId !== edgeId) return;

                total = result.total;
                accumulated.push(...result.data.features);

                if (accumulated.length > 0) {
                    renderOverlay(
                        { type: 'FeatureCollection', features: accumulated },
                        mode,
                    );
                }
                updateLabel(accumulated.length, total);

                if (result.count === 0) break;
                offset += ROUTE_PAGE_SIZE;
            } while (accumulated.length < total);
        } catch (err) {
            if (controller.signal.aborted) return;
            console.error('Failed to fetch edge routes:', err);
            if (routeInfoEl) routeInfoEl.textContent = '';
        }
    }, [city?.id, renderOverlay, clearOverlay, generation, routing, period]);


    // --- Mount: show layer, hide others ---
    useEffect(() => {
        if (!map) return;
        if (map.getLayer(LAYER_ID)) map.setLayoutProperty(LAYER_ID, 'visibility', 'visible');
        if (map.getLayer('stations-layer')) map.setLayoutProperty('stations-layer', 'visibility', 'none');
        if (map.getLayer('bike-paths-layer')) map.setLayoutProperty('bike-paths-layer', 'visibility', 'none');
        return () => {
            try {
                if (map.getLayer(LAYER_ID)) map.setLayoutProperty(LAYER_ID, 'visibility', 'none');
                clearOverlay();
                if (stickyRef.current) {
                    map.setFeatureState(
                        { source: SOURCE_ID, sourceLayer: 'edges', id: stickyRef.current.edgeId },
                        { selected: false }
                    );
                }
                if (map.getSource(SOURCE_ID)) {
                    map.removeFeatureState({ source: SOURCE_ID, sourceLayer: 'edges' });
                }
            } catch { /* map may have been removed */ }
            stickyRef.current = null;
            prevGenRef.current = '';
            prevRouteRef.current = '';
            setSelectedEdgeId(null);
            setThresholds(null);
            thresholdsRef.current = null;
        };
    }, [map]); // eslint-disable-line react-hooks/exhaustive-deps

    // Tracks whether we've written resolved generation/routing back to the URL already
    const urlParamsSetRef = useRef(false);
    useEffect(() => { urlParamsSetRef.current = false; }, [city?.id]);

    // --- Data fetch: resolve traffic params, then re-point the tile source ---
    useEffect(() => {
        if (!map || !city?.id) return;
        let cancelled = false;

        const prevGen = prevGenRef.current;
        const prevRoute = prevRouteRef.current;
        const modeActuallyChanged = (prevGen || prevRoute) && (prevGen !== generation || prevRoute !== routing);
        prevGenRef.current = generation;
        prevRouteRef.current = routing;

        // Immediate sync from city data if URL is empty
        const combos = (city?.available_modes?.traffic_combinations as any[]) || [];
        if (!generation && !routing && combos.length > 0) {
            const first = combos[0];
            setGeneration(first.generation_type);
            setRouting(first.algorithm);
            return; // URL change will trigger re-run
        }

        const loadData = () => {
            if (cancelled) return;
            setLayerState?.('loading');

            fetchTrafficResolve(city!.id!, generation || undefined, routing || undefined, period || undefined).then(result => {
                if (cancelled || !map) return;

                if (!result.generation_type || !result.algorithm || !result.month) {
                    setLayerState?.('empty');
                    return;
                }
                setLayerState?.('idle');

                // Write resolved values back to URL params if they were missing.
                let urlChanged = false;
                if (!generation && result.generation_type) { setGeneration(result.generation_type); urlChanged = true; }
                if (!routing && result.algorithm) { setRouting(result.algorithm); urlChanged = true; }

                // Also sync the period (month) to URL if missing. Format is YYYY-MM.
                if (!period && result.month) {
                    const resolvedMonthStr = result.month.slice(0, 7);
                    setPeriod(resolvedMonthStr);
                    urlChanged = true;
                }

                if (urlChanged) return; // Wait for next render driven by URL change

                // Re-point the tile source to the resolved (gen, algo, month) slice.
                const src = map.getSource(SOURCE_ID) as maplibregl.VectorTileSource | undefined;
                if (src) {
                    const tileParams = new URLSearchParams();
                    tileParams.set('generation_type', result.generation_type);
                    tileParams.set('algorithm', result.algorithm);
                    tileParams.set('month', result.month); // already YYYY-MM-DD from backend

                    const newTileUrl = `${TILE_SERVER_URL}/edges/{z}/{x}/{y}?${tileParams.toString()}`;
                    console.log(`[TrafficLayer] Updating tile source: ${newTileUrl}`);

                    const currentTiles = (src as any).tiles;
                    if (!currentTiles || currentTiles[0] !== newTileUrl) {
                        (src as any).setTiles([newTileUrl]);
                    }
                }

                const stats = result.stats;
                if (stats) {
                    thresholdsRef.current = stats;
                    const { q5, q50, q95, min, max } = stats;
                    setThresholds({ q5, q50, q95, max, min });
                    if (map.getLayer(LAYER_ID)) {
                        map.setPaintProperty(LAYER_ID, 'line-color', buildColorExpr(q5, q50, q95));
                        if (!stickyRef.current) {
                            map.setPaintProperty(LAYER_ID, 'line-opacity', buildOpacityExpr(q5));
                        }
                        map.setLayoutProperty(LAYER_ID, 'visibility', 'visible');
                    }
                } else {
                    thresholdsRef.current = null;
                    setThresholds(null);
                }
            }).catch(err => {
                if (cancelled) return;
                console.error('Failed to resolve traffic:', err);
                setLayerState?.('error');
            });
        };

        setLayerRetry?.(loadData);
        loadData();

        return () => {
            cancelled = true;
            setLayerState?.('idle');
        };
    }, [map, city?.id, generation, routing, period, setLayerState, setLayerRetry]);

    // --- Click handling ---
    useEffect(() => {
        if (!map) return;

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
            }

            const edgeName = (feature.properties?.name as string | undefined) ?? null;
            // trip_count is now a tile property (baked by Martin), read directly
            const tripCount = (feature.properties?.trip_count as number | undefined) ?? null;

            map.setFeatureState(
                { source: SOURCE_ID, sourceLayer: 'edges', id: edgeId },
                { selected: true }
            );
            stickyRef.current = { edgeId, lngLat: e.lngLat };
            setSelectedEdgeId(edgeId);

            // Hide all non-selected edges so the route overlay is readable
            if (map.getLayer(LAYER_ID)) {
                map.setPaintProperty(LAYER_ID, 'line-opacity', [
                    'case',
                    ['==', ['feature-state', 'selected'], true], 1,
                    0,
                ]);
            }

            const dom = buildEdgePopupDOM(edgeName, tripCount, () => doDeselect());
            // Dispatch to React SelectionPanel
            const detail: SelectionDetail = {
                type: 'edge',
                title: edgeName ?? 'Tramo sin nombre',
                badge: tripCount != null
                    ? { text: `${Math.round(tripCount)} v/mes`, color: '#027A76' }
                    : { text: 'Sin datos', color: '#9ca3af' },
                rows: [{ label: 'Rutas', value: 'Cargando…' }],
                submodeOptions: [
                    { id: 'traces', label: 'Trayecto' },
                    { id: 'heatmap', label: 'Calor' },
                ],
                activeSubmode: submodeRef.current,
                onSubmodeChange: (id: string) => setSubmode(id),
            };
            lastSelectionRef.current = detail;
            window.dispatchEvent(new CustomEvent('map-selection', { detail }));

            const routeInfoEl = dom.querySelector<HTMLElement>('[data-route-info]');
            routeInfoRef.current = routeInfoEl;
            loadRoutes(edgeId, submodeRef.current, routeInfoEl);
        };

        const onMapClick = (e: maplibregl.MapMouseEvent) => {
            if (!stickyRef.current) return;
            const hits = map.queryRenderedFeatures(e.point, { layers: [LAYER_ID] });
            if (!hits?.length) doDeselect();
        };


        const onPanelClose = () => { doDeselect(); };

        map.on('mouseenter', LAYER_ID, onMouseEnter);
        map.on('mouseleave', LAYER_ID, onMouseLeave);
        map.on('click', LAYER_ID, onClick);
        map.on('click', onMapClick);
        window.addEventListener('map-selection-close', onPanelClose);


        return () => {
            map.off('mouseenter', LAYER_ID, onMouseEnter);
            map.off('mouseleave', LAYER_ID, onMouseLeave);
            map.off('click', LAYER_ID, onClick);
            map.off('click', onMapClick);
            window.removeEventListener('map-selection-close', onPanelClose);
        };
    }, [map, loadRoutes, clearOverlay, doDeselect]); // eslint-disable-line react-hooks/exhaustive-deps

    // --- Submode / filter change: re-fetch overlay if an edge is selected ---
    // Re-runs when the user toggles Trayecto/Calor or changes generation/algorithm/month
    // while an edge is selected. loadRoutes itself aborts the previous loop and clears
    // the overlay before starting the new pagination.
    useEffect(() => {
        if (!stickyRef.current) return;
        const routeInfoEl = routeInfoRef.current;
        if (routeInfoEl) routeInfoEl.textContent = 'Cargando rutas…';
        loadRoutes(stickyRef.current.edgeId, submode, routeInfoEl);
    }, [submode, generation, routing, period]); // eslint-disable-line react-hooks/exhaustive-deps

    return null;
}
