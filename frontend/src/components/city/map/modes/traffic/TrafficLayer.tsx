import { useEffect } from 'react';
import { useMap } from '../../MapContext';
import { useThresholds } from '../../ThresholdsContext';
import { fetchTraffic } from '../../../../../services/api';

const LAYER_ID  = 'traffic-layer';
const SOURCE_ID = 'edges-source';

export default function TrafficLayer() {
    const { map, city } = useMap();
    const { setThresholds } = useThresholds();

    // Mount: show layer, hide others
    useEffect(() => {
        if (!map) return;
        if (map.getLayer(LAYER_ID))            map.setLayoutProperty(LAYER_ID, 'visibility', 'visible');
        if (map.getLayer('stations-layer'))    map.setLayoutProperty('stations-layer', 'visibility', 'none');
        if (map.getLayer('bike-paths-layer'))  map.setLayoutProperty('bike-paths-layer', 'visibility', 'none');

        return () => {
            if (map.getLayer(LAYER_ID)) map.setLayoutProperty(LAYER_ID, 'visibility', 'none');
            setThresholds(null);
        };
    }, [map]);

    // Data fetch: reload on city change
    useEffect(() => {
        if (!map || !city) return;
        let cancelled = false;

        fetchTraffic(city.id).then(trafficData => {
            if (cancelled || !map) return;

            trafficData.forEach(t => {
                map.setFeatureState(
                    { source: SOURCE_ID, sourceLayer: 'edges', id: t.edge_id },
                    { trip_count: t.trip_count }
                );
            });

            const counts = trafficData.map(t => t.trip_count).sort((a, b) => a - b);
            if (counts.length > 0) {
                setThresholds({
                    q5:  counts[Math.floor(counts.length * 0.05)],
                    q50: counts[Math.floor(counts.length * 0.5)],
                    q95: counts[Math.floor(counts.length * 0.95)],
                    max: Math.max(...counts),
                    min: Math.min(...counts),
                });
            }
        }).catch(err => console.error('Failed to load traffic:', err));

        return () => { cancelled = true; };
    }, [map, city?.id]);

    return null;
}
