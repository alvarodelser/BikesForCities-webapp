import React, { useEffect, useState, useMemo } from 'react';
import BarHistogram from './BarHistogram';
import { fetchStations, type StationData } from '../../../services/api';

interface StationHistogramsProps {
  cityId: number;
}

function niceStep(range: number, numBins: number): number {
  const raw = range / numBins;
  const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
  const steps = [1, 2, 5, 10];
  return magnitude * steps.find(s => s * magnitude >= raw)!;
}

/** Build histogram bins from a numeric array with rounded, readable boundaries. */
function buildBins(values: number[], numBins = 6): { label: string; value: number }[] {
  if (values.length === 0) return [];

  const max = Math.max(...values);
  if (max === 0) return [{ label: '0', value: values.length }];

  const step = niceStep(max, numBins);
  const binCount = Math.ceil(max / step);
  const counts = Array<number>(binCount).fill(0);

  for (const v of values) {
    const idx = Math.min(Math.floor(v / step), binCount - 1);
    counts[idx]++;
  }

  return counts.map((count, i) => {
    const lo = i * step;
    const hi = lo + step;
    const fmt = (n: number) => n >= 1000 ? `${n / 1000}k` : String(n);
    return { label: `${fmt(lo)}–${fmt(hi)}`, value: count };
  }).filter(b => b.value > 0);
}

export const StationHistograms: React.FC<StationHistogramsProps> = ({ cityId }) => {
  const [stations, setStations] = useState<StationData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchStations(cityId)
      .then(data => {
        if (cancelled) return;
        setStations(data);
        setLoading(false);
      })
      .catch(err => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Error al cargar las estaciones');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [cityId]);

  const tripsData = useMemo(() => {
    const values = stations
      .map(s => s.estimated_monthly_trips)
      .filter((v): v is number => v != null);
    return buildBins(values, 10);
  }, [stations]);

  const buildingData = useMemo(() => {
    const values = stations
      .map(s => s.building_count)
      .filter((v): v is number => v != null);
    return buildBins(values, 10);
  }, [stations]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4">
        {[0, 1].map(i => (
          <div
            key={i}
            className="rounded-2xl border border-black/[0.06] bg-white/40 animate-pulse"
            style={{ height: '200px' }}
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-500 text-sm py-4 text-center">{error}</div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      <BarHistogram
        data={tripsData}
        accent="#ffa585"
        title="Trayectos por estación"
        subtitle="Viajes estimados / mes"
        yUnit="estaciones"
        gradient
        helpContent={
          <>
            <p><span className="inline-flex px-1.5 py-px rounded-full text-[7.5px] font-black uppercase tracking-widest text-black/35 bg-black/[0.045] border border-black/[0.07] mr-1.5 align-middle">QUÉ VES</span>La distribución de las estaciones según su volumen de trayectos mensuales estimados, agrupadas en rangos.</p>
            <p><span className="inline-flex px-1.5 py-px rounded-full text-[7.5px] font-black uppercase tracking-widest text-black/35 bg-black/[0.045] border border-black/[0.07] mr-1.5 align-middle">POR QUÉ IMPORTA</span>Revela si la demanda está concentrada en unas pocas estaciones o bien repartida. Una distribución muy sesgada indica desequilibrios estructurales de red que la redistribución de flota no puede resolver por sí sola.</p>
            <p><span className="inline-flex px-1.5 py-px rounded-full text-[7.5px] font-black uppercase tracking-widest text-black/35 bg-black/[0.045] border border-black/[0.07] mr-1.5 align-middle">METODOLOGÍA</span>Se agregan los viajes por estación de origen y destino. El período activo en el selector de rango determina qué meses se incluyen en la agregación.</p>
          </>
        }
      />
      <BarHistogram
        data={buildingData}
        accent="#6b8cae"
        title="Entorno construido"
        subtitle="Edificios en 150m (recuento)"
        yUnit="estaciones"
        gradient
        helpContent={
          <>
            <p><span className="inline-flex px-1.5 py-px rounded-full text-[7.5px] font-black uppercase tracking-widest text-black/35 bg-black/[0.045] border border-black/[0.07] mr-1.5 align-middle">QUÉ VES</span>La distribución de las estaciones según cuántos edificios tienen en su radio inmediato de 150 metros.</p>
            <p><span className="inline-flex px-1.5 py-px rounded-full text-[7.5px] font-black uppercase tracking-widest text-black/35 bg-black/[0.045] border border-black/[0.07] mr-1.5 align-middle">POR QUÉ IMPORTA</span>Una estación rodeada de pocos edificios tiene demanda estructuralmente baja, independientemente de cómo funcione el servicio. Este gráfico muestra si la red está bien posicionada donde vive y trabaja la gente.</p>
            <p><span className="inline-flex px-1.5 py-px rounded-full text-[7.5px] font-black uppercase tracking-widest text-black/35 bg-black/[0.045] border border-black/[0.07] mr-1.5 align-middle">METODOLOGÍA</span>Para cada estación se cuenta el número de polígonos de edificio dentro de un radio de 150 metros usando datos de catastro o equivalente OSM. Las estaciones con menos de 5 edificios en ese radio se consideran fuera del tejido urbano consolidado.</p>
          </>
        }
      />
    </div>
  );
};

export default StationHistograms;
