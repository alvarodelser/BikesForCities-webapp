import { useState, useEffect } from 'react';
import type { CityData } from '../../constants/cities';
import { fetchEdgeBuildingCoverage } from '../../services/api';
import type { EdgeBuildingCoverageItem } from '../../services/api';

const BINS = [
    { shortLabel: 'No urb.',     subLabel: '0–10',    lo: 0,    hi: 11   },
    { shortLabel: 'Rural',       subLabel: '11–50',   lo: 11,   hi: 51   },
    { shortLabel: 'Ensanche',    subLabel: '51–200',  lo: 51,   hi: 201  },
    { shortLabel: 'Tejido urb.', subLabel: '201–1k',  lo: 201,  hi: 1001 },
    { shortLabel: 'Centro',      subLabel: '1k+',     lo: 1001, hi: null },
];

function computeBins(edges: EdgeBuildingCoverageItem[]): number[] {
    const totals = new Array<number>(BINS.length).fill(0);
    for (const { length_m, building_count } of edges) {
        if (length_m <= 0) continue;
        const bpkm = building_count / (length_m / 1000);
        const idx = BINS.findIndex(({ lo, hi }) => bpkm >= lo && (hi === null || bpkm < hi));
        if (idx >= 0) totals[idx] += length_m / 1000;
    }
    return totals.map(v => Math.round(v * 10) / 10);
}

function niceTicks(max: number): number[] {
    if (max <= 0) return [0];
    const raw = max / 3;
    const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = Math.ceil(raw / magnitude) * magnitude;
    const ticks: number[] = [];
    for (let v = 0; v <= max + step * 0.01; v += step) ticks.push(Math.round(v * 100) / 100);
    return ticks;
}

interface CompareGroupedHistogramProps {
    cities: CityData[];
    colors: string[];
}

export default function CompareGroupedHistogram({ cities, colors }: CompareGroupedHistogramProps) {
    const [datasets, setDatasets] = useState<(number[] | null)[]>([]);
    const [mounted, setMounted] = useState(false);

    const cityKey = cities.map(c => c.id).join(',');

    useEffect(() => {
        setDatasets(cities.map(() => null));
        setMounted(false);
        const t = setTimeout(() => setMounted(true), 80);

        cities.forEach((city, i) => {
            if (!city.id) {
                setDatasets(prev => { const n = [...prev]; n[i] = BINS.map(() => 0); return n; });
                return;
            }
            fetchEdgeBuildingCoverage(city.id)
                .then(edges => setDatasets(prev => { const n = [...prev]; n[i] = computeBins(edges); return n; }))
                .catch(() => setDatasets(prev => { const n = [...prev]; n[i] = BINS.map(() => 0); return n; }));
        });

        return () => clearTimeout(t);
    }, [cityKey]);

    const loading = datasets.length < cities.length || datasets.some(d => d === null);

    if (loading) {
        return <div className="rounded-2xl border border-black/[0.06] bg-white/40 animate-pulse" style={{ height: 220 }} />;
    }

    const allValues = datasets.flatMap(d => d ?? []);
    const maxValue = Math.max(...allValues, 0.001);
    const yTicks = niceTicks(maxValue);
    const yMax = yTicks[yTicks.length - 1] || maxValue;
    const BAR_HEIGHT = 200;

    return (
        <div
            className="rounded-2xl border border-black/[0.08] bg-white/80 backdrop-blur-sm p-5"
            style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}
        >
            {/* Header */}
            <div className="flex items-start justify-between mb-5 gap-4">
                <div>
                    <h3 className="text-sm font-bold text-gray-900">Efectividad de la red ciclista</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Km de carril por tipología según edificios cercanos (&lt;150 m)</p>
                </div>
                <div className="flex gap-4 shrink-0">
                    {cities.map((city, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: colors[i] }} />
                            <span className="text-xs font-medium text-gray-600">{city.name}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex gap-2">
                {/* Y axis */}
                <div className="flex flex-col-reverse justify-between items-end shrink-0" style={{ height: BAR_HEIGHT }}>
                    {yTicks.map(t => (
                        <span key={t} className="text-[9px] text-gray-400 tabular-nums">{t} km</span>
                    ))}
                </div>

                {/* Groups + grid */}
                <div className="flex-1 flex gap-4 relative">
                    {/* Grid lines */}
                    {yTicks.map(t => (
                        <div
                            key={t}
                            className="absolute left-0 right-0 border-t border-black/[0.06] pointer-events-none"
                            style={{ bottom: (t / yMax) * BAR_HEIGHT }}
                        />
                    ))}

                    {BINS.map((bin, binIdx) => (
                        <div key={binIdx} className="flex-1 flex flex-col">
                            {/* Bars side-by-side */}
                            <div className="flex items-end gap-0" style={{ height: BAR_HEIGHT }}>
                                {datasets.map((data, cityIdx) => {
                                    const value = data?.[binIdx] ?? 0;
                                    const barH = mounted
                                        ? Math.max((value / yMax) * BAR_HEIGHT, value > 0 ? 2 : 0)
                                        : 0;
                                    return (
                                        <div
                                            key={cityIdx}
                                            className="flex-1 rounded-t-sm"
                                            title={`${cities[cityIdx]?.name}: ${value} km`}
                                            style={{
                                                height: barH,
                                                backgroundColor: colors[cityIdx],
                                                opacity: 0.85,
                                                transition: `height 0.65s cubic-bezier(0.34,1.56,0.64,1) ${binIdx * 70 + cityIdx * 35}ms`,
                                            }}
                                        />
                                    );
                                })}
                            </div>
                            <span className="text-[10px] text-center text-gray-500 mt-1.5 font-medium leading-tight">{bin.shortLabel}</span>
                            <span className="text-[9px] text-center text-gray-300 leading-tight">{bin.subLabel}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
