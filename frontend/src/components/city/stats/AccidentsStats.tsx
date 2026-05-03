import React, { useState } from 'react';
import type { CityData } from '../../../constants/cities';
import { useAccidentsStats } from '../../../hooks/useAccidentsStats';
import MetricPill from '../pills/MetricPill';
import { StackedBarMatrix } from '../plots/StackedBarMatrix';
import { BarHistogram } from '../plots/BarHistogram';

export interface AccidentsStatsProps {
  city: CityData;
  onLayerToggle?: (layer: 'all' | 'bike') => void;
}

const SEVERITY_LABELS = ['Ileso', 'Leve', 'Grave', 'Fatal'];

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

  const fmt = (n: number) => (loading ? '—' : String(n));

  return (
    <div className="w-full flex flex-col gap-6 bg-red-900/80 rounded-2xl p-5 text-white">

      {/* Layer toggle */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => handleLayerToggle('all')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
            activeLayer === 'all'
              ? 'bg-gray-500/60 text-white'
              : 'bg-white/10 text-white/70 hover:bg-white/20'
          }`}
        >
          <span
            className={`inline-block w-3 h-3 rounded-full border-2 ${
              activeLayer === 'all' ? 'border-white bg-white' : 'border-white/60'
            }`}
          />
          Todos los accidentes ({fmt(totalAccidents)})
        </button>

        <button
          type="button"
          onClick={() => handleLayerToggle('bike')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
            activeLayer === 'bike'
              ? 'bg-red-500/60 text-white'
              : 'bg-white/10 text-white/70 hover:bg-white/20'
          }`}
        >
          <span
            className={`inline-block w-3 h-3 rounded-full border-2 ${
              activeLayer === 'bike' ? 'border-white bg-white' : 'border-white/60'
            }`}
          />
          Con bicicleta ({fmt(cyclistAccidents)})
        </button>
      </div>

      {/* Stat pills */}
      <div className="grid grid-cols-2 gap-4">
        <MetricPill
          size="main"
          value={fmt(totalAccidents)}
          label="Total accidentes"
        />
        <MetricPill
          size="main"
          value={fmt(cyclistAccidents)}
          label="Con bicicleta"
        />
      </div>

      {/* Matrices — 2-col grid */}
      <div className="grid grid-cols-2 gap-4">
        <StackedBarMatrix
          rows={cyclistVehicleMatrix}
          segmentLabels={SEVERITY_LABELS}
          title="Accidentes de ciclistas por tipo de vehículo"
        />
        <StackedBarMatrix
          rows={pedestrianVehicleMatrix}
          segmentLabels={SEVERITY_LABELS}
          title="Accidentes de peatones por tipo de vehículo"
        />
      </div>

      {/* EPAC × weather histogram — full width */}
      <BarHistogram
        data={epacWeatherBars}
        accent="#dc2626"
        title="Bicicleta: regular vs EPAC × seco vs lluvia"
        subtitle="EPAC: requiere datos de participantes por tipo de vehículo"
      />
    </div>
  );
};

export default AccidentsStats;
