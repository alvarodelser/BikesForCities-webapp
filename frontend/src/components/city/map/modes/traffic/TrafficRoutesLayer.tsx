import { useEffect, useRef, useCallback, useState } from 'react';
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

export default function TrafficRoutesLayer() {
    const { map, city, setSelectedEdgeId, setLayerState, setLayerRetry } = useMap();
    const { setThresholds } = useThresholds();
    const { generation, routing, period, periodFrom, setGeneration, setRouting, setPeriod, setPeriodFrom } = useMapState();

    const [renderMode, setRenderMode] = useState<'traces' | 'heatmap'>('traces');
    const renderModeRef = useRef<'traces' | 'heatmap'>('traces');

    const stickyRef = useRef<{ edgeId: number; lngLat: maplibregl.LngLat } | null>(null);
    const lastSelectionRef = useRef<SelectionDetail | null>(null);
    const thresholdsRef = useRef<{ q5: number; q50: number; q95: number; min: number; max: number } | null>(null);
    const prevGenRef = useRef<string>('');
    const prevRouteRef = useRef<string>('');
    const routeLoadAbortRef = useRef<AbortController | null>(null);

    useEffect(() => { renderModeRef.current = renderMode; }, [renderMode]);

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
                        'heatmap-radius': [
                            'interpolate', ['linear'], ['zoom'],
                            10, 6, 13, 14, 16, 28, 19, 60,
                        ],
                        'heatmap-intensity': [
                            'interpolate', ['linear'], ['zoom'],
                            10, 0.6, 13, 1.0, 16, 1.6, 19, 2.4,
                        ],
                        'heatmap-opacity': [
                            'interpolate', ['linear'], ['zoom'],
                            10, 0.85, 16, 0.7, 19, 0.55,
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
        lastSelectionRef.current = null;
        clearOverlay();
        setSelectedEdgeId(null);
        window.dispatchEvent(new CustomEvent('map-selection', { detail: null }));
        if (map.getLayer(LAYER_ID) && thresholdsRef.current) {
            map.setPaintProperty(LAYER_ID, 'line-opacity', buildOpacityExpr(thresholdsRef.current.q5));
        }
    }, [map, clearOverlay, setSelectedEdgeId]);

    const ROUTE_PAGE_SIZE = 100;

    const handleStopRoutes = useCallback(() => {
        routeLoadAbortRef.current?.abort();
    }, []);

    const loadRoutes = useCallback(async (
        edgeId: number,
        mode: string,
        knownTotal: number | null,
    ) => {
        if (!city?.id) return;

        routeLoadAbortRef.current?.abort();
        const controller = new AbortController();
        routeLoadAbortRef.current = controller;
        clearOverlay();

        const total = knownTotal ?? 0;
        const accumulated: GeoJSON.Feature[] = [];
        let offset = 0;

        const pushProgress = (loaded: number, done: boolean) => {
            const prev = lastSelectionRef.current;
            if (!prev || prev.type !== 'edge') return;
            const rowValue = loaded === 0
                ? 'Cargando…'
                : total > 0
                    ? `${loaded.toLocaleString('es-ES')} / ${total.toLocaleString('es-ES')}`
                    : `${loaded.toLocaleString('es-ES')} rutas`;
            window.dispatchEvent(new CustomEvent('map-selection', {
                detail: {
                    ...prev,
                    rows: [{ label: 'Trayectos', value: done ? `${loaded.toLocaleString('es-ES')} trayectos` : rowValue }],
                    routeProgress: done ? undefined : { loaded, total, onStop: handleStopRoutes },
                } as SelectionDetail,
            }));
        };

        try {
            do {
                if (controller.signal.aborted) break;
                const result = await fetchEdgeRoutes(city.id, edgeId, {
                    mode: mode as 'traces' | 'heatmap',
                    limit: ROUTE_PAGE_SIZE,
                    offset,
                    generationType: generation || undefined,
                    algorithm: routing || undefined,
                    month: period || undefined,
                    monthFrom: periodFrom || undefined,
                    skipCount: true,
                    signal: controller.signal,
                });

                if (controller.signal.aborted) break;
                if (!stickyRef.current || stickyRef.current.edgeId !== edgeId) return;

                accumulated.push(...result.data.features);
                if (accumulated.length > 0) {
                    renderOverlay({ type: 'FeatureCollection', features: accumulated }, mode);
                }
                pushProgress(accumulated.length, false);

                if (result.count === 0) break;
                offset += ROUTE_PAGE_SIZE;
            } while (total === 0 || accumulated.length < total);

            pushProgress(accumulated.length, true);
        } catch (err) {
            if (controller.signal.aborted) {
                pushProgress(accumulated.length, true);
                return;
            }
            console.error('Failed to fetch edge routes:', err);
        }
    }, [city?.id, renderOverlay, clearOverlay, generation, routing, period, periodFrom, handleStopRoutes]);


    // --- Mount: hide others (traffic layer stays hidden until loadData sets tiles + visible) ---
    useEffect(() => {
        if (!map) return;
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

    // Key of the last params we actually applied to the tile source.
    // When we call setGeneration/setPeriod etc. from within the resolve callback, React
    // re-runs this effect. If the re-run's params match what we already applied, we skip
    // the fetch — avoiding the 3-cycle chain that caused the loading bar to flash 4×.
    const lastAppliedParamsRef = useRef('');
    useEffect(() => { lastAppliedParamsRef.current = ''; }, [city?.id]);

    // --- Data fetch: resolve traffic params, then re-point the tile source ---
    useEffect(() => {
        if (!map || !city?.id) return;
        let cancelled = false;

        prevGenRef.current = generation;
        prevRouteRef.current = routing;

        const combos = (city?.available_modes?.traffic_combinations as any[]) || [];
        if (!generation && !routing && combos.length > 0) {
            const first = combos[0];
            setGeneration(first.generation_type);
            setRouting(first.algorithm);
            return;
        }

        // Skip if this re-run was caused by our own setState calls (params already applied).
        const currentKey = `${generation || ''}|${routing || ''}|${period || ''}|${periodFrom || ''}`;
        if (currentKey === lastAppliedParamsRef.current) return;

        const loadData = () => {
            if (cancelled) return;
            setLayerState?.('loading');

            fetchTrafficResolve(city!.id!, generation || undefined, routing || undefined, period || undefined, periodFrom || undefined).then(result => {
                if (cancelled || !map) return;

                if (!result.generation_type || !result.algorithm || !result.month) {
                    setLayerState?.('empty');
                    return;
                }

                // resolvedMonthStr is the latest month that actually has data for the
                // selected generation_type/algorithm — use it as the default when
                // period/periodFrom are not yet set in the URL.
                const resolvedMonthStr = result.month.slice(0, 7);
                const rawTo   = period     || resolvedMonthStr;
                const rawFrom = periodFrom || resolvedMonthStr;

                // Enforce chronological order — user or race-condition can produce periodFrom > period.
                const effectivePeriodTo   = rawFrom <= rawTo ? rawTo   : rawFrom;
                const effectivePeriodFrom = rawFrom <= rawTo ? rawFrom : rawTo;

                // Record applied params BEFORE calling setState so the resulting re-run
                // finds the key and skips without another fetch.
                lastAppliedParamsRef.current =
                    `${result.generation_type}|${result.algorithm}|${effectivePeriodTo}|${effectivePeriodFrom}`;

                // Update URL params for navigation (triggers re-run, but ref prevents re-fetch).
                // Also corrects any inverted range that was stored in the URL.
                if (!generation) setGeneration(result.generation_type);
                if (!routing) setRouting(result.algorithm);
                if (period !== effectivePeriodTo) setPeriod(effectivePeriodTo);
                if (periodFrom !== effectivePeriodFrom) setPeriodFrom(effectivePeriodFrom);

                setLayerState?.('idle');

                const src = map.getSource(SOURCE_ID) as maplibregl.VectorTileSource | undefined;
                if (src) {
                    const tileParams = new URLSearchParams();
                    tileParams.set('generation_type', result.generation_type);
                    tileParams.set('algorithm', result.algorithm);
                    // Use full-date string from resolve result only when it matches the effective end month;
                    // otherwise append -01 so the tile function receives a valid DATE string.
                    tileParams.set('month', effectivePeriodTo === resolvedMonthStr
                        ? result.month
                        : effectivePeriodTo + '-01');
                    if (effectivePeriodFrom !== effectivePeriodTo) {
                        tileParams.set('month_from', effectivePeriodFrom + '-01');
                    }

                    const newTileUrl = `${TILE_SERVER_URL}/edges_with_traffic/{z}/{x}/{y}?${tileParams.toString()}`;
                    src.setTiles([newTileUrl]);
                    // setTiles() clears the tile cache; triggerRepaint() ensures MapLibre
                    // re-evaluates visible tiles for the current viewport without requiring
                    // a pan/zoom interaction (unlike fitBounds which infrastructure mode uses).
                    map.triggerRepaint();
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
    }, [map, city?.id, generation, routing, period, periodFrom, setLayerState, setLayerRetry]);

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
            if (stickyRef.current?.edgeId === edgeId) return;

            if (stickyRef.current) {
                map.setFeatureState(
                    { source: SOURCE_ID, sourceLayer: 'edges', id: stickyRef.current.edgeId },
                    { selected: false }
                );
                clearOverlay();
            }

            const edgeName = (feature.properties?.name as string | undefined) ?? null;
            const tripCount = (feature.properties?.trip_count as number | undefined) ?? null;

            map.setFeatureState(
                { source: SOURCE_ID, sourceLayer: 'edges', id: edgeId },
                { selected: true }
            );
            stickyRef.current = { edgeId, lngLat: e.lngLat };
            setSelectedEdgeId(edgeId);

            if (map.getLayer(LAYER_ID)) {
                map.setPaintProperty(LAYER_ID, 'line-opacity', [
                    'case',
                    ['==', ['feature-state', 'selected'], true], 1,
                    0,
                ]);
            }

            const detail: SelectionDetail = {
                type: 'edge',
                title: edgeName ?? 'Tramo sin nombre',
                badge: tripCount != null
                    ? { text: `${Math.round(tripCount)} v/mes`, color: '#027A76' }
                    : { text: 'Sin datos', color: '#9ca3af' },
                rows: [{ label: 'Trayectos', value: 'Cargando…' }],
                colormap: thresholdsRef.current
                    ? { ...thresholdsRef.current, value: tripCount }
                    : undefined,
                submodeOptions: [
                    { id: 'traces', label: 'Trayecto' },
                    { id: 'heatmap', label: 'Calor' },
                ],
                activeSubmode: renderModeRef.current,
                onSubmodeChange: (id: string) => setRenderMode(id as 'traces' | 'heatmap'),
            };
            lastSelectionRef.current = detail;
            window.dispatchEvent(new CustomEvent('map-selection', { detail }));

            loadRoutes(edgeId, renderModeRef.current, tripCount);
        };

        const onMapClick = (e: maplibregl.MapMouseEvent) => {
            const hits = map.queryRenderedFeatures(e.point, { layers: [LAYER_ID] });
            if (stickyRef.current && !hits?.length) doDeselect();
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

    // --- renderMode / filter change: re-fetch overlay if an edge is selected ---
    useEffect(() => {
        if (!stickyRef.current) return;
        const tripCount = lastSelectionRef.current?.badge
            ? parseFloat(lastSelectionRef.current.badge.text) || null
            : null;
        loadRoutes(stickyRef.current.edgeId, renderMode, tripCount);
    }, [renderMode, generation, routing, period, periodFrom]); // eslint-disable-line react-hooks/exhaustive-deps

    return null;
}
