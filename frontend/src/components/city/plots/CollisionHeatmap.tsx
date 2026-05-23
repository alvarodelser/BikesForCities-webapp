import React, { useState } from 'react';
import type { CollisionMatrixRow, CollisionVehicleKey, PairSev } from '../../../hooks/useAccidentsStats';
import {
  Bicycle, PersonSimpleWalk, Motorcycle, CarProfile, Van, Truck,
} from '@phosphor-icons/react';

const ICON_COLOR = '#6b7280';

const VEHICLE_META: Record<CollisionVehicleKey, { label: string; icon: React.ElementType; color: string }> = {
  bike_vmu:   { label: 'Bicicleta', icon: Bicycle,          color: ICON_COLOR },
  pedestrian: { label: 'Peatón',    icon: PersonSimpleWalk,  color: ICON_COLOR },
  moto:       { label: 'Moto',      icon: Motorcycle,        color: ICON_COLOR },
  car:        { label: 'Turismo',   icon: CarProfile,        color: ICON_COLOR },
  bus:        { label: 'Autobús',   icon: Van,               color: ICON_COLOR },
  truck:      { label: 'Camión',    icon: Truck,             color: ICON_COLOR },
};

// Pedestrian first so the most-vulnerable participant anchors row 0 (longest row)
const DISPLAY_ORDER: CollisionVehicleKey[] = ['pedestrian', 'bike_vmu', 'moto', 'car', 'bus', 'truck'];

const SEV_ROWS = [
  { label: 'Fatal', color: '#7f1d1d', key: 'fatal'     as const },
  { label: 'Grave', color: '#f97316', key: 'serious'   as const },
  { label: 'Leve',  color: '#fbbf24', key: 'minor'     as const },
  { label: 'Ileso', color: '#22c55e', key: 'uninjured' as const },
];

function avgSev(sev: PairSev): number {
  const total = sev.fatal + sev.serious + sev.minor + sev.uninjured;
  if (total === 0) return -1;
  return (sev.fatal * 3 + sev.serious * 2 + sev.minor * 1) / total;
}

// Green → Yellow → Red, t ∈ [0,1]
function sevToColor(t: number): string {
  const s = Math.max(0, Math.min(1, t));
  let r: number, g: number, b: number;
  if (s <= 0.5) {
    const x = s / 0.5;
    r = Math.round(34  + x * (251 - 34));
    g = Math.round(197 + x * (191 - 197));
    b = Math.round(94  + x * (36  - 94));
  } else {
    const x = (s - 0.5) / 0.5;
    r = Math.round(251 + x * (220 - 251));
    g = Math.round(191 + x * (38  - 191));
    b = Math.round(36  + x * (38  - 36));
  }
  return `rgba(${r},${g},${b},0.88)`;
}

// Amber → Red-800, t ∈ [0,1]
function countToColor(t: number): string {
  const r = Math.round(253 + t * (153 - 253));
  const g = Math.round(230 + t * (27  - 230));
  const b = Math.round(138 + t * (27  - 138));
  return `rgba(${r},${g},${b},0.9)`;
}

interface Hovered {
  rowKey: CollisionVehicleKey;
  colKey: CollisionVehicleKey;
  rowSev: PairSev;
  colSev: PairSev;
}

function SevBar({ value, total, color }: { value: number; total: number; color: string }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="flex items-center gap-1 min-w-0">
      <div className="relative flex-1 h-[3px] rounded-full bg-gray-100 min-w-0 overflow-hidden">
        <div className="absolute left-0 top-0 h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[8px] font-bold text-gray-700 tabular-nums flex-shrink-0 w-4 text-right">{value}</span>
    </div>
  );
}

