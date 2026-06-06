import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import type { CityData } from '../../constants/cities';
import { useMapState } from '../../hooks/useMapState';
import { useViewport } from '../../hooks/useViewport';
import MapFilters from './MapFilters';
import CityMap from './CityMap';
import ModeStatsRouter from './ModeStatsRouter';
import DualPanel from './DualPanel';
import backgroundTexture from '../../assets/background2.svg';
import { Users, Euro, Bike, Percent } from 'lucide-react';
import GlassCard from '../ui/GlassCard';
import { formatPopulation, formatDistance, formatPercentage, formatCurrency } from '../../utils/formatters';
import { fetchInfraStats, fetchCityBudgets, fetchCityContext } from '../../services/api';
import type { InfraStats, BudgetYear, MayorTerm } from '../../services/api';
import BudgetSunburst from './plots/BudgetSunburst';
import TransparencyStats from './map/modes/transparency/TransparencyStats';
import { buildSunburstTree } from '../../utils/budget';

import { MAP_MODES, type MapMode } from '../../constants/mapModes';

const modeNames: Record<string, string> = {
    [MAP_MODES.INFRASTRUCTURE]: 'Infraestructura',
    [MAP_MODES.TRAFFIC]: 'Modelo de Movilidad',
    [MAP_MODES.STATIONS]: 'Servicio Bici',
    [MAP_MODES.ACCIDENTS]: 'Accidentes',
    [MAP_MODES.TRANSPARENCY]: 'Transparencia',
};

const modeColors: Record<string, string> = {
    [MAP_MODES.INFRASTRUCTURE]: '#027A76',
    [MAP_MODES.TRAFFIC]: '#3A6C7F',
    [MAP_MODES.STATIONS]: '#ffa585',
    [MAP_MODES.ACCIDENTS]: 'var(--red)',
    [MAP_MODES.TRANSPARENCY]: '#3A6C7F',
};

const modeGradients: Partial<Record<string, { bg: string; wave: string }>> = {
    [MAP_MODES.INFRASTRUCTURE]: { bg: 'linear-gradient(160deg, #027A76 0%, #3A6C7F 100%)', wave: '#027A76' },
    [MAP_MODES.STATIONS]:       { bg: 'linear-gradient(160deg, #ffa585 0%, #bc556f 100%)', wave: '#ffa585' },
    [MAP_MODES.TRAFFIC]:        { bg: 'linear-gradient(160deg, #003849 0%, #4b749f 100%)', wave: '#003849' },
    [MAP_MODES.TRANSPARENCY]:   { bg: 'linear-gradient(160deg, #111827 0%, #374151 100%)', wave: '#111827' },
};

interface MapDesktopProps {
    city: CityData;
}

