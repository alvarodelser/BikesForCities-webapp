import { useEffect, useState, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import { useMap } from '../../MapContext';
import { useThresholds } from '../../ThresholdsContext';
import { fetchStations, fetchStationHourlyAvailability, fetchStationReach } from '../../../../../services/api';
import type { HourlyAvailability } from '../../../../../services/api';

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

// --- Reach colormap: distance → color (green → amber → red) ---
const REACH_COLORS = [
    { stop: 0,    color: '#10B981' }, // emerald-500
    { stop: 0.5,  color: '#F59E0B' }, // amber-500
    { stop: 1.0,  color: '#EF4444' }, // red-500
];

const getReachColor = (distance: number, maxDistance: number) => {
    const t = Math.max(0, Math.min(1, distance / maxDistance));
    for (let i = 0; i < REACH_COLORS.length - 1; i++) {
        const a = REACH_COLORS[i];
        const b = REACH_COLORS[i + 1];
        if (t >= a.stop && t <= b.stop) {
            const factor = (t - a.stop) / (b.stop - a.stop);
            return interpolateColor(a.color, b.color, factor);
        }
    }
    return REACH_COLORS[REACH_COLORS.length - 1].color;
};

// ---- DOM-based popup builders (avoids setHTML silent parse failures) ----

/** Create the basic info DOM for any popup */
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

/** Create a loading spinner row */
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

/** Build an SVG line chart using the DOM API (no string injection) */
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

    // --- 1. Highlight areas based on X-axis (Vertical bands where bikes < 3) ---
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

    // --- 2. Axes ---
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

    // Y Labels
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

    // --- 3. Hover Tooltip (Inside SVG) ---
    const tooltipText = document.createElementNS(SVG_NS, 'text');
    tooltipText.setAttribute('x', String(w - 10));
    tooltipText.setAttribute('y', String(padT - 6));
    tooltipText.setAttribute('text-anchor', 'end');
    tooltipText.style.cssText = 'font-size:9px;fill:#71717A;font-weight:800;visibility:hidden;';
    svg.appendChild(tooltipText);

    // --- 4. X-Axis Icons (Time Markers) ---
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

    const iconMoon = '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>';
    const iconSunrise = '<path d="M12 2v8"/><path d="m4.93 10.93 1.41 1.41"/><path d="M2 18h2"/><path d="M20 18h2"/><path d="m19.07 10.93-1.41 1.41"/><path d="M22 22H2"/><path d="m8 22 4-4 4 4"/><path d="M16 18a4 4 0 0 0-8 0"/>';
    const iconSun = '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>';
    const iconSunset = '<path d="M12 10V2"/><path d="m4.93 10.93 1.41 1.41"/><path d="M2 18h2"/><path d="M20 18h2"/><path d="m19.07 10.93-1.41 1.41"/><path d="M22 22H2"/><path d="m16 22-4-4-4 4"/><path d="M16 18a4 4 0 0 0-8 0"/>';

    const wrapIcon = (c: string) => `<g fill="none" stroke="#A1A1AA" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${c}</g>`;

    addTimeIcon(0,  '0:00', wrapIcon(iconMoon));
    addTimeIcon(8,  '8:00', wrapIcon(iconSunrise));
    addTimeIcon(12, '12:00', wrapIcon(iconSun));
    addTimeIcon(20, '20:00', wrapIcon(iconSunset));

    // --- 5. Plot Line & Points ---
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
            tooltipText.textContent = `${d.avg_bikes.toFixed(1)} bicis`;
            tooltipText.style.visibility = 'visible';
        });
        circle.addEventListener('mouseleave', () => {
            circle.setAttribute('r', '3.5');
            tooltipText.style.visibility = 'hidden';
        });

        svg.appendChild(circle);
    });

    return svg;
}

