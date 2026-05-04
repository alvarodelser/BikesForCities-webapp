import React, { useState } from 'react';
import type { CityData } from '../../../../../constants/cities';
import { useAccidentsStats } from '../../../../../hooks/useAccidentsStats';
import MetricPill from '../../../pills/MetricPill';
import StackedBarMatrix from '../../../plots/StackedBarMatrix';
import BarHistogram from '../../../plots/BarHistogram';


export interface AccidentsStatsProps {
  city: CityData;
  onLayerToggle?: (layer: 'all' | 'bike') => void;
}

const SEVERITY_LABELS = ['Ileso', 'Leve', 'Grave', 'Fatal'];
const ACCENT = '#ef4444'; // Red for accidents

const AccidentsStats: React.FC<AccidentsStatsProps> = ({ city, onLayerToggle }) => {
  const {
    totalAccidents,
    cyclistAccidents,
    cyclistVehicleMatrix,
    pedestrianVehicleMatrix,
    epacWeatherBars,
    loading,
  } = useAccidentsStats(city.id ?? null);

  const [activeLayer, setActiveLayer] = useState<'all' | 'bike'>('all');

  function handleLayerToggle(layer: 'all' | 'bike') {
    setActiveLayer(layer);
    onLayerToggle?.(layer);
  }

  const fmt = (n: number) => (loading ? '—' : n.toLocaleString('es'));

  return (
    <div className="w-full flex flex-col gap-6">
      
      {/* ── Header with toggle ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-1">
        <div>
          <h2 className="text-2xl font-bold text-white">Siniestralidad Vial</h2>
        </div>

        <div className="flex items-center gap-1 bg-gray-100/50 p-1 rounded-xl border border-black/5">
          <button
            onClick={() => handleLayerToggle('all')}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center gap-2 ${
              activeLayer === 'all'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <div className={`w-2 h-2 rounded-full ${activeLayer === 'all' ? 'bg-gray-400' : 'bg-gray-200'}`} />
            TODOS ({fmt(totalAccidents)})
          </button>
          <button
            onClick={() => handleLayerToggle('bike')}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center gap-2 ${
              activeLayer === 'bike'
                ? 'bg-white text-red-600 shadow-sm'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <div className={`w-2 h-2 rounded-full ${activeLayer === 'bike' ? 'bg-red-500 animate-pulse' : 'bg-red-200'}`} />
            BICICLETA ({fmt(cyclistAccidents)})
          </button>
        </div>
      </div>

      {/* ── Stat pills ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MetricPill
          value={fmt(totalAccidents)}
          label="Total accidentes"
          accent={ACCENT}
          helpContent="Número total de accidentes registrados en el municipio para el último año disponible."
        />
        <MetricPill
          value={fmt(cyclistAccidents)}
          label="Accidentes con bici"
          accent={ACCENT}
          helpContent="Accidentes donde al menos un vehículo implicado era una bicicleta."
        />
        <MetricPill
          value={totalAccidents > 0 ? `${((cyclistAccidents / totalAccidents) * 100).toFixed(1)} %` : '—'}
          label="Incidencia ciclista"
          accent={ACCENT}
        />
        <MetricPill
          value={loading ? '—' : '2023'}
          label="Año de datos"
          accent="#6b7280"
        />
      </div>

      {/* ── Matrices ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StackedBarMatrix
          rows={cyclistVehicleMatrix}
          segmentLabels={SEVERITY_LABELS}
          title="Severidad ciclista"
          subtitle="Por tipo de vehículo implicado"
        />
        <StackedBarMatrix
          rows={pedestrianVehicleMatrix}
          segmentLabels={SEVERITY_LABELS}
          title="Severidad peatonal"
          subtitle="Por tipo de vehículo implicado"
        />
      </div>

      {/* ── History/Weather ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1">
        <BarHistogram
          data={epacWeatherBars}
          accent={ACCENT}
          title="Bicicleta: regular vs EPAC × seco vs lluvia"
          subtitle="EPAC: Proporción de bicicletas con asistencia eléctrica"
        />
      </div>
    </div>
  );
};

export default AccidentsStats;
