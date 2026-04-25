import { useEffect, useRef, useCallback } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import maplibregl from 'maplibre-gl';
import { useMap } from '../../MapContext';
import { fetchAccidents } from '../../../../../services/api';
import type { AccidentFeature } from '../../../../../services/api';
import { Bike, Car, Truck, Bus, PersonStanding, CircleHelp, Wine } from 'lucide-react';

const SOURCE_ID = 'accidents-source';
const LAYER_ID = 'accidents-layer';

// Severity colors
const SEVERITY_COLORS = {
    fatal: '#7f1d1d',      // Dark red
    serious: '#dc2626',    // Red
    minor: '#f59e0b',      // Amber
    uninjured: '#3b82f6',  // Blue
};

function getVehicleIcon(type: string | null) {
    if (!type) return <CircleHelp size={16} />;
    const t = type.toLowerCase();
    if (t.includes('bici') || t.includes('vmu') || t.includes('patinete') || t.includes('ciclo')) return <Bike size={16} />;
    if (t.includes('moto') || t.includes('ciclomotor') || t.includes('cuadriciclo')) return <Bike size={16} />;
    if (t.includes('turismo') || t.includes('todo terreno') || t.includes('furgoneta')) return <Car size={16} />;
    if (t.includes('bus')) return <Bus size={16} />;
    if (t.includes('camión') || t.includes('maquinaria') || t.includes('tracto') || t.includes('remolque')) return <Truck size={16} />;
    return <CircleHelp size={16} />;
}