// Inject the spinner keyframes once
let spinnerInjected = false;
function ensureSpinnerCSS() {
    if (spinnerInjected) return;
    spinnerInjected = true;
    const style = document.createElement('style');
    style.textContent = '@keyframes popupSpin{to{transform:rotate(360deg)}}';
    document.head.appendChild(style);
}

interface StationsLayerProps {
    submode: string; // 'trips' | 'downtime' | 'reach'
}

const SOURCE_ID = 'stations-source';
const LAYER_ID  = 'stations-layer';
const REACH_SOURCE_ID = 'reach-source';
const REACH_LAYER_ID  = 'reach-layer';
const MAX_REACH_DISTANCE = 1000; // metres

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

    // --- Cleanup reach layer helper ---
    const cleanupReachLayer = useCallback(() => {
        if (!map) return;
        if (map.getLayer(REACH_LAYER_ID)) map.removeLayer(REACH_LAYER_ID);
        if (map.getSource(REACH_SOURCE_ID)) map.removeSource(REACH_SOURCE_ID);
    }, [map]);

    // --- Mount: show layer, hide others ---
    useEffect(() => {
        if (!map) return;
        if (map.getLayer(LAYER_ID))     map.setLayoutProperty(LAYER_ID, 'visibility', 'visible');
        if (map.getLayer('bike-paths-layer'))  map.setLayoutProperty('bike-paths-layer', 'visibility', 'none');
        if (map.getLayer('traffic-layer'))     map.setLayoutProperty('traffic-layer', 'visibility', 'none');

        return () => {
            if (map.getLayer(LAYER_ID)) map.setLayoutProperty(LAYER_ID, 'visibility', 'none');
            cleanupReachLayer();
            setThresholds(null);
        };
    }, [map]);

    // --- Cleanup reach layer when leaving reach submode ---
    useEffect(() => {
        if (!isReach) {
            cleanupReachLayer();
        }
    }, [isReach, cleanupReachLayer]);

    // --- Data fetch: reload on city change ---
    useEffect(() => {
        if (!map || !city) return;
        let cancelled = false;

        if (!city?.id) return;
        fetchStations(city.id).then(data => {
            if (cancelled || !map) return;
            setStations(data);

            const features = data.map(s => {
                let normalizedName = (s.name || 'Sin nombre')
                    .replace(/^[^a-zA-Z\xC0-\xFF]+/, '')
                    .toLowerCase()
                    .split(/[\s_-]+/)
                    .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
                    .join(' ');

                return {
                    type: 'Feature' as const,
                    geometry: { type: 'Point' as const, coordinates: [s.lon, s.lat] },
                    properties: {
                        name: normalizedName,
                        id: s.station_id,
                        usage: s.estimated_monthly_trips || 0,
                        downtime: s.downtime_minutes || 0,
                    },
                };
            });

            const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource;
            if (source) source.setData({ type: 'FeatureCollection', features });
        }).catch(err => console.error('Failed to load stations:', err));

        return () => { cancelled = true; };
    }, [map, city?.id]);

    // --- Thresholds update (only for trips/downtime) ---
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

    // --- For reach mode: set thresholds to distance bounds ---
    useEffect(() => {
        if (!isReach) return;
        setThresholds({
            q5: 0,
            q50: MAX_REACH_DISTANCE / 2,
            q95: MAX_REACH_DISTANCE,
            max: MAX_REACH_DISTANCE,
            min: 0,
        });
    }, [isReach, setThresholds]);

    // --- Color Update (trips/downtime only) ---
    useEffect(() => {
        if (!map || !map.getLayer(LAYER_ID) || !thresholds || isReach) return;
        const metricProp = metric === 'trips' ? 'usage' : 'downtime';
        map.setPaintProperty(LAYER_ID, 'circle-color', [
            'case',
            ['<', ['get', metricProp], thresholds.q5], metric === 'trips' ? '#A0AEC0' : '#FEE2E2',
            [
                'interpolate', ['linear'], ['get', metricProp],
                thresholds.q5,  metric === 'trips' ? '#D1FAE5' : '#FEE2E2',
                thresholds.q50, metric === 'trips' ? '#34D399' : '#EF4444',
                thresholds.q95, metric === 'trips' ? '#065F46' : '#7F1D1D',
            ]
        ]);
        map.setPaintProperty(LAYER_ID, 'circle-radius', 6);
    }, [map, metric, thresholds, isReach]);

    // --- Reach mode: neutral station styling ---
    useEffect(() => {
        if (!map || !map.getLayer(LAYER_ID) || !isReach) return;
        map.setPaintProperty(LAYER_ID, 'circle-color', '#64748B');
        map.setPaintProperty(LAYER_ID, 'circle-radius', 5);
    }, [map, isReach]);

    // --- Reach: load & render reachability on station click ---
    const loadReach = useCallback((stationId: string) => {
        if (!map || !city) return;

        // Abort any previous request
        if (reachAbortRef.current) reachAbortRef.current.abort();
        const controller = new AbortController();
        reachAbortRef.current = controller;

        // Clean previous reach layer
        cleanupReachLayer();

        fetchStationReach(city.id, stationId, MAX_REACH_DISTANCE)
            .then(geojson => {
                if (controller.signal.aborted || !map) return;

                // Add color property to each feature
                const coloredFeatures = geojson.features.map(f => {
                    const props = f.properties || {};
                    const avgDist = ((props.dist_start || 0) + (props.dist_end || 0)) / 2;
                    return {
                        ...f,
                        properties: {
                            ...props,
                            color: getReachColor(avgDist, MAX_REACH_DISTANCE),
                        },
                    };
                });

                const coloredGeojson: GeoJSON.FeatureCollection = {
                    type: 'FeatureCollection',
                    features: coloredFeatures,
                };

                // Add the source & layer
                if (map.getSource(REACH_SOURCE_ID)) {
                    (map.getSource(REACH_SOURCE_ID) as maplibregl.GeoJSONSource).setData(coloredGeojson);
                } else {
                    map.addSource(REACH_SOURCE_ID, {
                        type: 'geojson',
                        data: coloredGeojson,
                    });
                }

                if (!map.getLayer(REACH_LAYER_ID)) {
                    // Insert below stations layer so points stay on top
                    map.addLayer({
                        id: REACH_LAYER_ID,
                        type: 'line',
                        source: REACH_SOURCE_ID,
                        paint: {
                            'line-color': ['get', 'color'],
                            'line-width': 3,
                            'line-opacity': 0.85,
                        },
                    }, LAYER_ID);
                }
            })
            .catch(err => {
                if (!controller.signal.aborted) {
                    console.error('Failed to load reach:', err);
                }
            });
    }, [map, city, cleanupReachLayer]);

    // --- Station popups (hover + click-to-stick) ---
    useEffect(() => {
        if (!map) return;
        ensureSpinnerCSS();

        const popup = new maplibregl.Popup({
            closeButton: false, closeOnClick: false,
            className: 'station-popup', maxWidth: '250px',
        });
        popupRef.current = popup;

        const getColors = (val: number) => {
            const q5  = thresholds?.q5  ?? 5;
            const q50 = thresholds?.q50 ?? 50;
            const q95 = thresholds?.q95 ?? 200;
            const color     = getMetricColor(val, q5, q50, q95, metric);
            const textColor = ['#042F2E','#450A0A','#065F46','#7F1D1D'].includes(color) ? 'white' : 'black';
            return { color, textColor };
        };

        const onMouseEnter = (e: maplibregl.MapLayerMouseEvent) => {
            if (stickyRef.current) return;
            map.getCanvas().style.cursor = 'pointer';
            const features = e.features;
            if (!features || features.length === 0) return;
            const coords = (features[0].geometry as any).coordinates.slice() as [number, number];
            const props = features[0].properties!;

            if (isReach) {
                // Simple name-only popup in reach mode
                const container = document.createElement('div');
                container.style.cssText = "font-family:'Archivo Narrow',sans-serif;padding:2px;";
                const header = document.createElement('div');
                header.style.cssText = 'font-weight:700;font-size:13px;color:#1a202c;';
                header.textContent = props.name;
                container.appendChild(header);
                const hint = document.createElement('div');
                hint.style.cssText = 'font-size:10px;color:#71717A;margin-top:2px;';
                hint.textContent = 'Click para ver alcance';
                container.appendChild(hint);
                popup.setLngLat(coords).setDOMContent(container).addTo(map);
            } else {
                const val  = metric === 'trips' ? (props.usage || 0) : (props.downtime || 0);
                const unit = metric === 'trips' ? 'Viajes / Mes' : 'min / d\u00eda sin bicis';
                const { color, textColor } = getColors(val);
                popup.setLngLat(coords).setDOMContent(buildBasicDOM(props.name, val, unit, color, textColor)).addTo(map);
            }
        };

        const onMouseLeave = () => {
            if (stickyRef.current) return;
            map.getCanvas().style.cursor = '';
            popup.remove();
        };

        const onClick = (e: maplibregl.MapLayerMouseEvent) => {
            const features = e.features;
            if (!features || features.length === 0) return;
            const coords = (features[0].geometry as any).coordinates.slice() as [number, number];
            const props = features[0].properties!;
            
            stickyRef.current = { id: props.id, coords, props };
            setStickyId(props.id);

            if (isReach) {
                // Load reachability tree
                loadReach(props.id);
                // Show a compact popup
                const container = document.createElement('div');
                container.style.cssText = "font-family:'Archivo Narrow',sans-serif;padding:2px;";
                const header = document.createElement('div');
                header.style.cssText = 'font-weight:700;font-size:13px;color:#1a202c;display:flex;justify-content:space-between;align-items:center;';
                const nameSpan = document.createElement('span');
                nameSpan.textContent = props.name;
                header.appendChild(nameSpan);
                const closeBtn = document.createElement('span');
                closeBtn.textContent = '\u2715';
                closeBtn.style.cssText = 'cursor:pointer;color:#A0AEC0;margin-left:8px;font-size:12px;';
                closeBtn.onclick = (ev) => {
                    ev.stopPropagation();
                    stickyRef.current = null;
                    setStickyId(null);
                    popupRef.current?.remove();
                    cleanupReachLayer();
                };
                header.appendChild(closeBtn);
                container.appendChild(header);
                const info = document.createElement('div');
                info.style.cssText = 'font-size:10px;color:#71717A;margin-top:4px;';
                info.textContent = `Alcance: ${MAX_REACH_DISTANCE}m`;
                container.appendChild(info);
                popup.setLngLat(coords).setDOMContent(container).addTo(map);
            } else {
                updatePopupContent();
                popup.setLngLat(coords).addTo(map);
            }
        };

        const onMapClick = (e: maplibregl.MapMouseEvent) => {
            if (!stickyRef.current) return;
            const features = map.queryRenderedFeatures(e.point, { layers: [LAYER_ID] });
            if (!features || features.length === 0) {
                stickyRef.current = null;
                setStickyId(null);
                popup.remove();
                if (isReach) cleanupReachLayer();
            }
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
    }, [map, metric, thresholds, city, isReach, loadReach, cleanupReachLayer]);

    // Reactive popup content update
    const updatePopupContent = () => {
        if (!stickyRef.current || !popupRef.current || !map || isReach) return;
        const { props, coords } = stickyRef.current;
        const val = metric === 'trips' ? (props.usage || 0) : (props.downtime || 0);
        const unit = metric === 'trips' ? 'Viajes / Mes' : 'min / d\u00eda sin bicis';
        
        const q5  = thresholds?.q5  ?? 5;
        const q50 = thresholds?.q50 ?? 50;
        const q95 = thresholds?.q95 ?? 200;
        const color = getMetricColor(val, q5, q50, q95, metric);
        const textColor = ['#042F2E','#450A0A','#065F46','#7F1D1D'].includes(color) ? 'white' : 'black';

        const container = buildBasicDOM(props.name, val, unit, color, textColor);
        const header = container.firstElementChild as HTMLElement;
        if (header) {
            header.style.display = 'flex';
            header.style.justifyContent = 'space-between';
            const closeBtn = document.createElement('span');
            closeBtn.textContent = '\u2715';
            closeBtn.style.cssText = 'cursor:pointer;color:#A0AEC0;margin-left:8px;';
            closeBtn.onclick = (ev) => {
                ev.stopPropagation();
                stickyRef.current = null;
                setStickyId(null);
                popupRef.current?.remove();
            };
            header.appendChild(closeBtn);
        }

        // --- Period Toggle ---
        if (metric === 'downtime') {
            const toggleRow = document.createElement('div');
            toggleRow.style.cssText = 'margin-top:10px;display:flex;gap:4px;background:#F4F4F5;padding:2px;border-radius:6px;';
            
            const periods = [
                { id: 'all', label: 'Toda' },
                { id: 'week', label: 'L-V' },
                { id: 'weekend', label: 'Finde' }
            ];

            periods.forEach(p => {
                const btn = document.createElement('button');
                btn.textContent = p.label;
                const isActive = activePeriod === p.id;
                btn.style.cssText = `flex:1;border:none;border-radius:4px;font-size:9px;padding:3px 0;font-weight:700;cursor:pointer;transition:all 0.1s;background:${isActive ? '#FFFFFF' : 'transparent'};color:${isActive ? '#18181B' : '#71717A'};box-shadow:${isActive ? '0 1px 2px rgba(0,0,0,0.1)' : 'none'};`;
                btn.onclick = (ev) => {
                    ev.stopPropagation();
                    setActivePeriod(p.id);
                };
                toggleRow.appendChild(btn);
            });
            container.appendChild(toggleRow);

            // --- Chart Area ---
            if (city?.id) {
                const stationCache = hourlyCache.current.get(props.id) || {};
                const cached = stationCache[activePeriod];

                if (cached) {
                    container.appendChild(buildLinePlotDOM(cached));
                } else {
                    const loader = buildLoadingDOM();
                    container.appendChild(loader);
                    const currentStationId = props.id;
                    const currentPeriod = activePeriod;
                    
                    fetchStationHourlyAvailability(city.id, props.id, activePeriod)
                        .then(data => {
                            const newCache = { ...stationCache, [currentPeriod]: data };
                            hourlyCache.current.set(currentStationId, newCache);
                            
                            if (stickyRef.current?.id === currentStationId && activePeriod === currentPeriod) {
                                if (data.length > 0) {
                                    loader.replaceWith(buildLinePlotDOM(data));
                                } else {
                                    const msg = document.createElement('div');
                                    msg.style.cssText = 'margin-top:14px;font-size:11px;color:#A1A1AA;text-align:center;';
                                    msg.textContent = 'Sin datos.';
                                    loader.replaceWith(msg);
                                }
                            }
                        })
                        .catch(() => {
                            if (stickyRef.current?.id === currentStationId && activePeriod === currentPeriod) {
                                const msg = document.createElement('div');
                                msg.style.cssText = 'margin-top:14px;font-size:11px;color:#EF4444;text-align:center;';
                                msg.textContent = 'Error al cargar.';
                                loader.replaceWith(msg);
                            }
                        });
                }
            }
        }

        popupRef.current?.setDOMContent(container);
    };

    // Keep popup synced with state
    useEffect(() => {
        updatePopupContent();
    }, [activePeriod, stickyId, metric, thresholds]);

    return null;
}
