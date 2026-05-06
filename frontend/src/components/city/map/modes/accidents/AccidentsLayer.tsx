import { useEffect, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import { useMap } from '../../MapContext';
import { fetchAccidents } from '../../../../../services/api';
import type { AccidentFeature } from '../../../../../services/api';
import type { SelectionDetail, SelectionParticipant } from '../../../../../types/selection';

const SOURCE_ID = 'accidents-source';
const LAYER_ID = 'accidents-layer';

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

function getParticipantEmoji(vehicleType: string | null, personType: string | null): string {
    const isPedestrian = (personType || '').toLowerCase().includes('peato');
    if (isPedestrian) return '🚶';
    const vt = (vehicleType || '').toLowerCase();
    if (vt.includes('bicicleta') || vt.includes('epac')) return '🚲';
    if (vt.includes('vmu') || vt.includes('patinete')) return '🛴';
    if (vt.includes('moto') || vt.includes('ciclomotor') || vt.includes('cuadriciclo')) return '🏍️';
    if (vt.includes('furgoneta')) return '🚐';
    if (vt.includes('turismo') || vt.includes('todo terreno')) return '🚗';
    if (vt.includes('autobús') || vt.includes('autobus')) return '🚌';
    if (vt.includes('camión') || vt.includes('maquinaria') || vt.includes('tracto')) return '🚛';
    if (vt.includes('ambulancia')) return '🚑';
    return '🚘';
}

function getSeverityColorFromCode(code: number | null | undefined): string {
    if (code === 4)  return SEVERITY_COLORS.fatal;
    if (code === 3)  return SEVERITY_COLORS.serious;
    if (code === 14) return SEVERITY_COLORS.uninjured;
    if (code != null && !isNaN(Number(code))) return SEVERITY_COLORS.minor;
    return '#9ca3af';
}

function buildSelectionDetail(props: AccidentFeature['properties']): SelectionDetail {
    let rawParticipants: any[] = [];
    if (props.participants) {
        try {
            rawParticipants = typeof props.participants === 'string'
                ? JSON.parse(props.participants)
                : props.participants;
        } catch { /* ignore */ }
    }

    const participants: SelectionParticipant[] = rawParticipants.map(p => ({
        emoji: getParticipantEmoji(p.vehicle_type, p.person_type),
        severityColor: getSeverityColorFromCode(p.injury_code),
        label: p.vehicle_type || p.person_type || '—',
    }));

    const hasAlcohol = rawParticipants.some(p => p.alcohol_positive);
    const hasDrugs   = rawParticipants.some(p => p.drugs_positive);

    const severityColor = SEVERITY_COLORS[props.severity as keyof typeof SEVERITY_COLORS] ?? '#9ca3af';
    const severityLabel = SEVERITY_LABELS[props.severity] ?? props.severity;

    const formatTime = (ts: string | null) => {
        if (!ts) return null;
        const d = new Date(ts);
        return `${d.toLocaleDateString('es-ES')} ${d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
    };

    const rows: NonNullable<SelectionDetail['rows']> = [];
    if (props.timestamp) rows.push({ label: 'FECHA', value: formatTime(props.timestamp) ?? '—' });
    if (props.accident_type) rows.push({ label: 'TIPO', value: props.accident_type });
    if (props.district) rows.push({ label: 'DISTRITO', value: props.district });
    if (hasAlcohol) rows.push({ label: 'ALCOHOL', value: '🍷 Positivo', accent: '#dc2626' });
    if (hasDrugs)   rows.push({ label: 'DROGAS',  value: '⚗️ Positivo', accent: '#dc2626' });

    const title = props.street
        ? `${props.street}${props.street_number ? ' ' + props.street_number : ''}`
        : 'Ubicación desconocida';

    return {
        type: 'accident',
        title,
        badge: { text: severityLabel, color: severityColor },
        rows,
        participants,
    };
}

export default function AccidentsLayer() {
    const { map, city, setLayerState, setLayerRetry } = useMap();
    const activeIdRef = useRef<string | null>(null);

    const clearSelection = useCallback(() => {
        if (activeIdRef.current && map) {
            map.setFeatureState({ source: SOURCE_ID, id: activeIdRef.current }, { selected: false });
            activeIdRef.current = null;
        }
    }, [map]);

    // Mount: hide other layers; clear panel when selection event fires null
    useEffect(() => {
        if (!map) return;

        ['stations-layer', 'bike-paths-layer', 'traffic-layer'].forEach(id => {
            if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none');
        });

        const onSelectionEvent = (e: Event) => {
            if (!(e as CustomEvent).detail) clearSelection();
        };
        window.addEventListener('map-selection', onSelectionEvent);

        return () => {
            window.removeEventListener('map-selection', onSelectionEvent);
            clearSelection();
            window.dispatchEvent(new CustomEvent('map-selection', { detail: null }));
            try {
                if (map.getLayer(LAYER_ID))  map.removeLayer(LAYER_ID);
                if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
            } catch { /* map may have been removed */ }
        };
    }, [map, clearSelection]);

    // Data fetch + layer creation
    useEffect(() => {
        if (!map || !city?.id) return;

        let cancelled = false;

        const loadData = () => {
            if (cancelled) return;
            setLayerState?.('loading');

            fetchAccidents(city!.id!).then(geojson => {
                if (cancelled || !map) return;

                setLayerState?.(geojson.features?.length ? 'idle' : 'empty');

                if (!map.getSource(SOURCE_ID)) {
                    map.addSource(SOURCE_ID, {
                        type: 'geojson',
                        data: geojson,
                        promoteId: 'accident_id',
                    });
                } else {
                    (map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource).setData(geojson);
                }

                if (!map.getLayer(LAYER_ID)) {
                    map.addLayer({
                        id: LAYER_ID,
                        type: 'circle',
                        source: SOURCE_ID,
                        paint: {
                            'circle-radius': [
                                'case',
                                ['boolean', ['feature-state', 'selected'], false], 10,
                                ['interpolate', ['linear'], ['zoom'], 10, 4, 16, 8],
                            ],
                            'circle-color': [
                                'match', ['get', 'severity'],
                                'fatal',    SEVERITY_COLORS.fatal,
                                'serious',  SEVERITY_COLORS.serious,
                                'minor',    SEVERITY_COLORS.minor,
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
                        if (!feature || !feature.id) return;

                        const accidentId = String(feature.id);
                        if (activeIdRef.current === accidentId) return;

                        clearSelection();
                        activeIdRef.current = accidentId;
                        map.setFeatureState({ source: SOURCE_ID, id: accidentId }, { selected: true });

                        const detail = buildSelectionDetail(feature.properties as AccidentFeature['properties']);
                        window.dispatchEvent(new CustomEvent('map-selection', { detail }));
                    });

                    // Click on empty space → deselect
                    map.on('click', (e) => {
                        if (!activeIdRef.current) return;
                        const hits = map.queryRenderedFeatures(e.point, { layers: [LAYER_ID] });
                        if (!hits?.length) {
                            clearSelection();
                            window.dispatchEvent(new CustomEvent('map-selection', { detail: null }));
                        }
                    });
                }
            }).catch(err => {
                if (cancelled) return;
                console.error('Failed to load accidents:', err);
                setLayerState?.('error');
            });
        };

        setLayerRetry?.(loadData);
        loadData();

        return () => {
            cancelled = true;
            setLayerState?.('idle');
        };
    }, [map, city?.id, clearSelection, setLayerState, setLayerRetry]);

    return null;
}
