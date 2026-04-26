import React from 'react';
import { Link } from 'react-router';
import type { CityData } from '../../constants/cities';
import type { Column } from './CityCompareTable';
import { Network, Car, MapPin } from 'lucide-react';
import { MAP_MODES } from '../../constants/mapModes';

const MODE_META: Record<string, { icon: React.ComponentType<{ size?: number; className?: string }>; color: string }> = {
  [MAP_MODES.INFRASTRUCTURE]: { icon: Network,       color: 'text-blue-400'   },
  [MAP_MODES.TRAFFIC]:        { icon: Car,           color: 'text-red-400'    },
  [MAP_MODES.STATIONS]:       { icon: MapPin,        color: 'text-green-400'  },
};

interface MobileCompareRowsProps {
  cities: CityData[];
  selectedCityPaths: string[];
  onToggleCity: (city: CityData) => void;
  visibleColumns: Column[];
}

export const MobileCompareRows: React.FC<MobileCompareRowsProps> = ({
  cities,
  selectedCityPaths,
  onToggleCity,
  visibleColumns,
}) => {
  // Only show group columns (not Base) for the stat area
  const statCols = visibleColumns.filter((col) => col.group !== 'Base');

  return (
    <div className="flex flex-col">
      {/* Header row */}
      <div className="flex items-center py-2 px-4 border-b border-white/10 bg-white/[0.03]">
        <span className="text-[10px] font-bold uppercase tracking-widest text-white/30 w-[110px] shrink-0">
          Ciudad
        </span>
        <div className="flex-1 flex items-center justify-end gap-3 pr-2">
          {statCols.map((col) => (
            <span
              key={col.key}
              className={`text-[10px] font-bold uppercase tracking-widest text-white/30 min-w-[56px] ${
                col.align === 'right' ? 'text-right' : 'text-left'
              }`}
            >
              {col.label}
            </span>
          ))}
        </div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-white/30 w-[60px] text-right">
          Mapas
        </span>
      </div>

      {/* Data rows */}
      {cities.map((city, rowIdx) => {
        const selectionIndex = selectedCityPaths.indexOf(city.path);
        const isSelected = selectionIndex !== -1;

        const getBg = () => {
          if (isSelected) {
            return selectionIndex === 0
              ? 'rgba(225, 172, 85, 0.45)'
              : 'rgba(175, 71, 73, 0.45)';
          }
          return rowIdx % 2 === 0
            ? 'rgba(255,255,255,0.02)'
            : 'rgba(255,255,255,0.04)';
        };

        const availableModes = Object.entries(city.available_modes || {})
          .filter(([, enabled]) => enabled !== false)
          .map(([id]) => id);

        return (
          <button
            key={city.path}
            onClick={() => onToggleCity(city)}
            style={{ backgroundColor: getBg() }}
            className="w-full text-left flex items-center py-3 px-4 border-b border-white/5 transition-all duration-200 hover:bg-white/[0.06] group/row"
          >
            {/* City name */}
            <div className="flex items-center gap-1.5 w-[110px] shrink-0 min-w-0">
              {isSelected && (
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{
                    backgroundColor: selectionIndex === 0 ? 'rgb(225,172,85)' : 'rgb(175,71,73)',
                  }}
                />
              )}
              <span className="font-semibold text-white text-sm truncate">
                {city.name}
              </span>
            </div>

            {/* Stat columns */}
            <div className="flex-1 flex items-center justify-end gap-3 pr-2 min-w-0">
              {statCols.map((col, i) => (
                <div
                  key={`${col.key}-${i}`}
                  className={`text-white/70 text-xs tabular-nums min-w-[56px] ${
                    col.align === 'right' ? 'text-right' : 'text-left'
                  }`}
                >
                  {col.render(city, isSelected, selectionIndex)}
                </div>
              ))}
            </div>

            {/* Mode icon links */}
            <div className="flex items-center gap-0.5 w-[60px] justify-end shrink-0">
              {availableModes.map((modeId) => {
                const meta = MODE_META[modeId];
                if (!meta) return null;
                const Icon = meta.icon;
                return (
                  <Link
                    key={modeId}
                    to={`${city.path}?mode=${modeId}`}
                    onClick={(e) => e.stopPropagation()}
                    className={`p-1 rounded-md bg-white/5 hover:bg-white/15 transition-colors ${meta.color} opacity-60 hover:opacity-100`}
                    title={modeId}
                  >
                    <Icon size={11} />
                  </Link>
                );
              })}
            </div>
          </button>
        );
      })}
    </div>
  );
};
