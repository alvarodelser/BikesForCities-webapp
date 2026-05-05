import { useEffect } from 'react';
import { useMap } from '../../MapContext';

const BOUNDARY_SOURCE = 'study-area-source';
const BOUNDARY_LAYER  = 'study-area-layer';

export default function InfrastructureLayer({ submode: _submode }: { submode: string }) {
    const { map, city, setLayerState } = useMap();

    useEffect(() => {
        if (!map || !city) return;

        // Show cycling paths layer
        if (map.getLayer('bike-paths-layer')) {
            map.setLayoutProperty('bike-paths-layer', 'visibility', 'visible');
        }

        // Hide station and traffic layers
        ['stations-layer', 'traffic-layer'].forEach(id => {
            if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none');
        });

        // Draw 10×10 km axis-aligned study-area rectangle and fit view to it
        const lat = city.geoCoords.latitude;
        const lon = city.geoCoords.longitude;
        const halfLat = 5000 / 111320;
        const halfLon = 5000 / (111320 * Math.cos((lat * Math.PI) / 180));

        const sw: [number, number] = [lon - halfLon, lat - halfLat];
        const ne: [number, number] = [lon + halfLon, lat + halfLat];

        const geojson = {
            type: 'Feature' as const,
            geometry: {
                type: 'Polygon' as const,
                coordinates: [[
                    sw,
                    [ne[0], sw[1]],
                    ne,
                    [sw[0], ne[1]],
                    sw,
                ]],
            },
            properties: {},
        };

        if (!map.getSource(BOUNDARY_SOURCE)) {
            map.addSource(BOUNDARY_SOURCE, { type: 'geojson', data: geojson as any });
        }
        if (!map.getLayer(BOUNDARY_LAYER)) {
            const before = map.getLayer('carto-labels-layer') ? 'carto-labels-layer' : undefined;
            map.addLayer({
                id: BOUNDARY_LAYER,
                type: 'line',
                source: BOUNDARY_SOURCE,
                paint: {
                    'line-color': '#027A76',
                    'line-width': 2,
                    'line-dasharray': [6, 3],
                    'line-opacity': 0.7,
                },
            } as any, before);
        }

        map.fitBounds([sw, ne], { padding: 48, duration: 800 });

        setLayerState?.('idle');

        return () => {
            try {
                if (map.getLayer(BOUNDARY_LAYER))  map.removeLayer(BOUNDARY_LAYER);
                if (map.getSource(BOUNDARY_SOURCE)) map.removeSource(BOUNDARY_SOURCE);
                if (map.getLayer('bike-paths-layer')) {
                    map.setLayoutProperty('bike-paths-layer', 'visibility', 'none');
                }
            } catch { /* map may have been removed */ }
        };
    }, [map, city]);

    return null;
}
