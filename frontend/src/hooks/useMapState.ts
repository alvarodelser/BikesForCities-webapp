import { useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { MAP_MODES, type MapMode } from '../constants/mapModes';

export interface MapState {
    cityName: string;
    mode: MapMode;
    submode: string;
    generation: string;
    routing: string;
    setMode: (newMode: MapMode, newSubmode?: string) => void;
    setSubmode: (newSubmode: string) => void;
    setGeneration: (value: string) => void;
    setRouting: (value: string) => void;
}

/**
 * Central hook for all URL-derived map state.
 * Reads: /map/:cityName?mode=stations&submode=trips
 * Writes atomically so navigation is always consistent & bookmarkable.
 */
export function useMapState(): MapState {
    const { cityName = '' } = useParams<{ cityName: string }>();
    const [searchParams, setSearchParams] = useSearchParams();

    const mode       = (searchParams.get('mode') as MapMode) ?? MAP_MODES.INFRASTRUCTURE;
    const submode    = searchParams.get('submode') ?? '';
    const generation = searchParams.get('generation') ?? '';
    const routing    = searchParams.get('routing') ?? '';

    const setMode = useCallback((newMode: MapMode, newSubmode?: string) => {
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            next.set('mode', newMode);
            if (newSubmode) {
                next.set('submode', newSubmode);
            } else {
                next.delete('submode');
            }
            // Clear computation params when mode changes
            next.delete('generation');
            next.delete('routing');
            return next;
        }, { replace: true });
    }, [setSearchParams]);

    const setSubmode = useCallback((newSubmode: string) => {
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            next.set('submode', newSubmode);
            return next;
        }, { replace: true });
    }, [setSearchParams]);

    const setGeneration = useCallback((value: string) => {
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            if (value) next.set('generation', value); else next.delete('generation');
            return next;
        }, { replace: true });
    }, [setSearchParams]);

    const setRouting = useCallback((value: string) => {
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            if (value) next.set('routing', value); else next.delete('routing');
            return next;
        }, { replace: true });
    }, [setSearchParams]);

    return { cityName, mode, submode, generation, routing, setMode, setSubmode, setGeneration, setRouting };
}
