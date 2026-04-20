import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useViewport } from '../../hooks/useViewport';
import { Link } from 'react-router';
import type { CityData } from '../../constants/cities';
import { fetchCities } from '../../services/api';
import {
  formatPopulation,
  formatDistance,
  formatPercentage,
} from '../../utils/formatters';
import { GlassCard } from '../ui/GlassCard';
import Spinner from '../ui/Spinner';
import ErrorState from '../ui/ErrorState';
import { ColumnGroupPicker } from './ColumnGroupPicker';
import { MobileCompareRows } from './MobileCompareRows';
import { 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  Network, 
  Car, 
  MapPin, 
  Mountain, 
  CircleDot, 
  TriangleAlert,
  Users,
  Activity
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type GroupId = 'Infraestructura' | 'Servicio Bici' | 'Ayuntamiento';

export interface ColumnGroup {
  id: GroupId;
  label: string;
  icon: any;
}

type SortKey = keyof Pick<CityData, 'name' | 'population' | 'cyclingNetwork' | 'coverage' | 'stations_count' | 'monthly_trips'> | 'service_name';
type SortDir = 'asc' | 'desc';

export interface Column {
  key: SortKey | 'model' | 'mayor' | 'mayor_party';
  label: string;
  render: (city: CityData, isSelected: boolean, selectionIndex: number) => React.ReactNode;
  align?: 'left' | 'right';
  group?: GroupId | 'Base';
}

interface CityCompareTableProps {
  selectedCityPaths: string[];
  onToggleCity: (city: CityData) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GROUPS: ColumnGroup[] = [
  { id: 'Infraestructura', label: 'Infraestructura', icon: Network },
  { id: 'Servicio Bici', label: 'Servicio Bici', icon: Activity },
  { id: 'Ayuntamiento', label: 'Ayuntamiento', icon: Users },
];

const DATA_MODES = [
  { id: 'infrastructure', name: 'Infraestructura', icon: Network, color: 'text-blue-400' },
  { id: 'traffic', name: 'Tráfico', icon: Car, color: 'text-red-400' },
  { id: 'stations', name: 'Estaciones', icon: MapPin, color: 'text-green-400' },
  { id: 'terrain', name: 'Terreno', icon: Mountain, color: 'text-orange-400' },
  { id: 'intersections', name: 'Intersecciones', icon: CircleDot, color: 'text-yellow-400' },
  { id: 'accidents', name: 'Accidentes', icon: TriangleAlert, color: 'text-red-500' },
];

// ─── Column definitions ───────────────────────────────────────────────────────
// Note: We use compact widths and allow the table to grow only as needed.

const COLUMNS: Column[] = [
  {
    key: 'name',
    label: 'Ciudad',
    align: 'left',
    group: 'Base',
    render: (city) => (
      <span className="font-semibold text-white whitespace-nowrap px-4 block">
        {city.name}
      </span>
    ),
  },
  {
    key: 'model',
    label: 'Modos',
    align: 'left',
    group: 'Base',
    render: (city) => (
      <div className="flex items-center gap-1 min-h-[24px] px-4">
        {DATA_MODES
          .filter(mode => city.available_modes?.[mode.id] !== false)
          .map((mode) => (
          <Link 
            key={mode.id} 
            to={`${city.path}?mode=${mode.id}`}
            title={`Ver mapa de ${mode.name}`}
            onClick={(e) => e.stopPropagation()}
            className="p-1 rounded-md bg-white/5 hover:bg-white/15 transition-colors cursor-pointer group/mode"
          >
            <mode.icon size={11} className={`${mode.color} opacity-60 group-hover/mode:opacity-100 transition-opacity`} />
          </Link>
        ))}
      </div>
    ),
  },
  {
    key: 'population',
    label: 'Población',
    align: 'right',
    group: 'Base',
    render: (city) => (
      <span className="tabular-nums font-medium text-white/50 group-hover/row:text-white/90 transition-colors px-4 block">
        {formatPopulation(city.population)}
      </span>
    ),
  },
  {
    key: 'coverage',
    label: 'Cobertura',
    align: 'right',
    group: 'Infraestructura',
    render: (city) => (
      <span className="tabular-nums px-4 block">{formatPercentage(city.coverage)}%</span>
    ),
  },
  {
    key: 'cyclingNetwork',
    label: 'Red (km)',
    align: 'right',
    group: 'Infraestructura',
    render: (city) => (
      <span className="tabular-nums px-4 block whitespace-nowrap">{formatDistance(city.cyclingNetwork)} km</span>
    ),
  },
  {
    key: 'service_name',
    label: 'Servicio',
    align: 'left',
    group: 'Servicio Bici',
    render: (city) => (
      <span className="text-white/70 italic text-xs truncate max-w-[120px] px-4 block">{city.service_name || '-'}</span>
    ),
  },
  {
    key: 'stations_count',
    label: 'Estaciones',
    align: 'right',
    group: 'Servicio Bici',
    render: (city) => (
      <span className="tabular-nums font-medium text-[var(--green-light)] px-4 block">
        {(city.stations_count === 0 || city.stations_count === undefined) ? '-' : formatPopulation(city.stations_count)}
      </span>
    ),
  },
  {
    key: 'monthly_trips',
    label: 'Viajes/mes',
    align: 'right',
    group: 'Servicio Bici',
    render: (city) => (
      <span className="tabular-nums text-white px-4 block">
        {(city.monthly_trips === 0 || city.monthly_trips === undefined) ? '-' : formatPopulation(Math.round(city.monthly_trips))}
      </span>
    ),
  },
  {
    key: 'mayor',
    label: 'Alcalde/sa',
    align: 'left',
    group: 'Ayuntamiento',
    render: (city) => <span className="text-white/80 font-medium truncate max-w-[150px] px-4 block">{city.mayor || '-'}</span>,
  },
  {
    key: 'mayor_party',
    label: 'Partido',
    align: 'left',
    group: 'Ayuntamiento',
    render: (city) => (
      <span className="text-[10px] text-white/40 uppercase tracking-wider truncate max-w-[100px] px-4 block">
        {city.mayor_party || '-'}
      </span>
    ),
  },
];

const SORTABLE_COLS = new Set<SortKey>(['name', 'population', 'cyclingNetwork', 'coverage', 'stations_count', 'monthly_trips', 'service_name']);

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

// ─── UI Components ────────────────────────────────────────────────────────────

const GroupTabActive: React.FC<{ 
  group: ColumnGroup; 
  onToggle: () => void;
  colSpan: number;
}> = ({ group, onToggle, colSpan }) => {
  return (
    <th 
      colSpan={colSpan} 
      className="relative p-0 transition-all duration-500 ease-in-out h-10 pointer-events-none"
    >
      <div 
        onClick={onToggle}
        className="absolute inset-x-[1px] bottom-0 cursor-pointer flex flex-col items-center justify-end h-full px-4 group/tab hover:translate-y-[-1px] transition-transform duration-300 pointer-events-auto"
      >
        <svg 
          className="absolute inset-x-0 bottom-0 w-full h-[100%] transition-all" 
          viewBox="0 0 100 40" 
          preserveAspectRatio="none"
        >
          <path 
            d="M 0,40 L 4,0 L 96,0 L 100,40 Z" 
            fill="rgba(255,255,255,0.06)"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="1.2"
            className="group-hover/tab:fill-white/10 transition-all"
          />
        </svg>
        <div className="relative z-10 flex items-center gap-2 pb-2">
           <group.icon size={13} className="text-white/30 group-hover/tab:text-white/70 transition-colors" />
           <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/50 group-hover/tab:text-white/90">
             {group.label}
           </span>
        </div>
      </div>
    </th>
  );
};

const ClosedTabsDock: React.FC<{
  groups: ColumnGroup[];
  onToggle: (id: GroupId) => void;
}> = ({ groups, onToggle }) => {
  if (groups.length === 0) return null;
  return (
    <th colSpan={groups.length} className="relative p-0 h-10 pointer-events-none">
      <div className="flex items-end justify-end h-full pr-1 pointer-events-auto">
        {groups.map((group, i) => (
          <div 
            key={group.id}
            onClick={() => onToggle(group.id)}
            className="relative cursor-pointer h-9 w-[60px] group/dock -ml-3 first:ml-0 transition-all hover:translate-y-[-1px]"
            style={{ zIndex: groups.length - i }}
          >
            <svg 
              className="absolute inset-0 w-full h-full" 
              viewBox="0 0 60 40" 
              preserveAspectRatio="none"
            >
              <path 
                d="M 60,40 L 45,20 L 60,0 L 15,0 L 0,20 L 15,40 Z" 
                fill="rgba(255,255,255,0.04)"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="1.5"
                className="group-hover/dock:fill-white/12 transition-all transition-colors"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-start pl-4">
               <group.icon size={16} className="text-white/20 group-hover/dock:text-white/60 transition-all" />
            </div>
          </div>
        ))}
      </div>
    </th>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const SortIcon: React.FC<{ col: string; activeCol: SortKey; dir: SortDir }> = ({ col, activeCol, dir }) => {
  if (!SORTABLE_COLS.has(col as SortKey)) return null;
  if (col !== activeCol) return <ArrowUpDown size={10} className="opacity-10 ml-1 inline" />;
  return dir === 'asc' ? <ArrowUp size={10} className="text-white ml-1 inline" /> : <ArrowDown size={10} className="text-white ml-1 inline" />;
};

const CityCompareTable: React.FC<CityCompareTableProps> = ({ selectedCityPaths, onToggleCity }) => {
  const [cities, setCities] = useState<CityData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('population');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [expandedGroups, setExpandedGroups] = useState<Set<GroupId>>(new Set(['Infraestructura', 'Ayuntamiento']));
  const [scrollMetrics, setScrollMetrics] = useState({ left: 0, width: 0, client: 0 });
  const scrollRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startScrollLeft = useRef(0);
  const { isMobile } = useViewport();

  useEffect(() => {
    fetchCities().then((data) => { setCities(data); setLoading(false); }).catch(() => { setError('Error loading cities.'); setLoading(false); });
  }, []);

  const updateScrollMetrics = useCallback(() => {
    if (scrollRef.current) {
      setScrollMetrics({
        left: scrollRef.current.scrollLeft,
        width: scrollRef.current.scrollWidth,
        client: scrollRef.current.clientWidth
      });
    }
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.addEventListener('scroll', updateScrollMetrics);
      const resizeObserver = new ResizeObserver(updateScrollMetrics);
      resizeObserver.observe(el);
      // Wait for table layout to stabilize
      const timer = setTimeout(updateScrollMetrics, 500);
      return () => {
        el.removeEventListener('scroll', updateScrollMetrics);
        resizeObserver.disconnect();
        clearTimeout(timer);
      };
    }
  }, [updateScrollMetrics, cities, expandedGroups]);

  const onThumbMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    startX.current = e.pageX;
    startScrollLeft.current = scrollRef.current?.scrollLeft || 0;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ew-resize';
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current || !scrollRef.current) return;
    const deltaX = e.pageX - startX.current;
    // The visual movement of the thumb corresponds to the scroll progress
    // Track width is fixed at max-w-sm (approx 384px) effectively.
    // However, let's use a simpler approach: calculate % of track moved.
    const trackWidth = 384; // max-w-sm in px roughly
    const moveRatio = deltaX / trackWidth;
    scrollRef.current.scrollLeft = startScrollLeft.current + moveRatio * scrollMetrics.width;
  }, [scrollMetrics]);

  const onMouseUp = useCallback(() => {
    isDragging.current = false;
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  }, [onMouseMove]);

  const toggleGroup = (groupId: GroupId) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const handleSort = useCallback((key: string) => {
    if (!SORTABLE_COLS.has(key as SortKey)) return;
    const k = key as SortKey;
    if (k === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(k); setSortDir('desc'); }
  }, [sortKey]);

  const activeGroups = useMemo(() => GROUPS.filter(g => expandedGroups.has(g.id)), [expandedGroups]);
  const closedGroups = useMemo(() => GROUPS.filter(g => !expandedGroups.has(g.id)), [expandedGroups]);

  const visibleColumns = useMemo(() => {
    const baseCols = COLUMNS.filter(col => col.group === 'Base');
    const groupCols = activeGroups.flatMap(g => COLUMNS.filter(col => col.group === g.id));
    return [...baseCols, ...groupCols];
  }, [activeGroups]);

  const sorted = sortCities(cities, sortKey, sortDir);

  if (loading) return <div className="flex justify-center py-16"><Spinner /></div>;
  if (error) return <ErrorState title="Error" message={error} />;

  if (isMobile) {
    return (
      <div className="flex flex-col gap-4 w-full overflow-hidden">
        <ColumnGroupPicker
          groups={GROUPS}
          expanded={expandedGroups}
          onToggle={toggleGroup}
        />
        <div className="w-full overflow-x-auto pb-4 custom-scrollbar">
          <MobileCompareRows
            cities={sorted}
            selectedCityPaths={selectedCityPaths}
            onToggleCity={onToggleCity}
            visibleColumns={visibleColumns}
          />
        </div>
      </div>
    );
  }

  // Calculate proportional thumb metrics
  const hasOverflow = scrollMetrics.width > scrollMetrics.client;
  const thumbWidthPercent = hasOverflow ? (scrollMetrics.client / scrollMetrics.width) * 100 : 100;
  const thumbLeftPercent = hasOverflow ? (scrollMetrics.left / scrollMetrics.width) * 100 : 0;

  return (
    <div className="w-full max-w-[1700px] mx-auto px-4 relative flex flex-col gap-4 group/table-wrapper overflow-visible">
      
      <div 
        ref={scrollRef}
        className="w-full overflow-x-auto pb-6 custom-scrollbar relative scroll-smooth overflow-y-visible"
      >
        <div className="min-w-fit flex flex-col pt-16 relative">
          <GlassCard
            surface="glass"
            tint="rgba(58,108,127,0.12)"
            blurStrength="md"
            shadow="sm"
            size="sm"
            className="p-0 border border-white/10 overflow-visible relative flex flex-col"
          >
            {/* Table-auto with min-w-fit on parent ensures "as short as possible" cols */}
            <table className="border-collapse table-auto relative">
              <thead>
                <tr className="h-10 border-0 bg-transparent relative z-40">
                  <th colSpan={3} className="px-5 border-0" /> 
                  {activeGroups.map(group => {
                    const colCount = COLUMNS.filter(c => c.group === group.id).length;
                    return (
                      <GroupTabActive 
                        key={group.id} 
                        group={group} 
                        onToggle={() => toggleGroup(group.id)}
                        colSpan={colCount}
                      />
                    );
                  })}
                  <ClosedTabsDock groups={closedGroups} onToggle={toggleGroup} />
                </tr>
                <tr className="border-t border-b border-white/10 bg-white/[0.04] relative z-30">
                  {visibleColumns.map((col, i) => {
                    const sortable = SORTABLE_COLS.has(col.key as SortKey);
                    return (
                      <th
                        key={`${col.key}-${i}`}
                        onClick={sortable ? () => handleSort(col.key) : undefined}
                        className={`
                          py-5 text-[10px] font-bold uppercase tracking-widest transition-all duration-300
                          ${col.align === 'right' ? 'text-right' : 'text-left'}
                          ${sortable ? 'cursor-pointer select-none hover:text-white' : ''}
                          text-white/40 whitespace-nowrap px-4
                        `}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span>{col.label}</span>
                          <SortIcon col={col.key} activeCol={sortKey} dir={sortDir} />
                        </div>
                      </th>
                    );
                  })}
                  {closedGroups.map((_, i) => (
                    <th key={`dock-head-${i}`} className="min-w-[60px] transition-all border-0" />
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((city, rowIdx) => {
                  const selectionIndex = selectedCityPaths.indexOf(city.path);
                  const isSelected = selectionIndex !== -1;
                  const getBg = () => {
                    if (isSelected) return selectionIndex === 0 ? 'rgba(225, 172, 85, 0.45)' : 'rgba(175, 71, 73, 0.45)';
                    return rowIdx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)';
                  };
                  return (
                    <tr
                      key={city.path}
                      onClick={() => onToggleCity(city)}
                      style={{ backgroundColor: getBg() }}
                      className="border-b border-white/5 transition-all duration-300 cursor-pointer hover:bg-white/10 relative z-10 group/row"
                    >
                      {visibleColumns.map((col, i) => (
                        <td
                          key={`${col.key}-${i}`}
                          className={`
                            py-4 text-sm text-white/80 transition-all duration-500
                            ${col.align === 'right' ? 'text-right' : 'text-left'}
                            whitespace-nowrap px-4
                          `}
                        >
                           <div className="animate-in fade-in duration-500">
                             {col.render(city, isSelected, selectionIndex)}
                           </div>
                        </td>
                      ))}
                      {closedGroups.map((_, i) => (
                         <td key={`dock-row-spacer-${i}`} className="transition-all" />
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </GlassCard>
        </div>
      </div>

      {/* Proportional White Slider Controller */}
      {hasOverflow && (
        <div className="w-full flex justify-center pb-8 animate-in fade-in slide-in-from-bottom-2 duration-700">
           <div className="w-full max-w-sm bg-white/[0.05] h-[2px] rounded-full relative overflow-visible group/track">
              <div 
                onMouseDown={onThumbMouseDown}
                style={{ 
                  width: `${thumbWidthPercent}%`,
                  left: `${thumbLeftPercent}%`,
                  transition: isDragging.current ? 'none' : 'left 0.1s ease-out, width 0.3s ease'
                }}
                className="absolute top-1/2 -translate-y-1/2 h-1 bg-white/40 rounded-full cursor-ew-resize hover:bg-white/80 hover:h-2 transition-all group-hover/track:bg-white/60 active:bg-white active:h-2 z-50 shadow-[0_0_15px_rgba(255,255,255,0.2)]"
                title="Desliza para ver más"
              />
           </div>
        </div>
      )}
      
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

export default CityCompareTable;
