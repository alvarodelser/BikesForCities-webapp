import { useEffect } from 'react';
import { useMap } from '../../MapContext';

export default function TerrainLayer() {
    const { map } = useMap();
    useEffect(() => {
        if (!map) return;
        if (map.getLayer('stations-layer'))   map.setLayoutProperty('stations-layer',  'visibility', 'none');
        if (map.getLayer('bike-paths-layer')) map.setLayoutProperty('bike-paths-layer','visibility', 'none');
        if (map.getLayer('traffic-layer'))    map.setLayoutProperty('traffic-layer',   'visibility', 'none');
        // TODO: add terrain source + layer
    }, [map]);
    return null;
}