// Compact two-column panel rendered inside the empty lower-left triangle
function InfoPanel({ h }: { h: Hovered }) {
  const { rowKey, colKey, rowSev, colSev } = h;
  const isDiag = rowKey === colKey;
  const m1 = VEHICLE_META[rowKey];
  const m2 = VEHICLE_META[colKey];
  const I1 = m1.icon as React.ElementType;
  const I2 = m2.icon as React.ElementType;
  const t1 = rowSev.accident_count;
  const t2 = colSev.accident_count;
  const cols = isDiag ? 'grid-cols-[1.75rem_1fr]' : 'grid-cols-[1.75rem_1fr_1fr]';

  return (
    <div className="text-[8px] leading-[1.35]">
      {/* Vehicle header */}
      <div className={`grid ${cols} gap-x-1 pb-1 mb-0.5 border-b border-gray-100`}>
        <div />
        <div className="flex items-center gap-0.5 font-bold min-w-0">
          <I1 size={8} color={m1.color} weight="bold" className="flex-shrink-0" />
          <span className="truncate">{m1.label}</span>
        </div>
        {!isDiag && (
          <div className="flex items-center gap-0.5 font-bold min-w-0">
            <I2 size={8} color={m2.color} weight="bold" className="flex-shrink-0" />
            <span className="truncate">{m2.label}</span>
          </div>
        )}
      </div>
      {/* Severity rows: tiny bar + count */}
      {SEV_ROWS.map(({ label, color, key }) => (
        <div key={key} className={`grid ${cols} gap-x-1 items-center`}>
          <div className="flex items-center gap-0.5 text-gray-500 min-w-0">
            <div className="w-1.5 h-1.5 rounded-sm flex-shrink-0" style={{ background: color }} />
            <span className="truncate">{label}</span>
          </div>
          <SevBar value={rowSev[key]} total={t1} color={color} />
          {!isDiag && <SevBar value={colSev[key]} total={t2} color={color} />}
        </div>
      ))}
      {/* Total accidents */}
      <div className={`grid ${cols} gap-x-1 border-t border-gray-100 mt-0.5 pt-0.5`}>
        <div className="text-gray-400">acc.</div>
        <div className="text-right font-bold text-gray-700 tabular-nums">{t1}</div>
        {!isDiag && <div className="text-right font-bold text-gray-700 tabular-nums">{t2}</div>}
      </div>
    </div>
  );
}

interface CollisionHeatmapProps {
  data: CollisionMatrixRow[];
  title: string;
  subtitle?: string;
}

const CELL = 44;
const HEADER = 34;
const C = CELL - 2;
// Info panel sits in lower-left empty triangle; width = 3 cells - gap (safe to row-3 boundary)
const PANEL_W = 3 * CELL - 4;

