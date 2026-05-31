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
        setError(err instanceof Error ? err.message : 'Error al cargar los datos mensuales de estaciones');
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
      helpContent={
        <>
          <p><strong>QUÉ VES</strong>: Dos series superpuestas: la evolución mes a mes de los trayectos estimados y el número de estaciones activas en el mismo período.</p>
          <p><strong>POR QUÉ IMPORTA</strong>: Las dos líneas juntas revelan la causa de cada variación. Si caen los viajes pero no las estaciones, el problema es de demanda o meteorología. Si caen las dos, es operativo — cierre de estaciones, reducción de flota —.</p>
          <p><strong>METODOLOGÍA</strong>: Los trayectos se agregan por mes de unlock a partir del log del sistema. Las estaciones activas se cuentan como las que tienen al menos un trayecto en el mes. Las dos series se normalizan sobre sus propios ejes para hacerlas visualmente comparables.</p>
        </>
      }
    />
  );
};

export default StationMonthlyChart;
