import { useState, useEffect } from 'react';
import type { CityData } from '../../constants/cities';
import type { CompareMode } from './StaticCityMap';
import InfraCompareContent from './modes/InfraCompareContent';
import StationsCompareContent from './modes/StationsCompareContent';
import TrafficCompareContent from './modes/TrafficCompareContent';

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