export const CollisionHeatmap: React.FC<CollisionHeatmapProps> = ({ data, title, subtitle }) => {
  const [mode, setMode] = useState<'severity' | 'count'>('severity');
  const [hovered, setHovered] = useState<Hovered | null>(null);

  if (!data.length) return null;

  const keys = DISPLAY_ORDER;

  const cellMap: Record<string, Record<string, { rowSev: PairSev; colSev: PairSev }>> = {};
  for (const row of data) {
    cellMap[row.rowKey] = {};
    for (const { colKey, cell } of row.cells) {
      cellMap[row.rowKey][colKey] = cell;
    }
  }

  // Adaptive severity range from all upper-triangular cells (ci >= ri)
  const allSevScores: number[] = [];
  for (let ri = 0; ri < keys.length; ri++) {
    for (let ci = ri; ci < keys.length; ci++) {
      const cell = cellMap[keys[ri]]?.[keys[ci]];
      if (!cell) continue;
      if (ri === ci) {
        const s = avgSev(cell.rowSev);
        if (s >= 0) allSevScores.push(s);
      } else {
        const r = avgSev(cell.rowSev);
        const c = avgSev(cell.colSev);
        if (r >= 0) allSevScores.push(r);
        if (c >= 0) allSevScores.push(c);
      }
    }
  }
  const minSev = allSevScores.length ? Math.min(...allSevScores) : 0;
  const maxSev = allSevScores.length ? Math.max(...allSevScores) : 3;
  const sevRange = Math.max(maxSev - minSev, 0.2);

  const getSevColor = (sev: PairSev): string => {
    const score = avgSev(sev);
    if (score < 0) return 'rgba(220,220,220,0.2)';
    return sevToColor(Math.max(0, Math.min(1, (score - minSev) / sevRange)));
  };

  const maxCount = Math.max(
    1,
    ...keys.flatMap((rk, ri) => keys.slice(ri).map(ck => cellMap[rk]?.[ck]?.rowSev.accident_count ?? 0)),
  );
  const getCountColor = (n: number): string =>
    n === 0 ? 'rgba(220,220,220,0.25)' : countToColor(Math.pow(n / maxCount, 0.55));

  return (
    <div
      className="rounded-2xl border bg-white/80 backdrop-blur-sm p-5 w-full transition-all hover:bg-white/90"
      style={{ borderColor: 'rgba(0,0,0,0.08)', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}
    >
      {/* Header + mode toggle */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-bold text-gray-900 leading-tight">{title}</h3>
          {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex rounded-md border border-gray-200 text-[10px] overflow-hidden flex-shrink-0">
          <button
            className={`px-2.5 py-1 transition-colors ${mode === 'severity' ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
            onClick={() => setMode('severity')}
          >
            Gravedad
          </button>
          <button
            className={`px-2.5 py-1 transition-colors ${mode === 'count' ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
            onClick={() => setMode('count')}
          >
            Frecuencia
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        {/* position:relative so the info panel can be positioned inside */}
        <div style={{ position: 'relative', display: 'inline-block', minWidth: (keys.length + 1) * CELL }}>

          {/* Column headers */}
          <div className="flex">
            <div style={{ width: HEADER, height: HEADER, flexShrink: 0 }} />
            {keys.map(colKey => {
              const Icon = VEHICLE_META[colKey].icon as React.ElementType;
              return (
                <div key={colKey} title={VEHICLE_META[colKey].label}
                  className="flex items-center justify-center"
                  style={{ width: CELL, height: HEADER, flexShrink: 0 }}>
                  <Icon size={14} color={VEHICLE_META[colKey].color} weight="bold" />
                </div>
              );
            })}
          </div>

          {/* Data rows — upper triangular only (ci >= ri) */}
          {keys.map((rowKey, ri) => {
            const RowIcon = VEHICLE_META[rowKey].icon as React.ElementType;
            return (
              <div key={rowKey} className="flex">
                <div title={VEHICLE_META[rowKey].label}
                  className="flex items-center justify-center"
                  style={{ width: HEADER, height: CELL, flexShrink: 0 }}>
                  <RowIcon size={14} color={VEHICLE_META[rowKey].color} weight="bold" />
                </div>

                {keys.map((colKey, ci) => {
                  // Lower triangular: invisible spacer to keep column alignment
                  if (ci < ri) {
                    return <div key={colKey} style={{ width: CELL, height: CELL, flexShrink: 0 }} />;
                  }

                  const isDiag = rowKey === colKey;
                  const cell   = cellMap[rowKey]?.[colKey];
                  const count  = cell?.rowSev.accident_count ?? 0;
                  const hasData = count > 0;

                  const enter = () => {
                    if (hasData && cell) setHovered({ rowKey, colKey, rowSev: cell.rowSev, colSev: cell.colSev });
                  };
                  const leave = () => setHovered(null);

                  // ── Count mode ────────────────────────────────────────────
                  if (mode === 'count') {
                    return (
                      <div
                        key={colKey}
                        className="relative m-px rounded-sm flex items-center justify-center"
                        style={{ width: C, height: C, flexShrink: 0, background: getCountColor(count) }}
                        onMouseEnter={enter} onMouseLeave={leave}
                      >
                        {hasData && (
                          <span className="text-[10px] font-bold text-white select-none"
                            style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
                            {count}
                          </span>
                        )}
                      </div>
                    );
                  }

                  // ── Severity mode — diagonal (full square) ─────────────────
                  if (isDiag) {
                    return (
                      <div
                        key={colKey}
                        className="relative m-px rounded-sm"
                        style={{
                          width: C, height: C, flexShrink: 0,
                          background: hasData ? getSevColor(cell!.rowSev) : 'rgba(180,180,180,0.15)',
                        }}
                        onMouseEnter={enter} onMouseLeave={leave}
                      />
                    );
                  }

                  // ── Severity mode — anti-diagonal split ────────────────────
                  // Top-left triangle (0,0)-(C,0)-(0,C)  = row vehicle
                  // Bottom-right triangle (C,0)-(C,C)-(0,C) = col vehicle
                  return (
                    <div
                      key={colKey}
                      className="relative m-px rounded-sm"
                      style={{ width: C, height: C, flexShrink: 0, overflow: 'hidden' }}
                      onMouseEnter={enter} onMouseLeave={leave}
                    >
                      {hasData ? (
                        <svg width={C} height={C} style={{ display: 'block' }}>
                          {/* lower-left = row vehicle (toward left row header) */}
                          <polygon points={`0,0 0,${C} ${C},${C}`}   fill={getSevColor(cell!.rowSev)} />
                          {/* upper-right = col vehicle (toward top column header) */}
                          <polygon points={`0,0 ${C},0 ${C},${C}`}   fill={getSevColor(cell!.colSev)} />
                        </svg>
                      ) : (
                        <div className="w-full h-full" style={{ background: 'rgba(220,220,220,0.2)' }} />
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* Info panel — sits in the lower-left empty triangle */}
          {hovered ? (
            <div
              className="absolute bg-white/97 border border-black/8 rounded-lg p-2 shadow-md pointer-events-none"
              style={{ bottom: 2, left: HEADER + 1, width: PANEL_W }}
            >
              <InfoPanel h={hovered} />
            </div>
          ) : (
            <div
              className="absolute flex items-center justify-center text-center"
              style={{ bottom: 2, left: HEADER + 1, width: PANEL_W, height: PANEL_W * 0.7 }}
            >
              <p className="text-[8px] text-gray-300 leading-tight">
                Coloca el cursor<br />sobre una celda
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      {mode === 'severity' ? (
        <>
          <div className="flex items-center gap-2 mt-3">
            <span className="text-[10px] text-gray-400 tabular-nums">{minSev.toFixed(1)}</span>
            <div className="flex-1 h-2.5 rounded"
              style={{ background: 'linear-gradient(to right, rgba(34,197,94,0.88), rgba(251,191,36,0.88), rgba(220,38,38,0.88))' }} />
            <span className="text-[10px] text-gray-400 tabular-nums">{maxSev.toFixed(1)}</span>
          </div>
          <p className="text-[9px] text-gray-400 mt-1">
            Gravedad media (0=ileso · 3=fatal, escala relativa) · ◺ fila · ◿ columna · diagonal = mismo tipo/caídas
          </p>
        </>
      ) : (
        <>
          <div className="flex items-center gap-2 mt-3">
            <span className="text-[10px] text-gray-400 tabular-nums">0</span>
            <div className="flex-1 h-2.5 rounded"
              style={{ background: 'linear-gradient(to right, rgba(253,230,138,0.9), rgba(153,27,27,0.9))' }} />
            <span className="text-[10px] text-gray-400 tabular-nums">{maxCount} acc.</span>
          </div>
          <p className="text-[9px] text-gray-400 mt-1">
            Nº de accidentes por par · diagonal = mismo tipo/caídas
          </p>
        </>
      )}
    </div>
  );
};

export default CollisionHeatmap;
