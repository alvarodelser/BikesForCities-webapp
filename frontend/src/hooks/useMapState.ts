import { useParams, useSearchParams } from 'react-router';
import { useCallback } from 'react';

export interface MapState {
    cityName: string;
    mode: string;
    submode: string;
    setMode: (newMode: string, newSubmode?: string) => void;
    setSubmode: (newSubmode: string) => void;
}

/**
 * Central hook for all URL-derived map state.
 * Reads: /map/:cityName?mode=stations&submode=trips
 * Writes atomically so navigation is always consistent & bookmarkable.
 */
export function useMapState(): MapState {
    const { cityName = '' } = useParams<{ cityName: string }>();
    const [searchParams, setSearchParams] = useSearchParams();

    const mode    = searchParams.get('mode')    ?? 'infrastructure';
    const submode = searchParams.get('submode') ?? '';

    const setMode = useCallback((newMode: string, newSubmode?: string) => {
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            next.set('mode', newMode);
            if (newSubmode) {
                next.set('submode', newSubmode);
            } else {
                next.delete('submode');
            }
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

    return { cityName, mode, submode, setMode, setSubmode };
}
