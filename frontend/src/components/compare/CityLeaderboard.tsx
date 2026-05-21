import React, { useEffect, useState, useMemo } from 'react';
import { 
  Network, 
  Car, 
  MapPin, 
  ArrowUp, 
  ArrowDown
} from 'lucide-react';
import type { CityData } from '../../constants/cities';
import { MAP_MODES, type MapMode } from '../../constants/mapModes';
import { formatPopulation, formatDistance, formatPercentage, formatServiceName } from '../../utils/formatters';
import { fetchCities } from '../../services/api';
import LoadingContainer from '../ui/LoadingContainer';
import ErrorContainer from '../ui/ErrorContainer';

interface CityLeaderboardProps {
  selectedCityPaths: string[];
  onToggleCity: (city: CityData) => void;
  activeMode: MapMode;
}

const MODE_META = [
  { id: MAP_MODES.INFRASTRUCTURE, name: 'Infraestructura', icon: Network, color: 'var(--blue)' },
  { id: MAP_MODES.STATIONS, name: 'Servicio Bici', icon: MapPin, color: 'var(--yellow)' },
  { id: MAP_MODES.TRAFFIC, name: 'Tráfico', icon: Car, color: 'var(--red)' },
] as const;

type SortKey = keyof CityData;
type SortDir = 'asc' | 'desc';

interface MetricConfig {
  key: SortKey;
  label: string;
  format: (val: any, city: CityData) => React.ReactNode;
}

const MODE_METRICS: Record<string, MetricConfig[]> = {
  [MAP_MODES.INFRASTRUCTURE]: [
    { key: 'coverage', label: 'Cobertura', format: v => v ? `${formatPercentage(v)}%` : '-' },
    { key: 'cyclingNetwork', label: 'Red (km)', format: v => v ? `${formatDistance(v)} km` : '-' },
  ],
  [MAP_MODES.STATIONS]: [
    { key: 'bicycles_count', label: 'Bicicletas', format: v => v ? formatPopulation(v) : '-' },
    { key: 'stations_count', label: 'Estaciones', format: v => v ? formatPopulation(v) : '-' },
    { key: 'station_coverage', label: 'Cobertura', format: v => v ? `${formatPercentage(v)}%` : '-' },
  ],
  [MAP_MODES.TRAFFIC]: [
    { key: 'monthly_trips', label: 'Viajes/mes', format: v => v ? formatPopulation(v) : '-' },
    { key: 'trips_per_inhabitant', label: 'Viajes/hab', format: v => v ? v.toFixed(2) : '-' },
  ],
};

const COMMON_METRICS: MetricConfig[] = [
  { key: 'population', label: 'Población', format: v => v ? formatPopulation(v) : '-' },
  { key: 'budget', label: 'Presupuesto', format: v => v ? `${formatPopulation(v)} €` : '-' },
];

const MAYOR_METRIC: MetricConfig = {
  key: 'mayor',
  label: 'Alcaldía',
  format: (v, city) => (
    <div className="flex flex-col items-end">
      <span className="whitespace-nowrap">{v || '-'}</span>
      {city.mayor_party && <span className="text-[10px] text-white/40 font-normal leading-tight">{city.mayor_party}</span>}
    </div>
  )
};

function sortCities(cities: CityData[], key: SortKey, dir: SortDir): CityData[] {
  return [...cities].sort((a, b) => {
    let va = a[key as keyof CityData];
    let vb = b[key as keyof CityData];
    if (va === undefined || va === null) return dir === 'asc' ? -1 : 1;
    if (vb === undefined || vb === null) return dir === 'asc' ? 1 : -1;
    if (typeof va === 'string' && typeof vb === 'string') {
      return dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    }
    return dir === 'asc' ? Number(va) - Number(vb) : Number(vb) - Number(va);
  });
}

