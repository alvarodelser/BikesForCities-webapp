import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import type { CityData } from '../../constants/cities';
import { getModeStats } from '../../constants/cityStats';
import { useMapState } from '../../hooks/useMapState';
import { useViewport } from '../../hooks/useViewport';
import MapFilters from './MapFilters';
import CityMap from './CityMap';
import CityStats from './CityStats';
import DualPanel from './DualPanel';
import backgroundTexture from '../../assets/background2.svg';
import { Users, Euro, Bike, Percent } from 'lucide-react';
import GlassCard from '../ui/GlassCard';
import { formatPopulation, formatDistance, formatPercentage, formatCurrency } from '../../utils/formatters';

import { MAP_MODES, type MapMode } from '../../constants/mapModes';

const modeNames: Record<string, string> = {
    [MAP_MODES.INFRASTRUCTURE]: 'Infraestructura',
    [MAP_MODES.TRAFFIC]: 'Tráfico',
    [MAP_MODES.STATIONS]: 'Estaciones',
    [MAP_MODES.TERRAIN]: 'Terreno',
    [MAP_MODES.INTERSECTIONS]: 'Intersecciones',
    [MAP_MODES.ACCIDENTS]: 'Accidentes',
};

const modeColors: Record<string, string> = {
    [MAP_MODES.INFRASTRUCTURE]: 'var(--blue)',
    [MAP_MODES.TRAFFIC]: 'var(--red)',
    [MAP_MODES.STATIONS]: 'var(--green)',
    [MAP_MODES.TERRAIN]: 'var(--orange)',
    [MAP_MODES.INTERSECTIONS]: 'var(--yellow)',
    [MAP_MODES.ACCIDENTS]: 'var(--red)',
};

interface MapDesktopProps {
    city: CityData;
}

/** Hero header used in both single-column and dual-panel layouts */
function CityHero({ city, selectedColor }: { city: CityData, selectedColor: string }) {
    return (
        <section
            className="relative w-full pt-36 pb-16 px-[var(--space-gutter)] overflow-hidden bg-[var(--cream)]"
        >
            {/* Radial glow */}
            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                    background:
                        'radial-gradient(ellipse 70% 50% at 40% 50%, rgba(146,190,201,0.18) 0%, transparent 70%)',
                }}
            />
            {/* Texture */}
            <div
                className="absolute inset-0 pointer-events-none opacity-[0.04]"
                style={{
                    backgroundImage: `url(${backgroundTexture})`,
                    backgroundSize: '600px 600px',
                }}
            />
            <div className="relative z-10">
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-[var(--blue)] opacity-70 mb-3">
                    Análisis de movilidad ciclista
                </p>
                <h1
                    className="text-5xl md:text-6xl font-bold text-[var(--blue-dark)] mb-2 leading-tight"
                    style={{ fontFamily: 'var(--heading)' }}
                >
                    {city.name}
                </h1>
                {city.altName && (
                    <p className="text-2xl md:text-3xl font-semibold text-[var(--blue)] opacity-60 mb-8 italic">
                        {city.altName}
                    </p>
                )}
                {!city.altName && <div className="mb-8" />}

                {/* Quick stats row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { icon: Users, label: 'Población', value: formatPopulation(city.population), gradient: 'from-[var(--green)] to-[var(--green-dark)]' },
                        { icon: Euro, label: 'Presupuesto', value: formatCurrency(city.budget), gradient: 'from-[var(--yellow)] to-[var(--orange)]' },
                        { icon: Bike, label: 'Red Ciclista', value: `${formatDistance(city.cyclingNetwork)} km`, gradient: 'from-[var(--green)] to-[var(--green-dark)]' },
                        { icon: Percent, label: 'Cobertura', value: `${formatPercentage(city.coverage)}%`, gradient: 'from-[var(--yellow)] to-[var(--orange)]' },
                    ].map(({ icon: Icon, label, value, gradient }) => (
                        <GlassCard
                            key={label}
                            surface="glass"
                            tint="rgba(0,0,0,0.03)"
                            className="p-4 flex items-center gap-3 border border-black/5"
                        >
                            <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center shadow-md flex-shrink-0`}>
                                <Icon className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <p className="text-[10px] uppercase tracking-widest text-[var(--blue)] font-bold opacity-70">{label}</p>
                                <p className="text-lg font-bold text-[var(--blue-dark)] leading-tight">{value}</p>
                            </div>
                        </GlassCard>
                    ))}
                </div>
            </div>

            {/* Wave bottom edge */}
            <div className="absolute bottom-0 left-0 right-0 h-10 pointer-events-none">
                <svg viewBox="0 0 1440 40" className="w-full h-full" preserveAspectRatio="none">
                    <path d="M0,20 C360,40 1080,0 1440,20 L1440,40 L0,40 Z" fill={selectedColor} style={{ transition: 'fill 0.3s ease' }} />
                </svg>
            </div>
        </section>
    );
}

