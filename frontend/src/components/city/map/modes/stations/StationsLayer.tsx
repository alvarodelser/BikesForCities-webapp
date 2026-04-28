import { useEffect, useState, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import { useMap } from '../../MapContext';
import { useThresholds } from '../../ThresholdsContext';
import { fetchStations, fetchStationHourlyAvailability, fetchStationReach } from '../../../../../services/api';
import type { HourlyAvailability } from '../../../../../services/api';
import type { SelectionDetail } from '../../../../../types/selection';


// Helper to interpolate between two hex colours
const interpolateColor = (c1: string, c2: string, factor: number) => {
    const r1 = parseInt(c1.substring(1, 3), 16);
    const g1 = parseInt(c1.substring(3, 5), 16);
    const b1 = parseInt(c1.substring(5, 7), 16);
    const r2 = parseInt(c2.substring(1, 3), 16);
    const g2 = parseInt(c2.substring(3, 5), 16);
    const b2 = parseInt(c2.substring(5, 7), 16);
    const r = Math.round(r1 + factor * (r2 - r1));
    const g = Math.round(g1 + factor * (g2 - g1));
    const b = Math.round(b1 + factor * (b2 - b1));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};

const getMetricColor = (val: number, q5: number, q50: number, q95: number, metric: 'trips' | 'downtime') => {
    if (val < q5) return metric === 'trips' ? '#A0AEC0' : '#FEE2E2';
    if (val > q95) return metric === 'trips' ? '#042F2E' : '#450A0A';
    const colors = metric === 'trips'
        ? ['#D1FAE5', '#34D399', '#065F46']
        : ['#FEE2E2', '#EF4444', '#7F1D1D'];
    if (val < q50) {
        return interpolateColor(colors[0], colors[1], Math.max(0, Math.min(1, (val - q5) / (q50 - q5 || 1))));
    }
    return interpolateColor(colors[1], colors[2], Math.max(0, Math.min(1, (val - q50) / (q95 - q50 || 1))));
};

// --- Cropped viridis for reach edges (purple → blue → teal → green, no yellow) ---
const VIRIDIS_STOPS = [
    { stop: 0.0,   color: '#440154' },
    { stop: 0.33,  color: '#3b528b' },
    { stop: 0.67,  color: '#21918c' },
    { stop: 1.0,   color: '#5ec962' },
];

const getViridisColor = (distance: number, maxDistance: number) => {
    const t = Math.max(0, Math.min(1, distance / maxDistance));
    for (let i = 0; i < VIRIDIS_STOPS.length - 1; i++) {
        const a = VIRIDIS_STOPS[i];
        const b = VIRIDIS_STOPS[i + 1];
        if (t >= a.stop && t <= b.stop) {
            const factor = (t - a.stop) / (b.stop - a.stop);
            return interpolateColor(a.color, b.color, factor);
        }
    }
    return VIRIDIS_STOPS[VIRIDIS_STOPS.length - 1].color;
};

// ---- DOM-based popup builders ----

function buildBasicDOM(name: string, val: number, unit: string, color: string, textColor: string) {
    const container = document.createElement('div');
    container.style.cssText = "font-family:'Archivo Narrow',sans-serif;padding:2px;";

    const header = document.createElement('div');
    header.style.cssText = 'font-weight:700;font-size:13px;margin-bottom:6px;color:#1a202c;border-bottom:1px solid rgba(0,0,0,0.05);padding-bottom:4px;';
    header.textContent = name;
    container.appendChild(header);

    const badge = document.createElement('div');
    badge.style.cssText = `background:${color};color:${textColor};padding:4px 10px;border-radius:6px;font-size:13px;font-weight:800;display:inline-block;box-shadow:0 2px 4px rgba(0,0,0,0.1);`;
    const valSpan = document.createTextNode(`${Math.round(val)} `);
    badge.appendChild(valSpan);
    const unitSpan = document.createElement('span');
    unitSpan.style.cssText = 'font-size:10px;font-weight:500;opacity:0.9;color:white;text-shadow:0 1px 2px rgba(0,0,0,0.4);';
    unitSpan.textContent = unit;
    badge.appendChild(unitSpan);
    container.appendChild(badge);

    return container;
}

function buildLoadingDOM() {
    const row = document.createElement('div');
    row.id = 'popup-loader';
    row.style.cssText = 'margin-top:14px;display:flex;align-items:center;gap:6px;font-size:11px;color:#718096;';
    const spinner = document.createElement('div');
    spinner.style.cssText = 'width:12px;height:12px;border:2px solid #CBD5E0;border-top-color:#718096;border-radius:50%;animation:popupSpin .6s linear infinite;';
    row.appendChild(spinner);
    const text = document.createElement('span');
    text.textContent = 'Cargando disponibilidad\u2026';
    row.appendChild(text);
    return row;
}

function buildLinePlotDOM(data: HourlyAvailability[]) {
    const SVG_NS = 'http://www.w3.org/2000/svg';
    const w = 230, h = 105, padL = 35, padB = 35, padT = 18, padR = 12;
    const chartW = w - padL - padR;
    const chartH = h - padT - padB;
    const maxBikes = Math.max(...data.map(d => d.avg_bikes), 5);

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('width', String(w));
    svg.setAttribute('height', String(h));
    svg.style.cssText = 'margin-top:14px;display:block;overflow:visible;cursor:default;';

    const getX = (hour: number) => padL + (hour / 23) * chartW;
    const getY = (bikes: number) => padT + chartH - (bikes / maxBikes) * chartH;
    const zeroY = getY(0);

    const sortedData = [...data].sort((a,b) => a.hour_of_day - b.hour_of_day);
    const hourWidth = chartW / 23;
    
    sortedData.forEach(d => {
        if (d.avg_bikes < 3) {
            const rect = document.createElementNS(SVG_NS, 'rect');
            rect.setAttribute('x', String(getX(d.hour_of_day) - hourWidth/2));
            rect.setAttribute('y', String(padT));
            rect.setAttribute('width', String(hourWidth));
            rect.setAttribute('height', String(chartH));
            rect.setAttribute('fill', 'rgba(239, 68, 68, 0.08)');
            svg.appendChild(rect);
        }
    });

    const axisColor = '#E2E8F0';
    const yAxisLine = document.createElementNS(SVG_NS, 'line');
    yAxisLine.setAttribute('x1', String(padL)); yAxisLine.setAttribute('y1', String(padT));
    yAxisLine.setAttribute('x2', String(padL)); yAxisLine.setAttribute('y2', String(zeroY));
    yAxisLine.setAttribute('stroke', axisColor);
    svg.appendChild(yAxisLine);

    const xAxisLine = document.createElementNS(SVG_NS, 'line');
    xAxisLine.setAttribute('x1', String(padL)); xAxisLine.setAttribute('y1', String(zeroY));
    xAxisLine.setAttribute('x2', String(padL + chartW)); xAxisLine.setAttribute('y2', String(zeroY));
    xAxisLine.setAttribute('stroke', axisColor);
    svg.appendChild(xAxisLine);

    const labelStyle = 'font-size:8px;fill:#A1A1AA;font-weight:700;font-family:sans-serif;pointer-events:none;';
    [0, Math.round(maxBikes)].forEach(val => {
        const txt = document.createElementNS(SVG_NS, 'text');
        txt.setAttribute('x', String(padL - 6));
        txt.setAttribute('y', String(getY(val) + (val === 0 ? 0 : 4)));
        txt.setAttribute('text-anchor', 'end');
        txt.style.cssText = labelStyle;
        txt.textContent = String(val);
        svg.appendChild(txt);
    });

    const tooltipText = document.createElementNS(SVG_NS, 'text');
    tooltipText.setAttribute('x', String(w - 10));
    tooltipText.setAttribute('y', String(padT - 6));
    tooltipText.setAttribute('text-anchor', 'end');
    tooltipText.style.cssText = 'font-size:9px;fill:#71717A;font-weight:800;visibility:hidden;';
    svg.appendChild(tooltipText);

    const addTimeIcon = (hour: number, timeStr: string, svgContent: string) => {
        const x = getX(hour);
        const g = document.createElementNS(SVG_NS, 'g');
        g.setAttribute('transform', `translate(${x - 6}, ${h - 28}) scale(0.5)`);
        g.innerHTML = svgContent;
        svg.appendChild(g);
        const txt = document.createElementNS(SVG_NS, 'text');
        txt.setAttribute('x', String(x)); txt.setAttribute('y', String(h - 4));
        txt.setAttribute('text-anchor', 'middle');
        txt.style.cssText = 'font-size:8px;fill:#A1A1AA;font-weight:700;';
        txt.textContent = timeStr;
        svg.appendChild(txt);
    };

    const wrapIcon = (c: string) => `<g fill="none" stroke="#A1A1AA" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${c}</g>`;
    addTimeIcon(0,  '00:00', wrapIcon('<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>'));
    addTimeIcon(8,  '08:00', wrapIcon('<path d="M12 2v8"/><path d="m4.93 10.93 1.41 1.41"/><path d="M2 18h2"/><path d="M20 18h2"/><path d="m19.07 10.93-1.41 1.41"/><path d="M22 22H2"/><path d="m8 22 4-4 4 4"/><path d="M16 18a4 4 0 0 0-8 0"/>'));
    addTimeIcon(12, '12:00', wrapIcon('<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>'));
    addTimeIcon(20, '20:00', wrapIcon('<path d="M12 10V2"/><path d="m4.93 10.93 1.41 1.41"/><path d="M2 18h2"/><path d="M20 18h2"/><path d="m19.07 10.93-1.41 1.41"/><path d="M22 22H2"/><path d="m16 22-4-4-4 4"/><path d="M16 18a4 4 0 0 0-8 0"/>'));

    const pts = sortedData.map(d => `${getX(d.hour_of_day).toFixed(1)},${getY(d.avg_bikes).toFixed(1)}`).join(' ');
    const polyline = document.createElementNS(SVG_NS, 'polyline');
    polyline.setAttribute('points', pts);
    polyline.setAttribute('fill', 'none');
    polyline.setAttribute('stroke', '#E2E8F0');
    polyline.setAttribute('stroke-width', '2.5');
    polyline.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(polyline);

    sortedData.forEach(d => {
        const circle = document.createElementNS(SVG_NS, 'circle');
        circle.setAttribute('cx', getX(d.hour_of_day).toFixed(1));
        circle.setAttribute('cy', getY(d.avg_bikes).toFixed(1));
        circle.setAttribute('r', '3.5');
        circle.setAttribute('fill', d.avg_bikes < 3 ? '#EF4444' : '#10B981');
        circle.setAttribute('stroke', '#FFFFFF');
        circle.setAttribute('stroke-width', '1');
        circle.style.cssText = 'transition: r 0.1s ease; cursor: crosshair;';
        circle.addEventListener('mouseenter', () => { 
            circle.setAttribute('r', '5'); 
            const hour = String(d.hour_of_day).padStart(2, '0');
            tooltipText.textContent = `${Math.round(d.avg_bikes)} bicis a las ${hour}:00`; 
            tooltipText.style.visibility = 'visible'; 
        });
        circle.addEventListener('mouseleave', () => { circle.setAttribute('r', '3.5'); tooltipText.style.visibility = 'hidden'; });
        svg.appendChild(circle);
    });

    return svg;
}

let spinnerInjected = false;
function ensureSpinnerCSS() {
    if (spinnerInjected) return;
    spinnerInjected = true;
    const style = document.createElement('style');
    style.textContent = '@keyframes popupSpin{to{transform:rotate(360deg)}}';
    document.head.appendChild(style);
}

interface StationsLayerProps {
    submode: string;
}

const SOURCE_ID = 'stations-source';
const LAYER_ID  = 'stations-layer';
const REACH_SOURCE_ID  = 'reach-source';
const REACH_LAYER_ID   = 'reach-layer';
const REACH_CIRCLE_SOURCE_ID = 'reach-circle-source';
const REACH_CIRCLE_LAYER_ID  = 'reach-circle-layer';
const REACH_POLY_SOURCE_ID   = 'reach-poly-source';
const REACH_POLY_LAYER_ID    = 'reach-poly-layer';
const MAX_REACH_DISTANCE = 1000;

export default function StationsLayer({ submode }: StationsLayerProps) {
    const { map, city } = useMap();
    const { thresholds, setThresholds } = useThresholds();
    const [stations, setStations] = useState<any[]>([]);
    const [activePeriod, setActivePeriod] = useState<string>('all');
    const [stickyId, setStickyId] = useState<string | null>(null);
    const isReach = submode === 'reach';
    const metric = submode === 'downtime' ? 'downtime' : 'trips';

    const stickyRef = useRef<{ id: string | null; coords: [number, number]; props: any } | null>(null);
    const popupRef = useRef<maplibregl.Popup | null>(null);
    const hourlyCache = useRef<Map<string, Record<string, HourlyAvailability[]>>>(new Map());
    const reachAbortRef = useRef<AbortController | null>(null);

    const cleanupReachLayers = useCallback(() => {
        if (!map) return;
        try {
            for (const [lid, sid] of [
                [REACH_LAYER_ID, REACH_SOURCE_ID],
                [REACH_CIRCLE_LAYER_ID, REACH_CIRCLE_SOURCE_ID],
                [REACH_POLY_LAYER_ID, REACH_POLY_SOURCE_ID],
            ]) {
                if (map.getLayer(lid)) map.removeLayer(lid);
                if (map.getSource(sid)) map.removeSource(sid);
            }
        } catch { /* map may have been removed */ }
    }, [map]);

    // --- Mount ---
    useEffect(() => {
        if (!map) return;
        if (map.getLayer(LAYER_ID))     map.setLayoutProperty(LAYER_ID, 'visibility', 'visible');
        if (map.getLayer('bike-paths-layer'))  map.setLayoutProperty('bike-paths-layer', 'visibility', 'none');
        if (map.getLayer('traffic-layer'))     map.setLayoutProperty('traffic-layer', 'visibility', 'none');
        return () => {
            try {
                if (map.getLayer(LAYER_ID)) map.setLayoutProperty(LAYER_ID, 'visibility', 'none');
                cleanupReachLayers();
            } catch { /* map may have been removed */ }
            setThresholds(null);
        };
    }, [map]);

    useEffect(() => { if (!isReach) cleanupReachLayers(); }, [isReach, cleanupReachLayers]);

    // --- Data fetch ---
    useEffect(() => {
        if (!map || !city?.id) return;
        let cancelled = false;

        fetchStations(city.id).then(data => {
            if (cancelled || !map) return;
            setStations(data);

            const features = data.map(s => {
                let normalizedName = (s.name || 'Sin nombre')
                    .replace(/^[^a-zA-Z\xC0-\xFF]+/, '')
                    .toLowerCase().split(/[\s_-]+/)
                    .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                return {
                    type: 'Feature' as const,
                    geometry: { type: 'Point' as const, coordinates: [s.lon, s.lat] },
                    properties: {
                        name: normalizedName,
                        id: s.station_id,
                        usage: s.estimated_monthly_trips || 0,
                        downtime: s.downtime_minutes || 0,
                        reach_coverage: s.reach_coverage || 0,
                    },
                };
            });

            const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource;
            if (source) source.setData({ type: 'FeatureCollection', features });
        }).catch(err => console.error('Failed to load stations:', err));

        return () => { cancelled = true; };
    }, [map, city?.id]);

    // --- Thresholds (trips/downtime) ---
    useEffect(() => {
        if (!stations.length || isReach) return;
        const values = stations.map((s: any) =>
            (metric === 'trips' ? s.estimated_monthly_trips : s.downtime_minutes) || 0
        ).sort((a: number, b: number) => a - b);
        if (values.length > 0) {
            setThresholds({
                q5:  values[Math.floor(values.length * 0.05)] || 5,
                q50: values[Math.floor(values.length * 0.5)]  || 20,
                q95: values[Math.floor(values.length * 0.95)] || 100,
                max: Math.max(...values),
                min: Math.min(...values),
            });
        }
    }, [stations, metric, isReach, setThresholds]);

    // --- Thresholds (reach): use computed coverage values ---
    useEffect(() => {
        if (!isReach || !stations.length) return;
        const values = stations
            .map((s: any) => s.reach_coverage || 0)
            .sort((a: number, b: number) => a - b);
        setThresholds({
            q5:  values[Math.floor(values.length * 0.05)] || 0,
            q50: values[Math.floor(values.length * 0.5)]  || 25,
            q95: values[Math.floor(values.length * 0.95)] || 80,
            max: Math.max(...values),
            min: Math.min(...values),
        });
    }, [isReach, stations, setThresholds]);

    // --- Color: trips/downtime ---
    useEffect(() => {
        if (!map || !map.getLayer(LAYER_ID) || !thresholds || isReach) return;
        const metricProp = metric === 'trips' ? 'usage' : 'downtime';
        map.setPaintProperty(LAYER_ID, 'circle-color', [
            'case',
            ['<', ['get', metricProp], thresholds.q5], metric === 'trips' ? '#A0AEC0' : '#FEE2E2',
            ['interpolate', ['linear'], ['get', metricProp],
                thresholds.q5,  metric === 'trips' ? '#D1FAE5' : '#FEE2E2',
                thresholds.q50, metric === 'trips' ? '#34D399' : '#EF4444',
                thresholds.q95, metric === 'trips' ? '#065F46' : '#7F1D1D',
            ]
        ]);
        map.setPaintProperty(LAYER_ID, 'circle-radius', 6);
    }, [map, metric, thresholds, isReach]);

    // --- Color: reach — teal gradient by coverage ---
    useEffect(() => {
        if (!map || !map.getLayer(LAYER_ID) || !isReach || !thresholds) return;
        map.setPaintProperty(LAYER_ID, 'circle-color', [
            'interpolate', ['linear'], ['get', 'reach_coverage'],
            0,   '#e0f2f1',
            25,  '#80cbc4',
            50,  '#26a69a',
            75,  '#00897b',
            100, '#004d40',
        ]);
        map.setPaintProperty(LAYER_ID, 'circle-radius', 6);
    }, [map, isReach, thresholds]);

    // --- Polygon visibility toggle (driven by legend checkbox) ---
    useEffect(() => {
        if (!map) return;
        const handler = (e: Event) => {
            const visible = (e as CustomEvent).detail?.visible;
            if (map.getLayer(REACH_POLY_LAYER_ID)) {
                map.setLayoutProperty(REACH_POLY_LAYER_ID, 'visibility', visible ? 'visible' : 'none');
            }
        };
        window.addEventListener('reach-polygon-toggle', handler);
        return () => window.removeEventListener('reach-polygon-toggle', handler);
    }, [map]);

    // --- Reach: load & render ---
    const loadReach = useCallback((stationId: string, infoContainer?: HTMLElement) => {
        if (!map || !city || !city.id) return;
        if (reachAbortRef.current) reachAbortRef.current.abort();
        const controller = new AbortController();
        reachAbortRef.current = controller;
        cleanupReachLayers();

        fetchStationReach(city.id, stationId, MAX_REACH_DISTANCE)
            .then(reachData => {
                if (controller.signal.aborted || !map) return;

                // 1. Reach polygon (light fill)
                if (reachData.polygon) {
                    const polyGJ: GeoJSON.FeatureCollection = {
                        type: 'FeatureCollection',
                        features: [reachData.polygon],
                    };
                    map.addSource(REACH_POLY_SOURCE_ID, { type: 'geojson', data: polyGJ });
                    map.addLayer({
                        id: REACH_POLY_LAYER_ID,
                        type: 'fill',
                        source: REACH_POLY_SOURCE_ID,
                        paint: {
                            'fill-color': '#0d9488',
                            'fill-opacity': 0.12,
                        },
                    }, LAYER_ID);
                }

                // 2. Geodesic circle (dashed outline)
                if (reachData.circle) {
                    const circleGJ: GeoJSON.FeatureCollection = {
                        type: 'FeatureCollection',
                        features: [reachData.circle],
                    };
                    map.addSource(REACH_CIRCLE_SOURCE_ID, { type: 'geojson', data: circleGJ });
                    map.addLayer({
                        id: REACH_CIRCLE_LAYER_ID,
                        type: 'line',
                        source: REACH_CIRCLE_SOURCE_ID,
                        paint: {
                            'line-color': '#64748B',
                            'line-width': 1.5,
                            'line-dasharray': [4, 4],
                            'line-opacity': 0.5,
                        },
                    }, LAYER_ID);
                }

                // 3. Reach edges (viridis)
                const coloredFeatures = reachData.edges.features.map(f => {
                    const props = f.properties || {};
                    const avgDist = ((props.dist_start || 0) + (props.dist_end || 0)) / 2;
                    return { ...f, properties: { ...props, color: getViridisColor(avgDist, MAX_REACH_DISTANCE) } };
                });
                const coloredGJ: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: coloredFeatures };
                map.addSource(REACH_SOURCE_ID, { type: 'geojson', data: coloredGJ });
                map.addLayer({
                    id: REACH_LAYER_ID,
                    type: 'line',
                    source: REACH_SOURCE_ID,
                    paint: { 'line-color': ['get', 'color'], 'line-width': 3, 'line-opacity': 0.85 },
                }, LAYER_ID);

                // 4. Update SelectionPanel with real coverage
                if (stickyRef.current) {
                    window.dispatchEvent(new CustomEvent('map-selection', { detail: {
                        type: 'reach',
                        title: stickyRef.current.props?.name ?? 'Estación',
                        subtitle: 'Alcance desde la estación',
                        badge: { text: `${reachData.coverage.toFixed(1)}%`, color: '#26a69a' },
                        rows: [{ label: 'Cobertura', value: `${reachData.coverage.toFixed(1)}%` }],
                        loading: false,
                    } as SelectionDetail }));
                }
            })
            .catch(err => {
                if (!controller.signal.aborted) {
                    console.error('Failed to load reach:', err);
                    if (stickyRef.current) {
                        window.dispatchEvent(new CustomEvent('map-selection', { detail: {
                            type: 'reach',
                            title: stickyRef.current.props?.name ?? 'Estación',
                            subtitle: 'Error al calcular alcance',
                            loading: false,
                        } as SelectionDetail }));
                    }
                }
            });
    }, [map, city, cleanupReachLayers]);


    const dispatchSelection = useCallback((detail: SelectionDetail | null) => {
        window.dispatchEvent(new CustomEvent('map-selection', { detail }));
    }, []);

    // --- Popups & Selection ---
    useEffect(() => {
        if (!map) return;
        ensureSpinnerCSS();

        const getColors = (val: number) => {
            const q5  = thresholds?.q5 ?? 5, q50 = thresholds?.q50 ?? 50, q95 = thresholds?.q95 ?? 200;
            const color = getMetricColor(val, q5, q50, q95, metric);
            const textColor = ['#042F2E','#450A0A','#065F46','#7F1D1D'].includes(color) ? 'white' : 'black';
            return { color, textColor };
        };

        const onMouseEnter = (e: maplibregl.MapLayerMouseEvent) => {
            if (stickyRef.current) return;
            map.getCanvas().style.cursor = 'pointer';
        };

        const onMouseLeave = () => {
            if (stickyRef.current) return;
            map.getCanvas().style.cursor = '';
        };

        const onClick = (e: maplibregl.MapLayerMouseEvent) => {
            const f = e.features?.[0]; if (!f) return;
            const coords = (f.geometry as any).coordinates.slice() as [number, number];
            const props = f.properties!;
            stickyRef.current = { id: props.id, coords, props };
            setStickyId(props.id);

            if (isReach) {
                const covVal = props.reach_coverage ?? 0;
                dispatchSelection({
                    type: 'reach',
                    title: props.name,
                    subtitle: 'Alcance desde la estación',
                    badge: { text: `${Math.round(covVal)}%`, color: '#26a69a' },
                    loading: true,
                });
                // loadReach will update the panel when coverage is computed
                loadReach(props.id);
            } else {
                const val = metric === 'trips' ? (props.usage || 0) : (props.downtime || 0);
                const unit = metric === 'trips' ? 'v/mes' : 'min/día';
                const q5 = thresholds?.q5 ?? 5, q50 = thresholds?.q50 ?? 50, q95 = thresholds?.q95 ?? 200;
                const color = getMetricColor(val, q5, q50, q95, metric);
                const textColor = ['#042F2E','#450A0A','#065F46','#7F1D1D'].includes(color) ? 'white' : 'black';

                const selectionDetail: SelectionDetail = {
                    type: 'station',
                    title: props.name,
                    badge: { text: `${Math.round(val)} ${unit}`, color, textColor },
                    rows: metric === 'downtime' ? [
                        { label: 'Tiempo sin bicis', value: `${Math.round(val)} min/día` },
                    ] : [
                        { label: 'Viajes mensuales', value: `${Math.round(val)} v/mes` },
                    ],
                    periodOptions: metric === 'downtime' ? periodOptions : undefined,
                    activePeriod: activePeriod,
                    onPeriodChange: (period: string) => setActivePeriod(period),
                };

                // Fetch hourly data for downtime chart
                if (metric === 'downtime' && city.id !== undefined) {
                    const stationCache = hourlyCache.current.get(props.id) || {};
                    const cached = stationCache[activePeriod];

                    if (cached) {
                        const chart = buildLinePlotDOM(cached);
                        dispatchSelection({ ...selectionDetail, chart });
                    } else {
                        dispatchSelection({ ...selectionDetail, loading: true });
                        fetchStationHourlyAvailability(city.id, props.id, activePeriod)
                            .then(data => {
                                hourlyCache.current.set(props.id, { ...stationCache, [activePeriod]: data });
                                const chart = data.length > 0 ? buildLinePlotDOM(data) : null;
                                dispatchSelection({ ...selectionDetail, chart, loading: false });
                            })
                            .catch(err => {
                                console.error('Failed to fetch hourly data:', err);
                                dispatchSelection({ ...selectionDetail, loading: false });
                            });
                    }
                } else {
                    dispatchSelection(selectionDetail);
                }
            }
        };

        const onMapClick = (e: maplibregl.MapMouseEvent) => {
            if (!stickyRef.current) return;
            const features = map.queryRenderedFeatures(e.point, { layers: [LAYER_ID] });
            if (!features?.length) {
                stickyRef.current = null; setStickyId(null);
                dispatchSelection(null);
                if (isReach) cleanupReachLayers();
            }
        };

        // Close from SelectionPanel X button
        const onPanelClose = () => {
            stickyRef.current = null; setStickyId(null);
            if (isReach) cleanupReachLayers();
        };

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
            dispatchSelection(null);
        };
    }, [map, metric, thresholds, city, isReach, loadReach, cleanupReachLayers, dispatchSelection]);
    // Update SelectionPanel when metric/thresholds change while a station is selected
    const periodOptions = [
        { id: 'all', label: 'Todo' },
        { id: 'weekdays', label: 'Entre semana' },
        { id: 'weekends', label: 'Fin de semana' },
    ];

    const updateSelectionPanel = useCallback(() => {
        if (!stickyRef.current || isReach) return;
        const { props } = stickyRef.current;
        const val = metric === 'trips' ? (props.usage || 0) : (props.downtime || 0);
        const unit = metric === 'trips' ? 'v/mes' : 'min/día';
        const q5 = thresholds?.q5 ?? 5, q50 = thresholds?.q50 ?? 50, q95 = thresholds?.q95 ?? 200;
        const color = getMetricColor(val, q5, q50, q95, metric);
        const textColor = ['#042F2E','#450A0A','#065F46','#7F1D1D'].includes(color) ? 'white' : 'black';

        const selectionDetail: SelectionDetail = {
            type: 'station',
            title: props.name,
            badge: { text: `${Math.round(val)} ${unit}`, color, textColor },
            rows: metric === 'downtime'
                ? [{ label: 'Tiempo sin bicis', value: `${Math.round(val)} min/día` }]
                : [{ label: 'Viajes mensuales', value: `${Math.round(val)} v/mes` }],
            periodOptions: metric === 'downtime' ? periodOptions : undefined,
            activePeriod: activePeriod,
            onPeriodChange: (period: string) => setActivePeriod(period),
        };

        // Fetch hourly data for downtime chart when switching to downtime metric
        if (metric === 'downtime' && city.id !== undefined) {
            const stationCache = hourlyCache.current.get(props.id) || {};
            const cached = stationCache[activePeriod];

            if (cached) {
                // Use cached data
                const chart = buildLinePlotDOM(cached);
                dispatchSelection({ ...selectionDetail, chart });
            } else {
                // Show loading state
                dispatchSelection({ ...selectionDetail, loading: true });

                // Fetch new data
                fetchStationHourlyAvailability(city.id, props.id, activePeriod)
                    .then(data => {
                        // Update cache
                        hourlyCache.current.set(props.id, { ...stationCache, [activePeriod]: data });

                        // Only update if this is still the selected station
                        if (stickyRef.current?.id === props.id) {
                            const chart = data.length > 0 ? buildLinePlotDOM(data) : null;
                            dispatchSelection({
                                ...selectionDetail,
                                chart,
                                loading: false
                            });
                        }
                    })
                    .catch(err => {
                        console.error('Failed to fetch hourly data:', err);
                        if (stickyRef.current?.id === props.id) {
                            dispatchSelection({ ...selectionDetail, loading: false });
                        }
                    });
            }
        } else {
            dispatchSelection(selectionDetail);
        }
    }, [metric, thresholds, isReach, city, activePeriod, dispatchSelection]);

    useEffect(() => { updateSelectionPanel(); }, [stickyId, metric, thresholds, activePeriod, updateSelectionPanel]);

    return null;
}
