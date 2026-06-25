import { useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { MAP_MODES, type MapMode } from '../constants/mapModes';

export interface MapState {
    cityName: string;
    mode: MapMode;
    submode: string;
    generation: string;
    routing: string;
    period: string;
    yearFrom: string;
    yearTo: string;
    periodFrom: string;
    accidentType: 'bike' | 'all';
    setMode: (newMode: MapMode, newSubmode?: string) => void;
    setSubmode: (newSubmode: string) => void;
    setGeneration: (value: string) => void;
    setRouting: (value: string) => void;
    setPeriod: (value: string) => void;
    setYearFrom: (value: string) => void;
    setYearTo: (value: string) => void;
    setPeriodFrom: (value: string) => void;
    setAccidentType: (value: 'bike' | 'all') => void;
}

/**
 * Central hook for all URL-derived map state.
 * Reads: /map/:cityName?mode=stations&submode=trips
 * Writes atomically so navigation is always consistent & bookmarkable.
 */
export function useMapState(): MapState {
    const { cityName = '' } = useParams<{ cityName: string }>();
    const [searchParams, setSearchParams] = useSearchParams();

    const mode        = (searchParams.get('mode') as MapMode) ?? MAP_MODES.INFRASTRUCTURE;
    const submode     = searchParams.get('submode') ?? '';
    const generation  = searchParams.get('generation') ?? '';
    const routing     = searchParams.get('routing') ?? '';
    const period      = searchParams.get('period') ?? '';
    const yearFrom    = searchParams.get('yearFrom') ?? '';
    const yearTo      = searchParams.get('yearTo') ?? '';
    const periodFrom    = searchParams.get('periodFrom') ?? '';
    const accidentType  = (searchParams.get('accidentType') as 'bike' | 'all') || 'bike';

    const setMode = useCallback((newMode: MapMode, newSubmode?: string) => {
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            const currentMode = prev.get('mode');
            next.set('mode', newMode);
            if (newSubmode) {
                next.set('submode', newSubmode);
            } else {
                next.delete('submode');
            }
            if (currentMode !== newMode) {
                next.delete('generation');
                next.delete('routing');
                next.delete('period');
                next.delete('yearFrom');
                next.delete('yearTo');
                next.delete('periodFrom');
                next.delete('accidentType');
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

    const setPeriod = useCallback((value: string) => {
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            if (value) next.set('period', value); else next.delete('period');
            return next;
        }, { replace: true });
    }, [setSearchParams]);

    const setYearFrom = useCallback((value: string) => {
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            if (value) next.set('yearFrom', value); else next.delete('yearFrom');
            return next;
        }, { replace: true });
    }, [setSearchParams]);

    const setYearTo = useCallback((value: string) => {
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            if (value) next.set('yearTo', value); else next.delete('yearTo');
            return next;
        }, { replace: true });
    }, [setSearchParams]);

    const setPeriodFrom = useCallback((value: string) => {
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            if (value) next.set('periodFrom', value); else next.delete('periodFrom');
            return next;
        }, { replace: true });
    }, [setSearchParams]);

    const setAccidentType = useCallback((value: 'bike' | 'all') => {
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            if (value === 'all') next.set('accidentType', 'all'); else next.delete('accidentType');
            return next;
        }, { replace: true });
    }, [setSearchParams]);

    return {
        cityName, mode, submode, generation, routing, period,
        yearFrom, yearTo, periodFrom, accidentType,
        setMode, setSubmode, setGeneration, setRouting, setPeriod,
        setYearFrom, setYearTo, setPeriodFrom, setAccidentType,
    };
}