const AccidentPopupContent = ({ props, onClose }: { props: AccidentFeature['properties'], onClose: () => void }) => {
    let participantsData = [];
    if (props.participants) {
        participantsData = typeof props.participants === 'string' 
            ? JSON.parse(props.participants) 
            : props.participants;
    }

    const formatTime = (ts: string | null) => {
        if (!ts) return null;
        const d = new Date(ts);
        return {
            date: d.toLocaleDateString('es-ES'),
            time: d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
        };
    };

    const timeInfo = formatTime(props.timestamp);

    const severityText = props.severity === 'fatal' ? 'Fatal' : 
                         props.severity === 'serious' ? 'Grave' : 
                         props.severity === 'minor' ? 'Leve' : 'Ileso';

    return (
        <div style={{ fontFamily: "'Archivo Narrow', sans-serif", padding: '2px', minWidth: '240px', maxWidth: '300px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '8px', borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: '6px' }}>
                <div>
                    <div style={{ display: 'inline-block', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 800, color: 'white', marginBottom: '4px', textTransform: 'uppercase', backgroundColor: SEVERITY_COLORS[props.severity] || '#9ca3af' }}>
                        {severityText}
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#1a202c', lineHeight: 1.2 }}>
                        {props.street ? `${props.street}${props.street_number ? ' ' + props.street_number : ''}` : 'Ubicación desconocida'}
                    </div>
                </div>
                <span onClick={(e) => { e.stopPropagation(); onClose(); }} style={{ cursor: 'pointer', color: 'rgba(0,0,0,0.3)', fontSize: '12px', flexShrink: 0, padding: '2px' }}>✕</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '11px' }}>
                {timeInfo && (
                    <>
                        <div><span style={{ color: '#718096', fontWeight: 600 }}>Fecha:</span> <span style={{ color: '#2d3748', fontWeight: 700 }}>{timeInfo.date}</span></div>
                        <div><span style={{ color: '#718096', fontWeight: 600 }}>Hora:</span> <span style={{ color: '#2d3748', fontWeight: 700 }}>{timeInfo.time}</span></div>
                    </>
                )}
                <div><span style={{ color: '#718096', fontWeight: 600 }}>Tipo:</span> <span style={{ color: '#2d3748', fontWeight: 700 }}>{props.accident_type || 'Desconocido'}</span></div>
                <div><span style={{ color: '#718096', fontWeight: 600 }}>Implicados:</span> <span style={{ color: '#2d3748', fontWeight: 700 }}>{props.total_involved}</span></div>
            </div>

            {participantsData.length > 0 && (
                <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#4a5568', borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: '2px' }}>Participantes</div>
                    {participantsData.map((p: any, idx: number) => {
                        const isPedestrian = p.person_type?.toLowerCase().includes('peato');
                        
                        let color = '#718096';
                        if (p.injury_code === 4) color = SEVERITY_COLORS.fatal;
                        else if (p.injury_code === 3) color = SEVERITY_COLORS.serious;
                        else if (p.injury_code === 14) color = SEVERITY_COLORS.uninjured;
                        else if (p.injury_code) color = SEVERITY_COLORS.minor;

                        return (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', background: '#f7fafc', padding: '6px', borderRadius: '4px', borderLeft: `2px solid ${color}` }}>
                                <span style={{ color: '#4a5568', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {isPedestrian ? <PersonStanding size={16} /> : getVehicleIcon(p.vehicle_type)}
                                </span>
                                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '2px' }}>
                                    <span style={{ fontWeight: 700, color: '#2d3748', textTransform: 'capitalize' }}>
                                        {isPedestrian ? 'Peatón' : (p.vehicle_type ? p.vehicle_type.toLowerCase() : 'Vehículo desconocido')}
                                    </span>
                                    {p.injury_status && (
                                        <span style={{ color: '#718096', fontSize: '10px', lineHeight: 1.2 }}>
                                            <span style={{ color: color, fontWeight: 600 }}>{p.injury_status}</span>
                                        </span>
                                    )}
                                </div>
                                {(p.alcohol_positive || p.drugs_positive) && (
                                    <div title="Positivo en Alcohol o Drogas" style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#fee2e2', color: '#b91c1c', padding: '2px 6px', borderRadius: '4px', marginLeft: 'auto', fontWeight: 700, fontSize: '10px' }}>
                                        <Wine size={12} strokeWidth={2.5} />
                                        <span>+</span>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default function AccidentsLayer() {
    const { map, city } = useMap();
    const popupRef = useRef<maplibregl.Popup | null>(null);
    const rootRef = useRef<Root | null>(null);
    const activeIdRef = useRef<string | null>(null);

    const clearPopup = useCallback(() => {
        if (rootRef.current) {
            rootRef.current.unmount();
            rootRef.current = null;
        }
        if (popupRef.current) {
            popupRef.current.remove();
            popupRef.current = null;
        }
        if (activeIdRef.current && map) {
            map.setFeatureState(
                { source: SOURCE_ID, id: activeIdRef.current },
                { selected: false }
            );
            activeIdRef.current = null;
        }
    }, [map]);

    // --- Mount: hide other layers ---
    useEffect(() => {
        if (!map) return;
        
        // Hide other specific layers
        const hideLayer = (id: string) => {
            if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none');
        };
        
        hideLayer('stations-layer');
        hideLayer('bike-paths-layer');
        hideLayer('traffic-layer');

        return () => {
            clearPopup();
            if (map.getLayer(LAYER_ID)) {
                map.removeLayer(LAYER_ID);
            }
            if (map.getSource(SOURCE_ID)) {
                map.removeSource(SOURCE_ID);
            }
        };
    }, [map, clearPopup]);

    // --- Data fetch and layer creation ---
    useEffect(() => {
        if (!map || !city?.id) return;
        
        let cancelled = false;

        fetchAccidents(city.id).then(geojson => {
            if (cancelled || !map) return;

            // Ensure source exists or create it
            if (!map.getSource(SOURCE_ID)) {
                // Promote accident_id to feature.id for state tracking
                map.addSource(SOURCE_ID, {
                    type: 'geojson',
                    data: geojson,
                    promoteId: 'accident_id'
                });
            } else {
                (map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource).setData(geojson);
            }

            // Ensure layer exists
            if (!map.getLayer(LAYER_ID)) {
                map.addLayer({
                    id: LAYER_ID,
                    type: 'circle',
                    source: SOURCE_ID,
                    paint: {
                        'circle-radius': [
                            'case',
                            ['boolean', ['feature-state', 'selected'], false],
                            10,
                            ['interpolate', ['linear'], ['zoom'], 10, 4, 16, 8]
                        ],
                        'circle-color': [
                            'match',
                            ['get', 'severity'],
                            'fatal', SEVERITY_COLORS.fatal,
                            'serious', SEVERITY_COLORS.serious,
                            'minor', SEVERITY_COLORS.minor,
                            'uninjured', SEVERITY_COLORS.uninjured,
                            '#9ca3af' // fallback
                        ],
                        'circle-opacity': [
                            'case',
                            ['boolean', ['feature-state', 'selected'], false],
                            1,
                            0.75
                        ],
                        'circle-stroke-width': [
                            'case',
                            ['boolean', ['feature-state', 'selected'], false],
                            3,
                            1.5
                        ],
                        'circle-stroke-color': '#ffffff'
                    }
                });

                // Set up interactions
                map.on('mouseenter', LAYER_ID, () => {
                    map.getCanvas().style.cursor = 'pointer';
                });

                map.on('mouseleave', LAYER_ID, () => {
                    map.getCanvas().style.cursor = '';
                });

                map.on('click', LAYER_ID, (e) => {
                    const feature = e.features?.[0];
                    if (!feature || !feature.id) return;

                    const accidentId = String(feature.id);
                    
                    if (activeIdRef.current === accidentId) return; // Already selected
                    
                    clearPopup();
                    
                    activeIdRef.current = accidentId;
                    map.setFeatureState(
                        { source: SOURCE_ID, id: accidentId },
                        { selected: true }
                    );

                    const popup = new maplibregl.Popup({
                        closeButton: false,
                        closeOnClick: false,
                        maxWidth: '320px'
                    });
                    
                    popupRef.current = popup;

                    const popupNode = document.createElement('div');
                    const root = createRoot(popupNode);
                    rootRef.current = root;
                    
                    root.render(
                        <AccidentPopupContent 
                            props={feature.properties as AccidentFeature['properties']} 
                            onClose={() => clearPopup()} 
                        />
                    );
                    
                    popup.setLngLat((feature.geometry as any).coordinates).setDOMContent(popupNode).addTo(map);
                });

                map.on('click', (e) => {
                    if (!activeIdRef.current) return;
                    const hits = map.queryRenderedFeatures(e.point, { layers: [LAYER_ID] });
                    if (!hits?.length) clearPopup();
                });
            }
        }).catch(err => {
            console.error('Failed to load accidents:', err);
        });

        return () => {
            cancelled = true;
        };
    }, [map, city?.id, clearPopup]);

    return null;
}
