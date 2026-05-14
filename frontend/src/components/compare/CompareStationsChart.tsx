import { useState, useEffect } from 'react';
import type { CityData } from '../../constants/cities';
import { fetchStationMonthly } from '../../services/api';
import LineAreaChart from '../city/plots/LineAreaChart';

interface CompareStationsChartProps {
    cities: CityData[];
    colors: string[];
}

export default function CompareStationsChart({ cities, colors }: CompareStationsChartProps) {
    const [datasets, setDatasets] = useState<({ month: string; trips: number }[] | null)[]>([]);

    const cityKey = cities.map(c => c.id).join(',');

    useEffect(() => {
        setDatasets(cities.map(() => null));
        cities.forEach((city, i) => {
            if (!city.id) {
                setDatasets(prev => { const n = [...prev]; n[i] = []; return n; });
                return;
            }
            fetchStationMonthly(city.id)
                .then(rows => {
                    const data = rows
                        .filter(r => r.month != null && (r.estimated_trips ?? 0) > 0)
                        .map(r => ({ month: r.month!, trips: r.estimated_trips ?? 0 }));
                    setDatasets(prev => { const n = [...prev]; n[i] = data; return n; });
                })
                .catch(() => setDatasets(prev => { const n = [...prev]; n[i] = []; return n; }));
        });
    }, [cityKey]);

    const loading = datasets.length < cities.length || datasets.some(d => d === null);

    if (loading) {
        return <div className="rounded-2xl border border-black/[0.06] bg-white/40 animate-pulse" style={{ height: 220 }} />;
    }

    // Merge by month (outer join)
    const allMonths = new Set<string>();
    datasets.forEach(d => d?.forEach(r => allMonths.add(r.month)));
    const sortedMonths = Array.from(allMonths).sort();

    if (sortedMonths.length === 0) {
        return (
            <div className="rounded-2xl border border-black/[0.06] bg-white/40 flex items-center justify-center" style={{ height: 160 }}>
                <p className="text-sm text-gray-400">Sin datos mensuales disponibles</p>
            </div>
        );
    }

    const mergedData = sortedMonths.map(month => {
        const row: Record<string, unknown> = { month };
        datasets.forEach((d, i) => {
            const pt = d?.find(r => r.month === month);
            row[`trips_${i}`] = pt?.trips ?? null;
        });
        return row;
    });

    const series = cities.map((city, i) => ({
        key: `trips_${i}`,
        label: city.name,
        color: colors[i],
        type: 'area' as const,
    }));

    return (
        <LineAreaChart
            data={mergedData}
            xKey="month"
            series={series}
            title="Viajes mensuales estimados"
            subtitle="Evolución comparada por ciudad"
        />
    );
}
