import { useEffect, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { useMap } from '../../MapContext';
import { useThresholds } from '../../ThresholdsContext';
import { fetchStations } from '../../../../../services/api';

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
    if (val < q5) return '#A0AEC0';
    if (val > q95) return metric === 'trips' ? '#042F2E' : '#450A0A';
    const colors = metric === 'trips'
        ? ['#D1FAE5', '#34D399', '#065F46']
        : ['#FEE2E2', '#EF4444', '#7F1D1D'];
    if (val < q50) {
        return interpolateColor(colors[0], colors[1], Math.max(0, Math.min(1, (val - q5) / (q50 - q5 || 1))));
    }
    return interpolateColor(colors[1], colors[2], Math.max(0, Math.min(1, (val - q50) / (q95 - q50 || 1))));
};

interface StationsLayerProps {
    submode: string; // 'trips' | 'downtime'
}

const SOURCE_ID = 'stations-source';
const LAYER_ID  = 'stations-layer';

export default function StationsLayer({ submode }: StationsLayerProps) {
    const { map, city } = useMap();
    const { thresholds, setThresholds } = useThresholds();
    const [stations, setStations] = useState<any[]>([]);
    const metric = submode === 'downtime' ? 'downtime' : 'trips';

    // --- Mount: show layer, hide others ---
    useEffect(() => {
        if (!map) return;
        if (map.getLayer(LAYER_ID))     map.setLayoutProperty(LAYER_ID, 'visibility', 'visible');
        if (map.getLayer('bike-paths-layer'))  map.setLayoutProperty('bike-paths-layer', 'visibility', 'none');
        if (map.getLayer('traffic-layer'))     map.setLayoutProperty('traffic-layer', 'visibility', 'none');

        return () => {
            if (map.getLayer(LAYER_ID)) map.setLayoutProperty(LAYER_ID, 'visibility', 'none');
            setThresholds(null);
        };
    }, [map]);

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

    // --- Thresholds update: recalculate whenever metric or data changes ---
    useEffect(() => {
        if (!stations.length) return;
        
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
    }, [stations, metric, setThresholds]);

    // --- Submode change or Thresholds update: update paint only (no remount) ---
    useEffect(() => {
        if (!map || !map.getLayer(LAYER_ID) || !thresholds) return;
        const metricProp = metric === 'trips' ? 'usage' : 'downtime';

        // Update color expression based on current metric and computed thresholds
        map.setPaintProperty(LAYER_ID, 'circle-color', [
            'case',
            ['<', ['get', metricProp], thresholds.q5], '#A0AEC0',
            [
                'interpolate', ['linear'], ['get', metricProp],
                thresholds.q5,  metric === 'trips' ? '#D1FAE5' : '#FEE2E2',
                thresholds.q50, metric === 'trips' ? '#34D399' : '#EF4444',
                thresholds.q95, metric === 'trips' ? '#065F46' : '#7F1D1D',
            ]
        ]);
    }, [map, metric, thresholds]);

    // --- Station popups ---
    useEffect(() => {
        if (!map) return;
        const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, className: 'station-popup' });

        const onMouseEnter = (e: maplibregl.MapLayerMouseEvent) => {
            map.getCanvas().style.cursor = 'pointer';
            const features = e.features;
            if (!features || features.length === 0) return;

            const coords = (features[0].geometry as any).coordinates.slice() as [number, number];
            const props = features[0].properties!;
            const val   = metric === 'trips' ? (props.usage || 0) : (props.downtime || 0);
            const unit  = metric === 'trips' ? 'Viajes por Mes' : 'minutos sin bicis / día';

            // Use accurate quantiles for popup colour from the thresholds context
            const q5  = thresholds?.q5  || 5;
            const q50 = thresholds?.q50 || 50;
            const q95 = thresholds?.q95 || 200;
            const color     = getMetricColor(val, q5, q50, q95, metric);
            const textColor = ['#042F2E','#450A0A','#065F46','#7F1D1D'].includes(color) ? 'white' : 'black';

            popup.setLngLat(coords).setHTML(`
                <div style="font-family:'Archivo Narrow',sans-serif;padding:2px;">
                    <div style="font-weight:700;font-size:13px;margin-bottom:6px;color:#1a202c;border-bottom:1px solid rgba(0,0,0,0.05);padding-bottom:4px;">
                        ${props.name}
                    </div>
                    <div style="background:${color};color:${textColor};padding:4px 10px;border-radius:6px;font-size:13px;font-weight:800;display:inline-block;box-shadow:0 2px 4px rgba(0,0,0,0.1);">
                        ${Math.round(val)} <span style="font-size:10px;font-weight:500;opacity:0.9;">${unit}</span>
                    </div>
                </div>
            `).addTo(map);
        };

        const onMouseLeave = () => {
            map.getCanvas().style.cursor = '';
            popup.remove();
        };

        map.on('mouseenter', LAYER_ID, onMouseEnter);
        map.on('mouseleave', LAYER_ID, onMouseLeave);

        return () => {
            map.off('mouseenter', LAYER_ID, onMouseEnter);
            map.off('mouseleave', LAYER_ID, onMouseLeave);
            popup.remove();
        };
    }, [map, metric, thresholds]);

    return null;
}
