import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router';
import type { CityData } from '../../constants/cities';
import { fetchCities } from '../../services/api';
import {
  formatPopulation,
  formatCurrency,
  formatDistance,
  formatPercentage,
} from '../../utils/formatters';
import { GlassCard } from '../ui/GlassCard';
import Spinner from '../ui/Spinner';
import ErrorState from '../ui/ErrorState';
import { 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  Network, 
  Car, 
  MapPin, 
  Mountain, 
  CircleDot, 
  TriangleAlert 
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type SortKey = keyof Pick<CityData, 'name' | 'population' | 'budget' | 'cyclingNetwork' | 'coverage'>;
type SortDir = 'asc' | 'desc';

interface Column {
  key: SortKey | 'model';
  label: string;
  render: (city: CityData, isSelected: boolean, selectionIndex: number) => React.ReactNode;
  align?: 'left' | 'right';
}

interface CityCompareTableProps {
  selectedCityPaths: string[];
  onToggleCity: (city: CityData) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DATA_MODES = [
  { id: 'infrastructure', name: 'Infraestructura', icon: Network, color: 'text-blue-400' },
  { id: 'traffic', name: 'Tráfico', icon: Car, color: 'text-red-400' },
  { id: 'stations', name: 'Estaciones', icon: MapPin, color: 'text-green-400' },
  { id: 'terrain', name: 'Terreno', icon: Mountain, color: 'text-orange-400' },
  { id: 'intersections', name: 'Intersecciones', icon: CircleDot, color: 'text-yellow-400' },
  { id: 'accidents', name: 'Accidentes', icon: TriangleAlert, color: 'text-red-500' },
];

// ─── Column definitions ───────────────────────────────────────────────────────

const COLUMNS: Column[] = [
  {
    key: 'name',
    label: 'Ciudad',
    align: 'left',
    render: (city) => (
      <Link
        to={city.path}
        onClick={(e) => e.stopPropagation()} // Allow clicking the link to navigate
        className="font-semibold text-white hover:text-[var(--green-light)] transition-colors duration-200"
      >
        {city.name}
      </Link>
    ),
  },
  {
    key: 'model',
    label: 'Datos/Modos',
    align: 'left',
    render: () => (
      <div className="flex items-center gap-1.5">
        {DATA_MODES.map((mode) => (
          <div 
            key={mode.id} 
            title={mode.name}
            className="p-1 rounded-md bg-white/5 hover:bg-white/15 transition-colors cursor-help group/mode"
          >
            <mode.icon size={13} className={`${mode.color} opacity-60 group-hover/mode:opacity-100 transition-opacity`} />
          </div>
        ))}
      </div>
    ),
  },
  {
    key: 'population',
    label: 'Población',
    align: 'right',
    render: (city) => (
      <span className="tabular-nums">{formatPopulation(city.population)}</span>
    ),
  },
  {
    key: 'budget',
    label: 'Presupuesto',
    align: 'right',
    render: (city) => (
      <span className="tabular-nums">{formatCurrency(city.budget)}</span>
    ),
  },
  {
    key: 'cyclingNetwork',
    label: 'Red Ciclista',
    align: 'right',
    render: (city) => (
      <span className="tabular-nums">{formatDistance(city.cyclingNetwork)} km</span>
    ),
  },
  {
    key: 'coverage',
    label: 'Cobertura',
    align: 'right',
    render: (city) => (
      <span className="tabular-nums">{formatPercentage(city.coverage)}%</span>
    ),
  },
];

const SORTABLE_COLS = new Set<SortKey>(['name', 'population', 'budget', 'cyclingNetwork', 'coverage']);

function sortCities(cities: CityData[], key: SortKey, dir: SortDir): CityData[] {
  return [...cities].sort((a, b) => {
    const va = a[key] ?? 0;
    const vb = b[key] ?? 0;
    if (typeof va === 'string' && typeof vb === 'string') {
      return dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    }
    const na = Number(va);
    const nb = Number(vb);
    return dir === 'asc' ? na - nb : nb - na;
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

const SortIcon: React.FC<{ col: SortKey | 'model'; activeCol: SortKey; dir: SortDir }> = ({
  col,
  activeCol,
  dir,
}) => {
  if (col === 'model' || !SORTABLE_COLS.has(col as SortKey)) return null;
  if (col !== activeCol) return <ArrowUpDown size={13} className="opacity-30 ml-1 inline" />;
  return dir === 'asc'
    ? <ArrowUp size={13} className="text-[var(--green-light)] ml-1 inline" />
    : <ArrowDown size={13} className="text-[var(--green-light)] ml-1 inline" />;
};

const CityCompareTable: React.FC<CityCompareTableProps> = ({ selectedCityPaths, onToggleCity }) => {
  const [cities, setCities] = useState<CityData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  useEffect(() => {
    fetchCities()
      .then((data) => {
        setCities(data);
        setLoading(false);
      })
      .catch(() => {
        setError('No se pudo cargar los datos de las ciudades.');
        setLoading(false);
      });
  }, []);

  const handleSort = useCallback(
    (key: SortKey | 'model') => {
      if (key === 'model' || !SORTABLE_COLS.has(key)) return;
      if (key === sortKey) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortKey(key);
        setSortDir('asc');
      }
    },
    [sortKey]
  );

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return <ErrorState title="Error" message={error} />;
  }

  const sorted = sortCities(cities, sortKey, sortDir);

  return (
    <div className="w-full overflow-x-auto">
      <GlassCard
        surface="glass"
        tint="rgba(58,108,127,0.2)"
        blurStrength="md"
        shadow="sm"
        size="sm"
        className="min-w-[700px] p-0 overflow-hidden"
      >
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-white/10">
              {COLUMNS.map((col, i) => {
                const sortable = col.key !== 'model' && SORTABLE_COLS.has(col.key);
                const isActive = col.key === sortKey;
                return (
                  <th
                    key={`${col.key}-${i}`}
                    onClick={sortable ? () => handleSort(col.key) : undefined}
                    className={[
                      'px-5 py-3.5 text-xs font-bold uppercase tracking-widest',
                      col.align === 'right' ? 'text-right' : 'text-left',
                      sortable ? 'cursor-pointer select-none hover:text-white transition-colors duration-150' : '',
                      isActive ? 'text-white' : 'text-white/50',
                    ].join(' ')}
                  >
                    {col.label}
                    <SortIcon col={col.key} activeCol={sortKey} dir={sortDir} />
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {sorted.map((city, rowIdx) => {
              const isEven = rowIdx % 2 === 0;
              const selectionIndex = selectedCityPaths.indexOf(city.path);
              const isSelected = selectionIndex !== -1;
              
              const getBg = () => {
                if (isSelected) {
                  return selectionIndex === 0 
                    ? 'rgba(225, 172, 85, 0.45)' // Yellow tint
                    : 'rgba(175, 71, 73, 0.45)'; // Red tint
                }
                return isEven ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.07)';
              };

              return (
                <tr
                  key={city.path}
                  onClick={() => onToggleCity(city)}
                  style={{ backgroundColor: getBg() }}
                  className={`
                    border-b border-white/5 transition-colors duration-150 cursor-pointer
                    ${isSelected ? 'hover:bg-white/20' : 'hover:bg-white/10'}
                    relative z-[1]
                  `}
                >
                  {COLUMNS.map((col, i) => (
                    <td
                      key={`${col.key}-${i}`}
                      className={[
                        'px-5 py-4 text-sm text-white/85',
                        col.align === 'right' ? 'text-right' : 'text-left',
                      ].join(' ')}
                    >
                      {col.render(city, isSelected, selectionIndex)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </GlassCard>
    </div>
  );
};

export default CityCompareTable;