/** Hero header used in both single-column and dual-panel layouts */
function CityHero({ city, selectedColor, infraStats }: { city: CityData, selectedColor: string, infraStats: InfraStats | null }) {
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
                        { icon: Bike, label: 'Red Ciclista', value: infraStats?.total_km ? `${formatDistance(infraStats.total_km)} km` : '—', gradient: 'from-[var(--green)] to-[var(--green-dark)]' },
                        { icon: Percent, label: 'Cobertura', value: infraStats?.coverage != null ? `${formatPercentage(infraStats.coverage)}%` : '—', gradient: 'from-[var(--yellow)] to-[var(--orange)]' },
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
    const [infraStats, setInfraStats] = useState<InfraStats | null>(null);
    const [budgetYears, setBudgetYears] = useState<BudgetYear[]>([]);
    const [selectedYear, setSelectedYear] = useState<number>(0);
    const [budgetType, setBudgetType] = useState<'planned' | 'executed'>('planned');
    const [mayors, setMayors] = useState<MayorTerm[]>([]);

    useEffect(() => {
        if (!city.id) return;
        Promise.all([
            fetchInfraStats(city.id).catch(() => null),
            fetchCityBudgets(city.id).catch(() => [] as BudgetYear[]),
            fetchCityContext(city.id).catch(() => ({ mayors: [] as MayorTerm[], budget_year: null, budget_categories: {} })),
        ]).then(([infraResult, budgetsResult, contextResult]) => {
            setInfraStats(infraResult);
            setBudgetYears(budgetsResult);
            if (budgetsResult.length > 0) {
                setSelectedYear(budgetsResult[0].year);
            }
            setMayors(contextResult.mayors ?? []);
        });
    }, [city.id]);

    const isModeAvailable = useCallback((m: MapMode | string | null): boolean => {
        if (!m) return false;
        if (!modeNames[m]) return false;
        if (m === MAP_MODES.TRANSPARENCY) return budgetYears.length > 0;
        if (city.available_modes) return city.available_modes[m] === true;
        if (m === MAP_MODES.STATIONS) return (city.stations_count || 0) > 0;
        return false;
    }, [budgetYears, city.available_modes, city.stations_count]);

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
    }, [mode, city.id, isModeAvailable]);

    const selectedColor = modeColors[mode] || 'var(--blue)';

    const sunburstOverlay = mode === MAP_MODES.TRANSPARENCY && budgetYears.length > 0 && selectedYear > 0 ? (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <div className="pointer-events-auto w-[min(480px,90%)]">
                <BudgetSunburst
                    data={buildSunburstTree(budgetYears, selectedYear, budgetType)}
                    year={selectedYear}
                    budgetType={budgetType}
                    onBudgetTypeChange={setBudgetType}
                />
            </div>
        </div>
    ) : null;

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
        <div className="h-[78vh] min-h-[560px] px-[var(--space-gutter)] relative">
            <CityMap
                city={city}
                selectedColor={selectedColor}
                onEdgeSelect={setSelectedEdgeId}
                locked={mode === MAP_MODES.TRANSPARENCY}
            />
            {sunburstOverlay}
        </div>
    );
    const statsEl = mode === MAP_MODES.TRANSPARENCY
        ? (
            <div className="px-[var(--space-gutter)] py-10">
                <TransparencyStats
                    city={city}
                    budgetYears={budgetYears}
                    selectedYear={selectedYear}
                    onYearChange={setSelectedYear}
                    mayors={mayors}
                />
            </div>
        )
        : (
            <div className="px-[var(--space-gutter)] py-10">
                <ModeStatsRouter city={city} />
            </div>
        );

    const gradient = modeGradients[mode];
    const backgroundStyle = gradient
        ? { background: gradient.bg }
        : { backgroundColor: selectedColor };
    const waveColor = gradient?.wave ?? selectedColor;

    // ── Desktop Layouts (768px+) ──────────────────────────────────────────────
    return (
        <div className="w-full min-h-screen transition-colors duration-300" style={backgroundStyle}>
            <CityHero city={city} selectedColor={waveColor} infraStats={infraStats} />

            {isUltrawide ? (
                /* Ultrawide C1: map 50% left, scrollable stats 50% right */
                <DualPanel leftRatio={0.5}>
                    <DualPanel.Left>
                        <div className="sticky top-0 h-screen px-[var(--space-gutter)] pt-8 pb-6 relative">
                            <CityMap
                                city={city}
                                selectedColor={selectedColor}
                                onEdgeSelect={setSelectedEdgeId}
                                locked={mode === MAP_MODES.TRANSPARENCY}
                            />
                            {sunburstOverlay}
                        </div>
                    </DualPanel.Left>
                    <DualPanel.Right>
                        <div className="overflow-y-auto max-h-screen px-[var(--space-gutter)] pt-8 pb-6">
                            <div className="mb-8">
                                {filtersEl}
                            </div>
                            {mode === MAP_MODES.TRANSPARENCY
                                ? (
                                    <TransparencyStats
                                        city={city}
                                        budgetYears={budgetYears}
                                        selectedYear={selectedYear}
                                        onYearChange={setSelectedYear}
                                        mayors={mayors}
                                    />
                                )
                                : <ModeStatsRouter city={city} />
                            }
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
