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

        // Draw study-area boundary rectangle and fit the view to show it
        if (city.maxBounds) {
            const [[swLon, swLat], [neLon, neLat]] = city.maxBounds;
            const geojson = {
                type: 'Feature' as const,
                geometry: {
                    type: 'Polygon' as const,
                    coordinates: [[
                        [swLon, swLat],
                        [neLon, swLat],
                        [neLon, neLat],
                        [swLon, neLat],
                        [swLon, swLat],
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

            // Zoom to show the full study area so the boundary is immediately visible
            map.fitBounds(city.maxBounds, { padding: 48, duration: 800 });
        }

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
