import { useEffect, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import { useMap } from '../../MapContext';
import { useThresholds } from '../../ThresholdsContext';
import { useMapState } from '../../../../../hooks/useMapState';
import { fetchTraffic, fetchEdgeRoutes } from '../../../../../services/api';
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
    container.style.cssText = "font-family:'Archivo Narrow',sans-serif;padding:8px 10px;min-width:150px;";

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

interface OverlayHandle {
    panel: HTMLDivElement;
    svg: SVGSVGElement;
    line: SVGLineElement;
    dot: SVGCircleElement;
}

export default function TrafficLayer({ submode }: TrafficLayerProps) {
    const { map, city, setSelectedEdgeId } = useMap();
    const { setThresholds } = useThresholds();
    const { generation, routing, setGeneration, setRouting } = useMapState();

    const overlayRef = useRef<OverlayHandle | null>(null);
    const stickyRef = useRef<{ edgeId: number; lngLat: maplibregl.LngLat } | null>(null);
    const submodeRef = useRef<string>(submode);
    const trafficDataRef = useRef<Map<number, number>>(new Map());
    const routeInfoRef = useRef<HTMLElement | null>(null);
    // Stores the latest percentile stats so doDeselect can restore the opacity expression
    const thresholdsRef = useRef<{ q5: number; q50: number; q95: number; min: number; max: number } | null>(null);
    // Track previous generation/routing to detect actual mode changes vs. initial auto-resolve
    const prevGenRef = useRef<string>('');
    const prevRouteRef = useRef<string>('');

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
                    'heatmap-radius': 22,
                    'heatmap-opacity': 0.75,
                    'heatmap-color': [
                        'interpolate', ['linear'], ['heatmap-density'],
                        0,   'rgba(0,0,0,0)',
                        0.2, '#BFDDCE',
                        0.45,'#7BA492',
                        0.75,'#027A76',
                        1.0, '#014440',
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
                    'line-color': '#027A76',
                    'line-width': 1.5,
                    'line-opacity': 0.35,
                },
            }, LAYER_ID);
        }
    }, [map, clearOverlay]);

    // --- Custom popup overlay (fixed top-right panel + SVG connecting line) ---
    const updateLine = useCallback(() => {
        if (!map || !overlayRef.current || !stickyRef.current) return;
        const { panel, line, dot, svg } = overlayRef.current;
        const edgePt = map.project(stickyRef.current.lngLat);
        const containerEl = map.getContainer();
        svg.setAttribute('width', String(containerEl.clientWidth));
        svg.setAttribute('height', String(containerEl.clientHeight));
        const cRect = containerEl.getBoundingClientRect();
        const pRect = panel.getBoundingClientRect();
        const x1 = pRect.left - cRect.left;
        const y1 = pRect.top - cRect.top + pRect.height / 2;
        line.setAttribute('x1', String(x1));
        line.setAttribute('y1', String(y1));
        line.setAttribute('x2', String(edgePt.x));
        line.setAttribute('y2', String(edgePt.y));
        dot.setAttribute('cx', String(edgePt.x));
        dot.setAttribute('cy', String(edgePt.y));
    }, [map]);

    const removePopupOverlay = useCallback(() => {
        if (!overlayRef.current) return;
        if (map) map.off('move', updateLine);
        overlayRef.current.panel.remove();
        overlayRef.current.svg.remove();
        overlayRef.current = null;
    }, [map, updateLine]);

    const showPopupOverlay = useCallback((dom: HTMLElement, lngLat: maplibregl.LngLat) => {
        if (!map) return;
        removePopupOverlay();

        const mapContainer = map.getContainer();

        const panel = document.createElement('div') as HTMLDivElement;
        panel.style.cssText = 'position:absolute;top:60px;right:10px;z-index:10;background:white;border-radius:8px;box-shadow:0 2px 12px rgba(0,0,0,0.18);border:1px solid rgba(0,0,0,0.08);pointer-events:auto;';
        panel.appendChild(dom);

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg') as SVGSVGElement;
        svg.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;z-index:9;overflow:visible;';

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line') as SVGLineElement;
        line.setAttribute('stroke', '#027A76');
        line.setAttribute('stroke-width', '1.5');
        line.setAttribute('stroke-dasharray', '5 4');
        line.setAttribute('stroke-opacity', '0.6');

        const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle') as SVGCircleElement;
        dot.setAttribute('r', '4');
        dot.setAttribute('fill', '#027A76');
        dot.setAttribute('fill-opacity', '0.7');

        svg.appendChild(line);
        svg.appendChild(dot);
        mapContainer.appendChild(svg);
        mapContainer.appendChild(panel);

        overlayRef.current = { panel, svg, line, dot };
        map.on('move', updateLine);
        requestAnimationFrame(updateLine);
    }, [map, removePopupOverlay, updateLine]);

    const doDeselect = useCallback(() => {
        if (!map || !stickyRef.current) return;
        map.setFeatureState(
            { source: SOURCE_ID, sourceLayer: 'edges', id: stickyRef.current.edgeId },
            { selected: false }
        );
        stickyRef.current = null;
        routeInfoRef.current = null;
        removePopupOverlay();
        clearOverlay();
        setSelectedEdgeId(null);
        // Restore full traffic opacity (re-show all edges above P5)
        if (map.getLayer(LAYER_ID) && thresholdsRef.current) {
            map.setPaintProperty(LAYER_ID, 'line-opacity', buildOpacityExpr(thresholdsRef.current.q5));
        }
    }, [map, clearOverlay, setSelectedEdgeId, removePopupOverlay]);

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
            removePopupOverlay();
            if (stickyRef.current) {
                map.setFeatureState(
                    { source: SOURCE_ID, sourceLayer: 'edges', id: stickyRef.current.edgeId },
                    { selected: false }
                );
                stickyRef.current = null;
            }
            // Clear all feature states so they don't linger while the layer is hidden
            if (map.getSource(SOURCE_ID)) {
                map.removeFeatureState({ source: SOURCE_ID, sourceLayer: 'edges' });
            }
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

    // --- Data fetch: traffic counts ---
    // Runs whenever map, city, generation or routing change.
    // generation/routing may be empty on first load — backend resolves to best available mode.
    useEffect(() => {
        if (!map || !city?.id) return;
        let cancelled = false;

        // Only clear stale feature states when the user explicitly switches between modes
        // (both previous values are known and at least one changed). Skipped on initial
        // load or on the auto-resolve re-fetch to avoid a flicker.
        const prevGen = prevGenRef.current;
        const prevRoute = prevRouteRef.current;
        const modeActuallyChanged = (prevGen || prevRoute) && (prevGen !== generation || prevRoute !== routing);
        prevGenRef.current = generation;
        prevRouteRef.current = routing;

        if (modeActuallyChanged && map.getSource(SOURCE_ID)) {
            map.removeFeatureState({ source: SOURCE_ID, sourceLayer: 'edges' });
            // Re-apply selection highlight that was wiped by the bulk clear
            if (stickyRef.current) {
                map.setFeatureState(
                    { source: SOURCE_ID, sourceLayer: 'edges', id: stickyRef.current.edgeId },
                    { selected: true }
                );
            }
        }

        fetchTraffic(city.id, generation || undefined, routing || undefined).then(result => {
            if (cancelled || !map) return;

            // On first load with empty URL params, write resolved values back so the
            // legend selectors and bookmarks reflect the actual mode being shown.
            if (!urlParamsSetRef.current) {
                urlParamsSetRef.current = true;
                if (!generation && result.generation_type) setGeneration(result.generation_type);
                if (!routing && result.algorithm) setRouting(result.algorithm);
            }

            result.data.forEach(t => {
                map.setFeatureState(
                    { source: SOURCE_ID, sourceLayer: 'edges', id: t.edge_id },
                    { trip_count: t.trip_count }
                );
            });

            const dataMap = new Map<number, number>();
            result.data.forEach(t => { dataMap.set(t.edge_id, t.trip_count); });
            trafficDataRef.current = dataMap;

            // Use server-computed percentile stats; fall back to client-side sort if absent
            let stats = result.stats;
            if (!stats && result.data.length > 0) {
                const counts = result.data.map(t => t.trip_count).sort((a, b) => a - b);
                stats = {
                    q5:  counts[Math.floor(counts.length * 0.05)],
                    q50: counts[Math.floor(counts.length * 0.50)],
                    q95: counts[Math.floor(counts.length * 0.95)],
                    min: counts[0],
                    max: counts[counts.length - 1],
                };
            }

            if (stats) {
                thresholdsRef.current = stats;
                const { q5, q50, q95, min, max } = stats;
                setThresholds({ q5, q50, q95, max, min });
                if (map.getLayer(LAYER_ID)) {
                    map.setPaintProperty(LAYER_ID, 'line-color', buildColorExpr(q5, q50, q95));
                    // Only restore full opacity if no edge is currently selected
                    if (!stickyRef.current) {
                        map.setPaintProperty(LAYER_ID, 'line-opacity', buildOpacityExpr(q5));
                    }
                }
            } else {
                thresholdsRef.current = null;
                setThresholds(null);
            }
        }).catch(err => console.error('Failed to load traffic:', err));

        return () => { cancelled = true; };
    }, [map, city?.id, generation, routing]); // eslint-disable-line react-hooks/exhaustive-deps

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
                removePopupOverlay();
            }

            const edgeName = (feature.properties?.name as string | undefined) ?? null;
            const tripCount = trafficDataRef.current.get(edgeId) ?? null;

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
            showPopupOverlay(dom, e.lngLat);

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
            removePopupOverlay();
        };
    }, [map, loadRoutes, clearOverlay, doDeselect, showPopupOverlay, removePopupOverlay]); // eslint-disable-line react-hooks/exhaustive-deps

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
