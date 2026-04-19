import React from 'react';
import { Link } from 'react-router';
import type { CityData, Column } from './CityCompareTable';

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
  return (
    <div className="flex flex-col gap-1">
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
            : 'rgba(255,255,255,0.05)';
        };

        return (
          <button
            key={city.path}
            onClick={() => onToggleCity(city)}
            style={{ backgroundColor: getBg() }}
            className="w-full text-left flex items-center justify-between py-3 px-3 border-b border-white/5 transition-all duration-300 hover:bg-white/10 rounded-sm group/row"
          >
            {/* City name and selection badge */}
            <div className="flex items-center gap-2 flex-shrink-0 min-w-[100px]">
              <span className="font-semibold text-white text-sm whitespace-nowrap">
                {city.name}
              </span>
              {isSelected && (
                <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full bg-white/20 text-white whitespace-nowrap">
                  Sel
                </span>
              )}
            </div>

            {/* Stat columns (flex-grow to fill space) */}
            <div className="flex items-center gap-3 flex-grow px-2">
              {visibleColumns
                .filter((col) => col.group !== 'Base')
                .map((col, i) => (
                  <div
                    key={`${col.key}-${i}`}
                    className={`text-white/70 text-xs tabular-nums px-1 ${
                      col.align === 'right' ? 'text-right' : 'text-left'
                    }`}
                  >
                    {col.render(city, isSelected, selectionIndex)}
                  </div>
                ))}
            </div>

            {/* Mode icons at the right end */}
            <div className="flex items-center gap-1 flex-shrink-0 ml-2">
              {city.available_modes &&
                Object.entries(city.available_modes)
                  .filter(([, enabled]) => enabled !== false)
                  .map(([modeId]) => (
                    <Link
                      key={modeId}
                      to={`${city.path}?mode=${modeId}`}
                      onClick={(e) => e.stopPropagation()}
                      className="p-1.5 rounded-md bg-white/5 hover:bg-white/15 transition-colors"
                      title={`Ver mapa de ${modeId}`}
                    >
                      <div className="w-3 h-3 bg-white/70" />
                    </Link>
                  ))}
            </div>
          </button>
        );
      })}
    </div>
  );
};
