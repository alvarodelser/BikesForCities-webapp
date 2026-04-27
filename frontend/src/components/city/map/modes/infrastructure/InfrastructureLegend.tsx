import React, { useState, useEffect, useRef } from 'react';
import { useMap } from '../../MapContext';
import { fetchInfraComponents } from '../../../../../services/api';

interface LegendItemProps {
    type: string;
    color: string;
    label: string;
    isInteractable?: boolean;
    isActive?: boolean;
    onToggle?: () => void;
    children?: React.ReactNode;
}

const LegendItem: React.FC<LegendItemProps> = ({ type, color, label, isInteractable, isActive = true, onToggle, children }) => (
    <div
        className={`flex items-center justify-between gap-2 w-full ${isInteractable ? 'cursor-pointer hover:bg-black/5 p-1.5 -m-1.5 rounded-xl transition-all duration-300 group' : ''}`}
        onClick={isInteractable ? onToggle : undefined}
    >
        <div className="flex items-center gap-2">
            {type === 'line' && <div className="w-4 h-1 rounded-sm shadow-sm" style={{ backgroundColor: color }} />}
            {type === 'square' && (
                <div
                    className="w-3 h-3 rounded-sm shadow-sm transition-opacity"
                    style={{ backgroundColor: color, opacity: isActive ? 1 : 0.3 }}
                />
            )}
            {type === 'dashed' && <div className="w-4 h-0 border-t-2 border-dashed shadow-sm" style={{ borderColor: color }} />}
            {type === 'custom' && children}
            <span className={`text-xs font-semibold text-black/60 transition-colors ${!isActive && 'opacity-40'}`}>
                {label}
            </span>
        </div>

        {isInteractable && (
            <div className="flex items-center">
                <div className={`w-7 h-3.5 rounded-full relative transition-colors duration-300 ${isActive ? 'bg-teal-500 shadow-[0_0_8px_rgba(20,184,166,0.4)]' : 'bg-gray-300'}`}>
                    <div className={`absolute top-0.5 w-2.5 h-2.5 bg-white rounded-full shadow-sm transition-all duration-300 ${isActive ? 'left-4' : 'left-0.5'}`} />
                </div>
            </div>
        )}
    </div>
);

const BUILDINGS_LAYER_ID = 'bike-path-buildings-layer';
const COMPONENTS_SOURCE_ID = 'infra-components-source';
const COMPONENTS_LAYER_ID = 'infra-components-layer';
const BIKE_PATHS_LAYER_ID = 'bike-paths-layer';

const COMPONENT_COLORS = [
    '#00cac3',  // 0: GCC (teal)
    '#f59e0b',  // 1: amber
    '#ef4444',  // 2: red
    '#8b5cf6',  // 3: purple
    '#3b82f6',  // 4: blue
    '#f97316',  // 5: orange
    '#10b981',  // 6: emerald
    '#ec4899',  // 7: pink
];
const FALLBACK_COLOR = '#9ca3af';

function buildColorExpression(): maplibregl.ExpressionSpecification {
    const expr: any[] = ['match', ['get', 'component_id']];
    COMPONENT_COLORS.forEach((color, i) => {
        expr.push(i, color);
    });
    expr.push(FALLBACK_COLOR);
    return expr as maplibregl.ExpressionSpecification;
}

export default function InfrastructureLegend() {
    const [showBikePathBuildings, setShowBikePathBuildings] = useState(true);
    const [showComponents, setShowComponents] = useState(false);
    const [loadingComponents, setLoadingComponents] = useState(false);
    const { map, city } = useMap();
    const abortRef = useRef<AbortController | null>(null);

    useEffect(() => {
        if (!map || !map.getLayer(BUILDINGS_LAYER_ID)) return;
        const targetColor = showBikePathBuildings ? '#027A76' : '#ead5c5';
        map.setPaintProperty(BUILDINGS_LAYER_ID, 'fill-color', targetColor);

        return () => {
            if (map.getLayer(BUILDINGS_LAYER_ID)) {
                map.setPaintProperty(BUILDINGS_LAYER_ID, 'fill-color', '#ead5c5');
            }
        };
    }, [map, showBikePathBuildings]);

    useEffect(() => {
        if (!map || !city) return;

        if (!showComponents) {
            // Remove components layer/source and restore bike-paths
            if (map.getLayer(COMPONENTS_LAYER_ID)) map.removeLayer(COMPONENTS_LAYER_ID);
            if (map.getSource(COMPONENTS_SOURCE_ID)) map.removeSource(COMPONENTS_SOURCE_ID);
            if (map.getLayer(BIKE_PATHS_LAYER_ID)) {
                map.setLayoutProperty(BIKE_PATHS_LAYER_ID, 'visibility', 'visible');
            }
            return;
        }

        // Fetch and render components
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        setLoadingComponents(true);

        fetchInfraComponents(city.id)
            .then(geojson => {
                if (controller.signal.aborted || !map) return;

                // Hide the flat bike-paths layer
                if (map.getLayer(BIKE_PATHS_LAYER_ID)) {
                    map.setLayoutProperty(BIKE_PATHS_LAYER_ID, 'visibility', 'none');
                }

                // Add source + layer (or update if already present)
                if (map.getSource(COMPONENTS_SOURCE_ID)) {
                    (map.getSource(COMPONENTS_SOURCE_ID) as maplibregl.GeoJSONSource).setData(geojson as any);
                } else {
                    map.addSource(COMPONENTS_SOURCE_ID, { type: 'geojson', data: geojson as any });
                }

                if (!map.getLayer(COMPONENTS_LAYER_ID)) {
                    map.addLayer({
                        id: COMPONENTS_LAYER_ID,
                        type: 'line',
                        source: COMPONENTS_SOURCE_ID,
                        layout: { 'line-cap': 'round', 'line-join': 'round' },
                        paint: {
                            'line-color': buildColorExpression(),
                            'line-width': 2.5,
                            'line-opacity': 0.9,
                        },
                    });
                }
                setLoadingComponents(false);
            })
            .catch(err => {
                if (err.name !== 'AbortError') {
                    console.error('InfrastructureLegend: failed to load components', err);
                    setLoadingComponents(false);
                    setShowComponents(false);
                }
            });

        return () => {
            controller.abort();
            if (map.getLayer(COMPONENTS_LAYER_ID)) map.removeLayer(COMPONENTS_LAYER_ID);
            if (map.getSource(COMPONENTS_SOURCE_ID)) map.removeSource(COMPONENTS_SOURCE_ID);
            if (map.getLayer(BIKE_PATHS_LAYER_ID)) {
                map.setLayoutProperty(BIKE_PATHS_LAYER_ID, 'visibility', 'visible');
            }
        };
    }, [map, city, showComponents]);

    const componentsDots = (
        <div className="flex gap-0.5 items-center">
            {COMPONENT_COLORS.slice(0, 5).map((color, i) => (
                <div key={i} className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
            ))}
        </div>
    );

    return (
        <div className="flex flex-col gap-y-2.5">
            {!showComponents && <LegendItem type="line" color="#00cac3" label="Carril Bici" />}
            <LegendItem
                type="custom"
                color=""
                label={loadingComponents ? 'Cargando…' : 'Componentes conectados'}
                isInteractable
                isActive={showComponents}
                onToggle={() => !loadingComponents && setShowComponents(v => !v)}
            >
                {componentsDots}
            </LegendItem>
            <LegendItem
                type="square"
                color="#027A76"
                label="Edificios < 150m"
                isInteractable
                isActive={showBikePathBuildings}
                onToggle={() => setShowBikePathBuildings(v => !v)}
            />
        </div>
    );
}
