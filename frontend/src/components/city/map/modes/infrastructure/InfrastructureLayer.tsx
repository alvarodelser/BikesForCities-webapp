import { useEffect } from 'react';
import { useMap } from '../../MapContext';

export default function InfrastructureLayer({ submode: _submode }: { submode: string }) {
    const { map, city } = useMap();

    useEffect(() => {
        if (!map || !city) return;

        // Show layers that are part of this mode
        if (map.getLayer('bike-paths-layer')) {
            map.setLayoutProperty('bike-paths-layer', 'visibility', 'visible');
        }

        // Ensure stations and traffic are hidden
        if (map.getLayer('stations-layer')) {
            map.setLayoutProperty('stations-layer', 'visibility', 'none');
        }
        if (map.getLayer('traffic-layer')) {
            map.setLayoutProperty('traffic-layer', 'visibility', 'none');
        }

        return () => {
            try {
                if (map.getLayer('bike-paths-layer')) {
                    map.setLayoutProperty('bike-paths-layer', 'visibility', 'none');
                }
            } catch { /* map may have been removed */ }
        };
    }, [map, city]);

    return null;
}
