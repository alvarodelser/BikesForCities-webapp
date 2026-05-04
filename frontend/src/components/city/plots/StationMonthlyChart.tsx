import React, { useEffect, useState } from 'react';
import LineAreaChart from './LineAreaChart';
import { fetchStationMonthly, type StationMonthlyPoint } from '../../../services/api';

interface StationMonthlyChartProps {
  cityId: number;
  theme?: 'light' | 'dark';
}

export const StationMonthlyChart: React.FC<StationMonthlyChartProps> = ({ cityId, theme = 'light' }) => {
  const [data, setData] = useState<StationMonthlyPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchStationMonthly(cityId)
      .then(rows => {
        if (cancelled) return;
        setData(rows);
        setLoading(false);
      })
      .catch(err => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to fetch station monthly data');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [cityId]);

  // Check whether any row has actual_trips populated
  const hasActualTrips = data.some(d => d.actual_trips != null);

  // Normalise to Record<string, unknown>[] as required by LineAreaChart
  const chartData: Record<string, unknown>[] = data.map(d => ({
    month: d.month ?? '',
    estimated_trips: d.estimated_trips,
    actual_trips: d.actual_trips,
    active_stations: d.active_stations,
  }));

  const series = [
    {
      key: 'estimated_trips',
      label: 'Viajes estimados',
      color: '#ffa585',
      type: 'area' as const,
      axis: 'primary' as const,
    },
    ...(hasActualTrips
      ? [
          {
            key: 'actual_trips',
            label: 'Viajes reales',
            color: '#bc556f',
            type: 'line' as const,
            axis: 'primary' as const,
            dashed: true,
          },
        ]
      : []),
    {
      key: 'active_stations',
      label: 'Estaciones activas',
      color: '#d4a0b0',
      type: 'line' as const,
      axis: 'secondary' as const,
    },
  ];

  if (loading) {
    return (
      <div
        className="rounded-2xl border border-black/[0.06] bg-white/40 w-full animate-pulse"
        style={{ height: '220px' }}
      />
    );
  }

  if (error) {
    return (
      <div className="w-full h-[300px] flex items-center justify-center text-red-500 text-sm">
        {error}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="w-full h-[300px] flex items-center justify-center text-gray-400 text-sm">
        Sin datos mensuales disponibles
      </div>
    );
  }

  return (
    <LineAreaChart
      data={chartData}
      xKey="month"
      series={series}
      title="Evolución mensual"
      subtitle="Viajes estimados y estaciones activas por mes"
      theme={theme}
      helpContent={
        <p>
          Evolución mes a mes de los viajes estimados y las estaciones activas del servicio.
          El área representa los viajes estimados (eje izquierdo) y la línea las estaciones operativas (eje derecho),
          permitiendo ver si la demanda crece en paralelo a la expansión de la red.
        </p>
      }
    />
  );
};

export default StationMonthlyChart;
