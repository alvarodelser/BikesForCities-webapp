import { createContext, useContext } from 'react';
import type maplibregl from 'maplibre-gl';
import type { CityData } from '../../../constants/cities';

export interface MapContextValue {
    map: maplibregl.Map | null;
    city: CityData | null;
    // Control callbacks (formerly CityCanvasHandle via forwardRef)
    zoomIn: () => void;
    zoomOut: () => void;
    reset: () => void;
    toggleBackground: (show: boolean) => void;
}

const noop = () => {};

export const MapContext = createContext<MapContextValue>({
    map: null,
    city: null,
    zoomIn: noop,
    zoomOut: noop,
    reset: noop,
    toggleBackground: noop,
});

export const useMap = () => useContext(MapContext);
