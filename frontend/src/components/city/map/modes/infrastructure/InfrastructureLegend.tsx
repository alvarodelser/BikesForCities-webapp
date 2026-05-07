import React, { useState, useEffect } from 'react';
import { useMap } from '../../MapContext';

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
const COVERAGE_SOURCE_ID = 'building-coverage-source';
const COVERAGE_LAYER_ID = 'building-coverage-layer';

const COMPONENT_COLORS = [
    '#00cac3',
    '#f59e0b',
    '#ef4444',
    '#8b5cf6',
    '#3b82f6',
    '#f97316',
    '#10b981',
    '#ec4899',
];
const FALLBACK_COLOR = '#9ca3af';

function buildColorExpression(): any {
    const expr: any[] = ['match', ['get', 'component_id']];
    COMPONENT_COLORS.forEach((color, i) => {
        expr.push(i, color);
    });
    expr.push(FALLBACK_COLOR);
    return expr as any;
}

// Mini multi-color square shown on the Edificios row when coverage is active
const CoverageColorSquare = ({ active }: { active: boolean }) => (
    <div className="w-3 h-3 rounded-sm shadow-sm overflow-hidden flex" style={{ opacity: active ? 1 : 0.3 }}>
        {COMPONENT_COLORS.slice(0, 4).map((c, i) => (
            <div key={i} className="flex-1 h-full" style={{ backgroundColor: c }} />
        ))}
    </div>
);


export default function InfrastructureLegend() {
    const [showBikePathBuildings, setShowBikePathBuildings] = useState(true);
    const [showCoverage, setShowCoverage] = useState(false);
    const { map, city } = useMap();

    // Buildings layer — controlled only by showBikePathBuildings
    useEffect(() => {
        if (!map || !map.getLayer(BUILDINGS_LAYER_ID)) return;
        map.setPaintProperty(BUILDINGS_LAYER_ID, 'fill-color', showBikePathBuildings ? '#027A76' : '#ead5c5');

        // Auto-close coverage when buildings are disabled
        if (!showBikePathBuildings && showCoverage) {
            setShowCoverage(false);
        }

        return () => {
            try {
                if (map.getLayer(BUILDINGS_LAYER_ID)) {
                    map.setPaintProperty(BUILDINGS_LAYER_ID, 'fill-color', '#ead5c5');
                }
            } catch { /* map may have been removed */ }
        };
    }, [map, showBikePathBuildings, showCoverage]);

    // Toggle building appearance between solid color and component-based coverage
    useEffect(() => {
        if (!map || !map.getLayer(BUILDINGS_LAYER_ID)) return;

        if (showCoverage && showBikePathBuildings) {
            // Apply component-based coloring
            map.setPaintProperty(BUILDINGS_LAYER_ID, 'fill-color', buildColorExpression() as any);
            map.setPaintProperty(BUILDINGS_LAYER_ID, 'fill-opacity', 1);
        } else {
            // Restore default appearance
            map.setPaintProperty(BUILDINGS_LAYER_ID, 'fill-color', showBikePathBuildings ? '#027A76' : '#ead5c5');
            map.setPaintProperty(BUILDINGS_LAYER_ID, 'fill-opacity', 1);
        }
    }, [map, showCoverage, showBikePathBuildings]);

    const coverageDisabled = !showBikePathBuildings;

    return (
        <div className="flex flex-col gap-y-2.5">

            <LegendItem type="line" color="#00cac3" label="Carril Bici" />

            <div className="flex flex-col gap-y-0.5">
                {/* Edificios row — square changes to multi-color when coverage is active */}
                <LegendItem
                    type="custom"
                    color=""
                    label="Edificios < 150m"
                    isInteractable
                    isActive={showBikePathBuildings}
                    onToggle={() => setShowBikePathBuildings(v => !v)}
                >
                    {showCoverage && showBikePathBuildings
                        ? <CoverageColorSquare active={true} />
                        : <div className="w-3 h-3 rounded-sm shadow-sm" style={{ backgroundColor: '#027A76', opacity: showBikePathBuildings ? 1 : 0.3 }} />
                    }
                </LegendItem>

                {/* Cobertura conectada — sub-option with L connector */}
                <div className="flex items-center gap-0 mt-0.5">
                    {/* L connector */}
                    <div className="ml-2 w-3.5 flex-shrink-0 self-stretch flex flex-col justify-center pb-0.5">
                        <div className="w-full h-3 border-l-[1.5px] border-b-[1.5px] border-black/15 rounded-bl-sm" />
                    </div>

                    {/* Sub-toggle */}
                    <div
                        className={`flex items-center justify-between flex-1 px-1.5 py-0.5 rounded-xl transition-all duration-300 ${
                            coverageDisabled
                                ? 'opacity-40 cursor-default'
                                : 'cursor-pointer hover:bg-black/5'
                        }`}
                        onClick={() => !coverageDisabled && setShowCoverage(v => !v)}
                    >
                        <span className={`text-[var(--text-xs)] font-medium transition-colors ${showCoverage ? 'text-black/70' : 'text-black/40'}`}>
                            Cobertura conectada
                        </span>
                        <div className={`w-7 h-3.5 rounded-full relative transition-colors duration-300 flex-shrink-0 ml-2 ${
                            showCoverage ? 'bg-teal-500 shadow-[0_0_8px_rgba(20,184,166,0.4)]' : 'bg-gray-300'
                        }`}>
                            <div className={`absolute top-0.5 w-2.5 h-2.5 bg-white rounded-full shadow-sm transition-all duration-300 ${
                                showCoverage ? 'left-4' : 'left-0.5'
                            }`} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