const MapDesktop: React.FC<MapDesktopProps> = ({ city }) => {
    const { mode, setMode } = useMapState();
    const { isUltrawide } = useViewport();
    const [, setSearchParams] = useSearchParams();
    const [selectedEdgeId, setSelectedEdgeId] = useState<number | null>(null);

    const isModeAvailable = (m: MapMode | string | null): boolean => {
        if (!m) return false;
        if (m === MAP_MODES.INFRASTRUCTURE || m === MAP_MODES.TRAFFIC) return true;
        if (!modeNames[m]) return false;
        if (city.available_modes) return city.available_modes[m] === true;
        if (m === MAP_MODES.STATIONS) return (city.stations_count || 0) > 0;
        return false;
    };

    // Redirect to infrastructure if the mode param is invalid for this city
    useEffect(() => {
        if (!isModeAvailable(mode)) {
            setSearchParams(
                prev => {
                    const next = new URLSearchParams(prev);
                    next.set('mode', MAP_MODES.INFRASTRUCTURE);
                    next.delete('submode');
                    return next;
                },
                { replace: true }
            );
        }
    }, [mode, city.id]);

    const selectedColor = modeColors[mode] || 'var(--blue)';
    const modeStats = getModeStats(mode, city);
    const modeName = modeNames[mode] || mode;
    const title = `Estadísticas de ${modeName}`;
    const subtitle = `Análisis detallado de datos de ${modeName.toLowerCase()} en ${city.name}`;

    const filtersEl = (
        <MapFilters
            city={city}
            selectedMode={mode}
            onModeChange={m => { setSelectedEdgeId(null); setMode(m); }}
            isModeAvailable={isModeAvailable}
            selectedEdgeId={selectedEdgeId}
        />
    );
    const mapEl = (
        <div className="h-[78vh] min-h-[560px] px-[var(--space-gutter)]">
            <CityMap city={city} selectedColor={selectedColor} onEdgeSelect={setSelectedEdgeId} />
        </div>
    );
    const statsEl = (
        <div className="px-[var(--space-gutter)] py-10">
            <CityStats city={city} title={title} subtitle={subtitle} modeStats={modeStats} theme="dark" />
        </div>
    );

    // ── Desktop Layouts (768px+) ──────────────────────────────────────────────
    return (
        <div className="w-full min-h-screen transition-colors duration-300" style={{ backgroundColor: selectedColor }}>
            <CityHero city={city} selectedColor={selectedColor} />

            {isUltrawide ? (
                /* Ultrawide C1: map 50% left, scrollable stats 50% right */
                <DualPanel leftRatio={0.5}>
                    <DualPanel.Left>
                        <div className="sticky top-0 h-screen px-[var(--space-gutter)] pb-6">
                            <CityMap city={city} selectedColor={selectedColor} onEdgeSelect={setSelectedEdgeId} />
                        </div>
                    </DualPanel.Left>
                    <DualPanel.Right>
                        <div className="overflow-y-auto max-h-screen px-[var(--space-gutter)] py-6">
                            {/* Filters at top of right column */}
                            <div className="mb-8">
                                {filtersEl}
                            </div>
                            <CityStats city={city} title={title} subtitle={subtitle} modeStats={modeStats} theme="dark" />
                        </div>
                    </DualPanel.Right>
                </DualPanel>
            ) : (
                /* Standard desktop B1: linear scroll with filters above */
                <>
                    <div className="px-[var(--space-gutter)] pt-8 pb-4">
                        {filtersEl}
                    </div>
                    {mapEl}
                    {statsEl}
                </>
            )}
        </div>
    );
};

export default MapDesktop;
