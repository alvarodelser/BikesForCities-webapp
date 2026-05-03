// CityRankTable.tsx
import React, { useMemo, useState } from 'react';

interface CityEntry {
  id: number;
  name: string;
  score: number;
  isCurrent?: boolean;
}

interface CityRankTableProps {
  cities: CityEntry[];
  accent: string;
  pageSize?: number;
}

export const CityRankTable: React.FC<CityRankTableProps> = ({
  cities,
  accent,
  pageSize = 8,
}) => {
  // Sort descending by score and assign rank
  const ranked = useMemo<(CityEntry & { rank: number })[]>(() => {
    const sorted = [...cities].sort((a, b) => b.score - a.score);
    return sorted.map((c, i) => ({ ...c, rank: i + 1 }));
  }, [cities]);

  const currentEntry = ranked.find((c) => c.isCurrent);

  // Build the visible slice centered around the current city.
  const visibleEntries = useMemo(() => {
    if (!currentEntry) return ranked.slice(0, pageSize);

    const currentIndex = ranked.findIndex((c) => c.id === currentEntry.id);
    let start = Math.max(0, currentIndex - Math.floor(pageSize / 2));
    let end = start + pageSize;

    if (end > ranked.length) {
      end = ranked.length;
      start = Math.max(0, end - pageSize);
    }

    return ranked.slice(start, end);
  }, [ranked, currentEntry, pageSize]);

  const maxScore = ranked.length > 0 ? ranked[0].score : 100;

  return (
    <div className="flex flex-col gap-3">
      {/* Rows */}
      <ul className="space-y-1.5">
        {visibleEntries.map((city) => {
          const isCurrent = city.isCurrent === true;
          const barWidth = maxScore > 0 ? (city.score / maxScore) * 100 : 0;

          return (
            <li
              key={city.id}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                isCurrent ? 'font-semibold' : ''
              }`}
              style={
                isCurrent
                  ? { background: `${accent}18`, outline: `1.5px solid ${accent}55` }
                  : { background: 'rgba(0,0,0,0.03)' }
              }
            >
              {/* Rank */}
              <span
                className="w-6 shrink-0 text-center text-xs font-mono"
                style={{ color: isCurrent ? accent : '#9ca3af' }}
              >
                {isCurrent ? '▶' : city.rank}
              </span>

              {/* Name + bar */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span
                    className="truncate"
                    style={{ color: isCurrent ? accent : '#374151' }}
                  >
                    {city.name}
                  </span>
                  <span
                    className="ml-2 shrink-0 tabular-nums text-xs"
                    style={{ color: isCurrent ? accent : '#6b7280' }}
                  >
                    {city.score.toFixed(1)}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-black/10 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${barWidth}%`,
                      background: isCurrent ? accent : '#9ca3af',
                    }}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ul>


    </div>
  );
};

export default CityRankTable;
