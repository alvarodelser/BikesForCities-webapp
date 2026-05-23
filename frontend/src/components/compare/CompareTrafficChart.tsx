import { useState, useEffect } from 'react';
import type { CityData } from '../../constants/cities';
import { fetchRouteHistogram } from '../../services/api';

// Build readable % labels from fraction bin_edges
function toPercentLabel(v: number): string {
    return `${Math.round(v * 100)}%`;
}

function niceTicks(max: number): number[] {
    if (max <= 0) return [0];
    const raw = max / 3;
    const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = Math.ceil(raw / magnitude) * magnitude;
    const ticks: number[] = [];
    for (let v = 0; v <= max + step * 0.01; v += step) {
        ticks.push(Math.round(v));
    }
    if (ticks[ticks.length - 1] < max) {
        ticks.push(Math.round(ticks[ticks.length - 1] + step));
    }
    return ticks;
}

interface BinData { label: string; value: number }

interface CompareTrafficChartProps {
    cities: CityData[];
    colors: string[];
}

export default function CompareTrafficChart({ cities, colors }: CompareTrafficChartProps) {
    const [datasets, setDatasets] = useState<BinData[][]>([]);
    const [loading, setLoading] = useState(true);
    const [mounted, setMounted] = useState(false);
    const [binLabels, setBinLabels] = useState<string[]>([]);

    const cityKey = cities.map(c => c.id).join(',');

    useEffect(() => {
        let active = true;
        setLoading(true);
        setBinLabels([]);
        setMounted(false);
        const t = setTimeout(() => {
            if (active) setMounted(true);
        }, 80);

        const promises = cities.map(city => {
            if (!city.id) return Promise.resolve({ bins: [] as BinData[], labels: [] as string[] });
            return fetchRouteHistogram(city.id)
                .then(series => {
                    const s = series[0];
                    if (!s?.infra_fraction) return { bins: [] as BinData[], labels: [] as string[] };
                    const { bin_edges, counts } = s.infra_fraction;
                    const bins: BinData[] = counts.map((count, j) => ({
                        label: `${toPercentLabel(bin_edges[j])}–${toPercentLabel(bin_edges[j + 1])}`,
                        value: count,
                    }));
                    return { bins, labels: bins.map(b => b.label) };
                })
                .catch(() => ({ bins: [] as BinData[], labels: [] as string[] }));
        });

        Promise.all(promises).then(results => {
            if (active) {
                setDatasets(results.map(r => r.bins));
                const firstWithLabels = results.find(r => r.labels.length > 0);
                if (firstWithLabels) {
                    setBinLabels(firstWithLabels.labels);
                }
                setLoading(false);
            }
        });

        return () => {
            active = false;
            clearTimeout(t);
        };
    }, [cityKey]);

    if (loading) {
        return <div className="rounded-2xl border border-black/[0.06] bg-white/40 animate-pulse" style={{ height: 220 }} />;
    }

    const hasData = datasets.some(d => (d?.length ?? 0) > 0);
    if (!hasData) {
        return (
            <div className="rounded-2xl border border-black/[0.06] bg-white/40 flex items-center justify-center" style={{ height: 160 }}>
                <p className="text-sm text-gray-400">Sin datos de tráfico disponibles</p>
            </div>
        );
    }

    // Use the longer dataset's labels as X axis
    const labels = binLabels.length > 0 ? binLabels : (datasets.find(d => (d?.length ?? 0) > 0)?.map(b => b.label) ?? []);
    const nBins = labels.length;

    const allValues = datasets.flatMap(d => d?.map(b => b.value) ?? []);
    const maxValue = Math.max(...allValues, 1);
    const yTicks = niceTicks(maxValue);
    const yMax = yTicks[yTicks.length - 1] || maxValue;
    const BAR_HEIGHT = 140;

    return (
        <div
            className="rounded-2xl border border-black/[0.08] bg-white/80 backdrop-blur-sm p-5"
            style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}
        >
            <div className="flex items-start justify-between mb-5 gap-4">
                <div>
                    <h3 className="text-sm font-bold text-gray-900">Distribución de rutas por cobertura en carril bici</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Nº de rutas según fracción de km sobre infraestructura ciclista</p>
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
                <div className="flex flex-col-reverse justify-between items-end shrink-0" style={{ height: BAR_HEIGHT, paddingBottom: 0 }}>
                    {yTicks.map(t => (
                        <span key={t} className="text-[9px] text-gray-400 tabular-nums leading-none">{t}</span>
                    ))}
                </div>

                <div className="flex-1 flex flex-col">
                    {/* Chart area of fixed height */}
                    <div className="relative w-full" style={{ height: BAR_HEIGHT }}>
                        {/* Grid lines */}
                        {yTicks.map(t => (
                            <div
                                key={t}
                                className="absolute left-0 right-0 border-t border-black/[0.06] pointer-events-none"
                                style={{ bottom: (t / yMax) * BAR_HEIGHT }}
                            />
                        ))}

                        {/* Bars container */}
                        <div className="absolute inset-0 flex gap-1.5">
                            {Array.from({ length: nBins }, (_, binIdx) => (
                                <div key={binIdx} className="flex-1 flex items-end gap-0.5 h-full">
                                    {datasets.map((data, cityIdx) => {
                                        const value = data?.[binIdx]?.value ?? 0;
                                        const barH = mounted
                                            ? Math.max((value / yMax) * BAR_HEIGHT, value > 0 ? 2 : 0)
                                            : 0;
                                        return (
                                            <div
                                                key={cityIdx}
                                                className="flex-1 rounded-t-sm"
                                                title={`${cities[cityIdx]?.name}: ${value} rutas`}
                                                style={{
                                                    height: barH,
                                                    backgroundColor: colors[cityIdx],
                                                    opacity: 0.85,
                                                    transition: `height 0.65s cubic-bezier(0.34,1.56,0.64,1) ${binIdx * 50 + cityIdx * 25}ms`,
                                                }}
                                            />
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Labels below chart area */}
                    <div className="flex gap-1.5 mt-1.5">
                        {Array.from({ length: nBins }, (_, binIdx) => (
                            <div key={binIdx} className="flex-1 flex flex-col items-center">
                                <span className="text-[9px] text-center text-gray-400 leading-tight">{labels[binIdx]}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
