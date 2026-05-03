import React, { useEffect, useState } from 'react';
import LineAreaChart from './LineAreaChart';
import { fetchStationMonthly, type StationMonthlyPoint } from '../../../services/api';

interface StationMonthlyChartProps {
  cityId: number;
}

export const StationMonthlyChart: React.FC<StationMonthlyChartProps> = ({ cityId }) => {
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
      color: '#22c55e',
      type: 'area' as const,
      axis: 'primary' as const,
    },
    ...(hasActualTrips
      ? [
          {
            key: 'actual_trips',
            label: 'Viajes reales',
            color: '#15803d',
            type: 'line' as const,
            axis: 'primary' as const,
            dashed: true,
          },
        ]
      : []),
    {
      key: 'active_stations',
      label: 'Estaciones activas',
      color: '#9ca3af',
      type: 'line' as const,
      axis: 'secondary' as const,
    },
  ];

  if (loading) {
    return (
      <div className="w-full h-[300px] flex items-center justify-center text-gray-400 text-sm">
        Cargando...
      </div>
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
    />
  );
};

export default StationMonthlyChart;