const CityLeaderboard: React.FC<CityLeaderboardProps> = ({ selectedCityPaths, onToggleCity, activeMode }) => {
  const [cities, setCities] = useState<CityData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sortKey, setSortKey] = useState<SortKey>('coverage');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [width, setWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);

  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    fetchCities()
      .then((data) => {
        const enriched = data.map(city => ({
          ...city,
          trips_per_inhabitant: (city.monthly_trips && city.population) ? city.monthly_trips / city.population : 0
        }));
        setCities(enriched);
        setLoading(false);
      })
      .catch(() => {
        setError('Error al cargar las ciudades.');
        setLoading(false);
      });
  }, []);

  // Reset sort when external mode changes
  useEffect(() => {
    const firstMetric = MODE_METRICS[activeMode as string]?.[0]?.key;
    if (firstMetric) { setSortKey(firstMetric as SortKey); setSortDir('desc'); }
  }, [activeMode]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc'); // default new sort to descending since higher is usually better
    }
  };

  const metrics = useMemo(() => {
    let base = MODE_METRICS[activeMode as string] || MODE_METRICS[MAP_MODES.INFRASTRUCTURE];
    if (width > 1024) {
      base = [...base, ...COMMON_METRICS];
    }
    if (width > 1400) {
      base = [...base, MAYOR_METRIC];
    }
    return base;
  }, [activeMode, width]);

  const filteredCities = useMemo(() => {
    if (activeMode === MAP_MODES.STATIONS) return cities.filter(c => Boolean(c.available_modes?.stations));
    if (activeMode === MAP_MODES.TRAFFIC) return cities.filter(c => Boolean(c.available_modes?.traffic));
    if (activeMode === MAP_MODES.INFRASTRUCTURE) return cities.filter(c => Boolean(c.available_modes?.infrastructure));
    return cities;
  }, [cities, activeMode]);

  const sortedCities = useMemo(() => sortCities(filteredCities, sortKey, sortDir), [filteredCities, sortKey, sortDir]);

  if (loading) return <div className="flex justify-center py-16"><LoadingContainer /></div>;
  if (error) return <ErrorContainer title="Error de carga" message={error} />;

  const topCities = sortedCities.slice(0, 3);
  const activeColor = MODE_META.find(m => m.id === activeMode)?.color || 'var(--blue)';

  const renderPodiumCard = (city: CityData | undefined, rank: number) => {
    if (!city) return <div className="flex-1" />;
    
    const isFirst = rank === 1;
    const isSecond = rank === 2;
    
    const isSelected = selectedCityPaths.includes(city.path);

    const heightClass = isFirst ? 'h-72 md:h-80' : 'h-60 md:h-64';
    const rankColors = isFirst 
      ? 'from-yellow-400 to-yellow-600 shadow-yellow-500/20' 
      : isSecond 
        ? 'from-gray-300 to-gray-500 shadow-gray-500/20' 
        : 'from-amber-600 to-amber-800 shadow-amber-700/20';

    const primaryMetric = metrics.find(m => m.key === sortKey) || metrics[0];
    const secondaryMetrics = metrics.filter(m => m.key !== primaryMetric.key).slice(0, 2);

    return (
      <div 
        className={`relative rounded-t-xl flex flex-col justify-end p-4 transition-all duration-300 cursor-pointer ${heightClass} ${isSelected ? 'ring-2 ring-white scale-[1.02] z-20' : 'hover:scale-[1.01] hover:brightness-110 z-10'}`}
        onClick={() => onToggleCity(city)}
        style={{
          background: `linear-gradient(to top, rgba(255,255,255,0.08), rgba(255,255,255,0.02))`,
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)'
        }}
      >
        <div className={`absolute -top-5 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-gradient-to-br ${rankColors} flex items-center justify-center font-black text-lg text-white shadow-lg border-2 border-white/20 z-10`}>
          {rank}
        </div>
        <div className="flex flex-col items-center text-center mt-6">
          {activeMode === MAP_MODES.STATIONS && city.service_name ? (
            <>
              <span className="text-sm md:text-lg font-bold text-white leading-tight">
                {formatServiceName(city.service_name, city.name)}
              </span>
              <span className="text-[10px] md:text-xs font-medium text-white/60 mb-2">
                {city.name}
              </span>
            </>
          ) : (
            <>
              <span className="text-sm md:text-lg font-bold text-white leading-tight">{city.name}</span>
              {city.altName ? (
                <span className="text-[10px] md:text-xs font-medium text-white/60 italic mb-2">
                  {city.altName}
                </span>
              ) : (
                <div className="mb-2" />
              )}
            </>
          )}
          <span className="text-2xl md:text-4xl font-black text-white tracking-tight mb-4" style={{ color: activeColor }}>
            {primaryMetric.format(city[primaryMetric.key as keyof CityData], city)}
          </span>
          <div className="flex gap-4 text-xs text-white/60">
             {secondaryMetrics.map((m, i) => (
               <div key={i} className="flex flex-col items-center">
                 <span className="uppercase text-[9px] md:text-[10px] tracking-wider opacity-70 mb-1">{m.label}</span>
                 <span className="font-medium text-white/90">{m.format(city[m.key as keyof CityData], city)}</span>
               </div>
             ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full flex flex-col gap-12">
      
      {/* 1. Podium */}
      <div className="max-w-4xl mx-auto w-full px-4">
        <div className="flex items-end justify-center gap-2 md:gap-4 mt-8 h-80">
          <div className="w-1/3 max-w-[240px]">
            {renderPodiumCard(topCities[1], 2)}
          </div>
          <div className="w-1/3 max-w-[280px]">
            {renderPodiumCard(topCities[0], 1)}
          </div>
          <div className="w-1/3 max-w-[240px]">
            {renderPodiumCard(topCities[2], 3)}
          </div>
        </div>
        <div className="h-1 w-full rounded-full bg-white/10 mt-2" />
      </div>

      {/* 3. Full Rankings Table */}
      <div className="w-full overflow-x-hidden bg-black/10 rounded-2xl border border-white/5 backdrop-blur-sm p-0.5 md:p-1">
        <table className="w-full border-collapse text-left table-auto">
          <thead>
            <tr className="border-b border-white/10">
              <th className="py-4 px-2 md:py-5 md:px-6 text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-white/40 w-8 md:w-16 text-center">#</th>
              <th className="py-4 px-2 md:py-5 md:px-6 text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-white/40">Ciudad</th>
              {metrics.map(m => (
                  <th 
                    key={m.key} 
                    onClick={() => handleSort(m.key)}
                    className={`py-4 px-2 md:py-5 md:px-6 text-[9px] md:text-[10px] font-bold uppercase tracking-widest cursor-pointer transition-colors text-right select-none hover:text-white ${sortKey === m.key ? 'text-white' : 'text-white/40'}`}
                  >
                    <div className="flex items-center justify-end gap-1 md:gap-2">
                      {m.label}
                      {sortKey === m.key ? (
                        sortDir === 'desc' ? <ArrowDown size={12} className="text-white" /> : <ArrowUp size={12} className="text-white" />
                      ) : (
                        <ArrowDown size={12} className="opacity-0 group-hover:opacity-30" />
                      )}
                    </div>
                  </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedCities.map((city, idx) => {
              const isTop3 = idx < 3;
              const selectionIndex = selectedCityPaths.indexOf(city.path);
              const isSelected = selectionIndex !== -1;
              
              const getBg = () => {
                if (isSelected) {
                  return selectionIndex === 0
                    ? 'rgba(225, 172, 85, 0.45)'
                    : 'rgba(175, 71, 73, 0.45)';
                }
                return 'transparent';
              };

              return (
                <tr 
                  key={city.path} 
                  onClick={() => onToggleCity(city)}
                  style={{ backgroundColor: getBg() }}
                  className={`
                    border-b border-white/5 cursor-pointer transition-all duration-300
                    ${isSelected ? '' : 'hover:bg-white/[0.04]'}
                  `}
                >
                  <td className="py-3 px-2 md:py-4 md:px-6 text-center">
                    {isTop3 ? (
                      <span className={`inline-flex items-center justify-center w-5 h-5 md:w-6 md:h-6 rounded-full text-[10px] md:text-xs font-bold ${idx === 0 ? 'bg-yellow-500/20 text-yellow-400' : idx === 1 ? 'bg-gray-400/20 text-gray-300' : 'bg-amber-600/20 text-amber-500'}`}>
                        {idx + 1}
                      </span>
                    ) : (
                      <span className="text-white/30 text-[10px] md:text-xs font-medium">{idx + 1}</span>
                    )}
                  </td>
                  <td className={`py-3 px-2 md:py-4 md:px-6 font-medium flex items-center gap-1.5 md:gap-3 ${isTop3 ? 'text-white' : 'text-white/80'}`}>
                    {isSelected && (
                      <span
                        className="w-1 md:w-1.5 h-1 md:h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: selectionIndex === 0 ? 'rgb(225,172,85)' : 'rgb(175,71,73)' }}
                      />
                    )}
                    <div className="flex flex-col min-w-0">
                      {activeMode === MAP_MODES.STATIONS && city.service_name ? (
                        <>
                          <span className={`truncate text-xs md:text-sm ${isTop3 ? 'text-white' : 'text-white/80'}`}>
                            {formatServiceName(city.service_name, city.name)}
                          </span>
                          <span className="text-[9px] md:text-[10px] text-white/40 font-normal truncate">
                            {city.name}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className={`truncate text-xs md:text-sm ${isTop3 ? 'text-white' : 'text-white/80'}`}>{city.name}</span>
                          {city.altName && (
                            <span className="text-[9px] md:text-[10px] text-white/40 italic font-normal truncate">
                              {city.altName}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                  {metrics.map(m => (
                    <td 
                      key={m.key} 
                      className={`py-3 px-2 md:py-4 md:px-6 text-right tabular-nums text-[11px] md:text-sm ${sortKey === m.key ? 'text-white font-medium' : 'text-white/60'}`}
                    >
                      {m.format(city[m.key as keyof CityData], city)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255,255,255,0.03); border-radius: 20px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { 
          background: rgba(255,255,255,0.1); 
          border-radius: 20px; 
          transition: background 0.3s;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
      `}</style>
    </div>
  );
};

export default CityLeaderboard;
