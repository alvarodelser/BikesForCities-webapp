import { useEffect, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import { useMap } from '../../MapContext';
import { useMapState } from '../../../../../hooks/useMapState';
import { fetchAccidentDetail } from '../../../../../services/api';
import type { AccidentDetail, AccidentParticipant } from '../../../../../services/api';
import { TILE_SERVER_URL } from '../../../../../config/api';
import type { SelectionDetail, SelectionParticipant } from '../../../../../types/selection';
import { resolveVehicleIcon, resolveAccidentTypeIcon } from './vehicleIcons';

const SOURCE_ID = 'accidents-source';
const LAYER_ID = 'accidents-layer';
const SOURCE_LAYER = 'accidents';

const SEVERITY_COLORS = {
    fatal: '#7f1d1d',
    serious: '#dc2626',
    minor: '#f59e0b',
    uninjured: '#3b82f6',
} as const;

const SEVERITY_LABELS: Record<string, string> = {
    fatal: 'Fatal',
    serious: 'Grave',
    minor: 'Leve',
    uninjured: 'Ileso',
};

function getSeverityColorFromCode(code: number | null | undefined): string {
    if (code === 4)  return SEVERITY_COLORS.fatal;
    if (code === 3)  return SEVERITY_COLORS.serious;
    if (code === 14) return SEVERITY_COLORS.uninjured;
    if (code != null && !isNaN(Number(code))) return SEVERITY_COLORS.minor;
    return '#9ca3af';
}

function buildBaseDetail(props: Record<string, unknown>): SelectionDetail {
    const severity = (props.severity as string) ?? 'uninjured';
    const severityColor = SEVERITY_COLORS[severity as keyof typeof SEVERITY_COLORS] ?? '#9ca3af';
    const severityLabel = SEVERITY_LABELS[severity] ?? severity;

    // Vector tiles only carry severity + accident_id; metadata rows come once
    // the detail endpoint resolves.
    return {
        type: 'accident',
        title: 'Cargando…',
        badge: { text: severityLabel, color: severityColor },
        rows: [],
        loading: true,
    };
}

function formatTime(ts: string | null): string | null {
    if (!ts) return null;
    const d = new Date(ts);
    return `${d.toLocaleDateString('es-ES')} ${d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
}

function enrichDetail(base: SelectionDetail, detail: AccidentDetail): SelectionDetail {
    const rows: NonNullable<SelectionDetail['rows']> = [];
    if (detail.timestamp) rows.push({ label: 'FECHA', value: formatTime(detail.timestamp) ?? '—' });
    if (detail.accident_type) {
        const typeEntry = resolveAccidentTypeIcon(detail.accident_type);
        rows.push({ label: 'TIPO', value: detail.accident_type, icon: typeEntry.icon, accent: typeEntry.color });
    }
    if (detail.district) rows.push({ label: 'DISTRITO', value: detail.district });

    const title = detail.street
        ? `${detail.street}${detail.street_number ? ' ' + detail.street_number : ''}`
        : 'Ubicación desconocida';

    return {
        ...base,
        title,
        loading: false,
        rows,
        participants: toSelectionParticipants(detail.participants),
    };
}

function toSelectionParticipants(raw: AccidentParticipant[]): SelectionParticipant[] {
    return raw.map(p => {
        const entry = resolveVehicleIcon(p.vehicle_type, p.person_type);
        return {
            icon: entry.icon,
            severityColor: getSeverityColorFromCode(p.injury_code),
            label: entry.label,
            alcoholPositive: !!p.alcohol_positive,
            drugsPositive: !!p.drugs_positive,
        };
    });
}

interface AccidentsLayerProps {
    submode: string;
}

export default function AccidentsLayer({ submode: _submode }: AccidentsLayerProps) {
    const { map, city, setLayerState } = useMap();
    const { yearFrom, yearTo, accidentType } = useMapState();
    const yearFromNum = yearFrom ? parseInt(yearFrom, 10) : undefined;
    const yearToNum   = yearTo   ? parseInt(yearTo,   10) : undefined;
    const activeIdRef = useRef<string | null>(null);
    const globalClickHandlerRef = useRef<((e: maplibregl.MapMouseEvent) => void) | null>(null);
    const detailReqIdRef = useRef(0);

    const cyclistsOnly = accidentType !== 'all';

    const clearSelection = useCallback(() => {
        if (activeIdRef.current && map) {
            map.setFeatureState(
                { source: SOURCE_ID, sourceLayer: SOURCE_LAYER, id: activeIdRef.current },
                { selected: false },
            );
            activeIdRef.current = null;
        }
    }, [map]);

    useEffect(() => {
        if (!map || !city?.id) return;

        const cityId = city.id;

        ['stations-layer', 'bike-paths-layer', 'traffic-layer'].forEach(id => {
            if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none');
        });

        const onSelectionEvent = (e: Event) => {
            if (!(e as CustomEvent).detail) clearSelection();
        };
        window.addEventListener('map-selection', onSelectionEvent);

        const tileParams = new URLSearchParams({ city_id: String(cityId), cyclists_only: String(cyclistsOnly) });
        if (yearFromNum != null) tileParams.set('year_from', String(yearFromNum));
        if (yearToNum   != null) tileParams.set('year_to',   String(yearToNum));
        const tileUrl = `${TILE_SERVER_URL}/accidents_tile/{z}/{x}/{y}?${tileParams}`;

        setLayerState?.('loading');

        const onSourceData = (e: maplibregl.MapSourceDataEvent) => {
            if (e.sourceId === SOURCE_ID && e.isSourceLoaded) setLayerState?.('idle');
        };
        const onError = (e: maplibregl.ErrorEvent) => {
            if ((e as any)?.sourceId === SOURCE_ID) setLayerState?.('error');
        };
        map.on('sourcedata', onSourceData);
        map.on('error', onError);

        map.addSource(SOURCE_ID, {
            type: 'vector',
            tiles: [tileUrl],
            minzoom: 0,
            maxzoom: 22,
            promoteId: { [SOURCE_LAYER]: 'accident_id' },
        });
        map.addLayer({
            id: LAYER_ID,
            type: 'circle',
            source: SOURCE_ID,
            'source-layer': SOURCE_LAYER,
            paint: {
                // zoom must be the top-level input to interpolate/step in ML5+;
                // it cannot appear nested inside a case expression.
                'circle-radius': [
                    'interpolate', ['linear'], ['zoom'],
                    10, ['case', ['boolean', ['feature-state', 'selected'], false], 10, 4],
                    16, ['case', ['boolean', ['feature-state', 'selected'], false], 10, 8],
                ],
                'circle-color': [
                    'match', ['get', 'severity'],
                    'fatal',     SEVERITY_COLORS.fatal,
                    'serious',   SEVERITY_COLORS.serious,
                    'minor',     SEVERITY_COLORS.minor,
                    'uninjured', SEVERITY_COLORS.uninjured,
                    '#9ca3af',
                ],
                'circle-opacity': [
                    'case', ['boolean', ['feature-state', 'selected'], false], 1, 0.75,
                ],
                'circle-stroke-width': [
                    'case', ['boolean', ['feature-state', 'selected'], false], 3, 1.5,
                ],
                'circle-stroke-color': '#ffffff',
            },
        });

        map.on('mouseenter', LAYER_ID, () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', LAYER_ID, () => { map.getCanvas().style.cursor = ''; });

        map.on('click', LAYER_ID, (e) => {
            const feature = e.features?.[0];
            if (!feature || feature.id == null) return;

            const accidentId = String(feature.id);
            if (activeIdRef.current === accidentId) return;

            clearSelection();
            activeIdRef.current = accidentId;
            map.setFeatureState(
                { source: SOURCE_ID, sourceLayer: SOURCE_LAYER, id: accidentId },
                { selected: true },
            );

            const baseDetail = buildBaseDetail(feature.properties as Record<string, unknown>);
            window.dispatchEvent(new CustomEvent('map-selection', { detail: baseDetail }));

            const reqId = ++detailReqIdRef.current;
            fetchAccidentDetail(cityId, accidentId)
                .then(detail => {
                    if (reqId !== detailReqIdRef.current) return;
                    if (activeIdRef.current !== accidentId) return;
                    const enriched = enrichDetail(baseDetail, detail);
                    window.dispatchEvent(new CustomEvent('map-selection', { detail: enriched }));
                })
                .catch(err => {
                    if (reqId !== detailReqIdRef.current) return;
                    console.error('Failed to load accident detail:', err);
                    window.dispatchEvent(new CustomEvent('map-selection', {
                        detail: { ...baseDetail, loading: false },
                    }));
                });
        });

        const globalClickHandler = (e: maplibregl.MapMouseEvent) => {
            if (!activeIdRef.current) return;
            const hits = map.queryRenderedFeatures(e.point, { layers: [LAYER_ID] });
            if (!hits?.length) {
                clearSelection();
                window.dispatchEvent(new CustomEvent('map-selection', { detail: null }));
            }
        };
        globalClickHandlerRef.current = globalClickHandler;
        map.on('click', globalClickHandler);

        return () => {
            window.removeEventListener('map-selection', onSelectionEvent);
            clearSelection();
            window.dispatchEvent(new CustomEvent('map-selection', { detail: null }));
            map.off('sourcedata', onSourceData);
            map.off('error', onError);
            if (globalClickHandlerRef.current) {
                map.off('click', globalClickHandlerRef.current);
                globalClickHandlerRef.current = null;
            }
            try {
                if (map.getLayer(LAYER_ID))   map.removeLayer(LAYER_ID);
                if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
            } catch { /* map may have been removed */ }
        };
    }, [map, city?.id, accidentType, yearFrom, yearTo, clearSelection, setLayerState]);

    return null;
}
