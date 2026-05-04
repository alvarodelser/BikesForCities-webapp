import { createContext, useContext } from 'react';
import type maplibregl from 'maplibre-gl';
import type { CityData } from '../../../constants/cities';

export interface MapContextValue {
    map: maplibregl.Map | null;
    city: CityData | null;
    // Control callbacks
    zoomIn: () => void;
    zoomOut: () => void;
    reset: () => void;
    toggleBackground: (show: boolean) => void;
    // Edge selection — set by TrafficLayer, read by MapFilters pill
    selectedEdgeId: number | null;
    setSelectedEdgeId: (id: number | null) => void;
    // Layer data state
    layerState: 'idle' | 'loading' | 'error' | 'empty';
    setLayerState: (state: 'idle' | 'loading' | 'error' | 'empty') => void;
    setLayerRetry: (retryFn: () => void) => void;
}

const noop = () => {};

export const MapContext = createContext<MapContextValue>({
    map: null,
    city: null,
    zoomIn: noop,
    zoomOut: noop,
    reset: noop,
    toggleBackground: noop,
    selectedEdgeId: null,
    setSelectedEdgeId: noop,
    layerState: 'idle',
    setLayerState: noop,
    setLayerRetry: noop,
});

export const useMap = () => useContext(MapContext);
