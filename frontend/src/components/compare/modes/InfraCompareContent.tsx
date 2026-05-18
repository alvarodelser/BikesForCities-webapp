import { useState, useEffect } from 'react';
import type { CityData } from '../../../constants/cities';
import type { InfraStats } from '../../../services/api';
import { fetchInfraStats } from '../../../services/api';
import { formatDistance, formatPercentage } from '../../../utils/formatters';
import StaticCityMap from '../StaticCityMap';
import CompareGroupedHistogram from '../CompareGroupedHistogram';

const SLOT_COLORS = ['rgb(225,172,85)', 'rgb(175,71,73)'];
const CHART_COLORS = ['rgba(225,172,85,0.9)', 'rgba(175,71,73,0.9)'];

interface InfraCompareContentProps {
    selectedCities: CityData[];
}

export default function InfraCompareContent({ selectedCities }: InfraCompareContentProps) {
    const [infraMap, setInfraMap] = useState<Record<number, InfraStats | null>>({});

    useEffect(() => {
        selectedCities.forEach(city => {
            if (!city.id || city.id in infraMap) return;
            fetchInfraStats(city.id)
                .then(s => setInfraMap(prev => ({ ...prev, [city.id!]: s })))
                .catch(() => setInfraMap(prev => ({ ...prev, [city.id!]: null })));
        });
    }, [selectedCities]);

    return (
        <div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {[0, 1].map(idx => {
                    const city = selectedCities[idx];
                    const cityColor = SLOT_COLORS[idx];

                    if (!city) {
                        return (
                            <div key={idx}>
                                <div
                                    className="relative w-full overflow-hidden rounded-2xl flex flex-col items-center justify-center"
                                    style={{
                                        aspectRatio: '1 / 1',
                                        border: '2px solid rgba(255,255,255,0.08)',
                                        backgroundColor: 'rgba(255,255,255,0.03)',
                                    }}
                                >
                                    <div className="w-12 h-12 rounded-full bg-white/5 border border-white/[0.08] flex items-center justify-center">
                                        <span className="text-white/20 text-xl font-bold">{idx + 1}</span>
                                    </div>
                                    <p className="text-white/20 text-xs uppercase tracking-widest font-bold mt-3">Sin selección</p>
                                </div>
                            </div>
                        );
                    }

                    const infra = city.id != null ? infraMap[city.id] : undefined;
                    const metrics = [
                        { label: 'Red',       value: infra?.total_km != null ? `${formatDistance(infra.total_km)} km`    : '—' },
                        { label: 'Cobertura', value: infra?.coverage  != null ? `${formatPercentage(infra.coverage)}%`   : '—' },
                        { label: 'km GCC',    value: infra?.gcc_km    != null ? `${formatDistance(infra.gcc_km)} km`     : '—' },
                    ];

                    return (
                        <div key={idx}>
                            <div
                                className="relative w-full overflow-hidden rounded-2xl"
                                style={{ aspectRatio: '1 / 1', border: `2px solid ${cityColor}` }}
                            >
                                <div className="absolute inset-0">
                                    <StaticCityMap city={city} mode="infrastructure" />
                                </div>

                                {/* Metrics — top right, no city name */}
                                <div
                                    className="absolute top-3 right-3 z-10 rounded-xl px-3 py-2.5 backdrop-blur-md"
                                    style={{
                                        backgroundColor: 'rgba(255, 255, 255, 0.10)',
                                        border: '1px solid rgba(255, 255, 255, 0.18)',
                                        borderRight: `3px solid ${cityColor}`,
                                    }}
                                >
                                    <div className="grid grid-cols-3 gap-x-3 gap-y-1.5">
                                        {metrics.map((m, mi) => (
                                            <div key={mi}>
                                                <span className="text-[#003849]/60 text-[9px] uppercase tracking-wider block leading-none mb-0.5">{m.label}</span>
                                                <span className="text-[#003849] text-sm font-bold leading-none">{m.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* City name below map */}
                            <div className="flex items-center gap-1.5 mt-2 px-1">
                                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cityColor }} />
                                <span className="text-white/70 text-sm font-semibold">{city.name}</span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {selectedCities.length > 0 && (
                <CompareGroupedHistogram
                    cities={selectedCities}
                    colors={CHART_COLORS.slice(0, selectedCities.length)}
                />
            )}
        </div>
    );
}
