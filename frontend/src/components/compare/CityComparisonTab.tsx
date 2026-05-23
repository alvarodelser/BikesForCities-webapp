import { useState, useEffect } from 'react';
import type { CityData } from '../../constants/cities';
import type { CompareMode } from './StaticCityMap';
import InfraCompareContent from './modes/InfraCompareContent';
import StationsCompareContent from './modes/StationsCompareContent';
import TrafficCompareContent from './modes/TrafficCompareContent';
import GlassCard from '../ui/GlassCard';
import { Info, ArrowRight } from 'lucide-react';

interface CityComparisonTabProps {
    selectedCities: CityData[];
    mode: CompareMode;
}

// Keep visited mode components mounted to avoid refetching when switching modes
export default function CityComparisonTab({ selectedCities, mode }: CityComparisonTabProps) {
    const [visited, setVisited] = useState<Set<CompareMode>>(() => new Set([mode]));

    useEffect(() => {
        setVisited(prev => prev.has(mode) ? prev : new Set([...prev, mode]));
    }, [mode]);

    const handleGoToLeaderboard = (e: React.MouseEvent) => {
        e.preventDefault();
        // 1. Switch hash so MobileTabs captures it and activates the tab
        window.location.hash = 'tab=leaderboard';
        
        // 2. Smoothly scroll to the leaderboard section
        setTimeout(() => {
            const el = document.getElementById('leaderboard-section');
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 100);
    };

    if (selectedCities.length === 0) {
        return (
            <section className="py-16 px-6" style={{ backgroundColor: 'rgba(0,56,73,0.6)' }}>
                <div className="max-w-[var(--container-reading)] mx-auto text-center">
                    <GlassCard 
                        surface="glass" 
                        size="lg" 
                        className="flex flex-col items-center gap-6 py-12 px-8"
                        style={{ backgroundColor: 'rgba(255, 255, 255, 0.04)', borderColor: 'rgba(255, 255, 255, 0.12)' }}
                    >
                        <div className="w-16 h-16 rounded-full bg-white/5 border border-white/[0.08] flex items-center justify-center text-white/40 shadow-inner">
                            <Info size={32} />
                        </div>
                        <div className="flex flex-col gap-2">
                            <h2 className="text-2xl font-bold text-white tracking-tight" style={{ fontFamily: 'var(--heading)' }}>
                                No se ha seleccionado ninguna ciudad
                            </h2>
                            <p className="text-sm text-white/50 leading-relaxed max-w-md mx-auto">
                                Para ver la comparación visual de mapas, redes ciclistas, estaciones y datos de tráfico, primero debes seleccionar hasta 2 ciudades en la clasificación.
                            </p>
                        </div>
                        
                        <a
                            href="#tab=leaderboard"
                            onClick={handleGoToLeaderboard}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-[#003849] bg-[var(--green-light)] hover:bg-[var(--green-light)]/90 transition-all shadow-lg hover:scale-[1.02] active:scale-[0.98]"
                        >
                            <span>Ir a la Clasificación</span>
                            <ArrowRight size={16} />
                        </a>
                    </GlassCard>
                </div>
            </section>
        );
    }

    return (
        <section className="py-16 px-6" style={{ backgroundColor: 'rgba(0,56,73,0.6)' }}>
            <div className="max-w-[var(--container-max)] 3xl:max-w-none mx-auto">
                {visited.has('infrastructure') && (
                    <div style={{ display: mode === 'infrastructure' ? undefined : 'none' }}>
                        <InfraCompareContent selectedCities={selectedCities} />
                    </div>
                )}
                {visited.has('stations') && (
                    <div style={{ display: mode === 'stations' ? undefined : 'none' }}>
                        <StationsCompareContent selectedCities={selectedCities} />
                    </div>
                )}
                {visited.has('traffic') && (
                    <div style={{ display: mode === 'traffic' ? undefined : 'none' }}>
                        <TrafficCompareContent selectedCities={selectedCities} />
                    </div>
                )}
            </div>
        </section>
    );
}
