// frontend/src/components/city/plots/ElectoralSemicircle.tsx
import React, { useRef, useState, useEffect, useMemo } from 'react';
import type { ElectionResult, CouncilorRecord } from '../../../services/api';
import { getPartyColor, getPartyIdeology } from '../../../constants/parties';
import { fmtInt } from '../../../utils/formatters';

export interface PartyAllocation {
  party: string;
  councilors: number;
  votes: number | null;
  names?: string[]; // elected councilors in candidate-list order
}

export interface SeatDot {
  x: number;
  y: number;
  party: string;
  color: string;
  name: string | null;
}

/**
 * Number of concentric rows for a hemiciclo of `totalSeats`. Scales with the
 * council size; fewer than 4 rows reads as a sparse double arc, so 4 is the
 * floor (Spanish municipal councils here range 25–57 seats).
 */
export function seatRows(totalSeats: number): number {
  return Math.min(6, Math.max(4, Math.ceil(totalSeats / 14)));
}

/**
 * Computes SVG dot positions for a multi-row hemiciclo.
 * Algorithm mirrors poli_sci_kit: rows sit at evenly spaced radii, each row
 * holds seats proportional to its arc length (largest-remainder rounding);
 * dots are sorted left-to-right by angle then inner-before-outer so parties
 * fill the arc contiguously.
 */
export function buildSemicircleLayout(
  allocations: PartyAllocation[],
  cx: number,
  cy: number,
  rInner: number,
  rOuter: number,
): SeatDot[] {
  const totalSeats = allocations.reduce((sum, a) => sum + a.councilors, 0);
  if (totalSeats === 0) return [];

  // Seat parties left → right by ideology (ties: bigger party first)
  const ordered = [...allocations].sort(
    (a, b) =>
      getPartyIdeology(a.party) - getPartyIdeology(b.party) ||
      b.councilors - a.councilors,
  );

  const rows = seatRows(totalSeats);
  const radii = Array.from(
    { length: rows },
    (_, i) => rInner + (i * (rOuter - rInner)) / (rows - 1),
  );

  // Seats per row proportional to arc length, largest-remainder rounding
  // (outer rows win ties so counts never decrease outward).
  const sumRadii = radii.reduce((s, r) => s + r, 0);
  const quotas = radii.map(r => (totalSeats * r) / sumRadii);
  const seatsPerRow = quotas.map(Math.floor);
  const byRemainder = quotas
    .map((q, i) => ({ frac: q - Math.floor(q), i }))
    .sort((a, b) => b.frac - a.frac || b.i - a.i);
  const remaining = totalSeats - seatsPerRow.reduce((s, n) => s + n, 0);
  for (let k = 0; k < remaining; k++) seatsPerRow[byRemainder[k].i] += 1;

  const arcAngles = (n: number): number[] =>
    n === 1
      ? [Math.PI / 2]
      : Array.from({ length: n }, (_, i) => Math.PI - (i * Math.PI) / (n - 1));

  const positions: { theta: number; row: number; x: number; y: number }[] = [];

  radii.forEach((radius, row) => {
    for (const theta of arcAngles(seatsPerRow[row])) {
      positions.push({ theta, row, x: cx + radius * Math.cos(theta), y: cy - radius * Math.sin(theta) });
    }
  });

  // Sort left-to-right (theta desc = π→0), inner before outer at same angle
  positions.sort((a, b) => b.theta - a.theta || a.row - b.row);

  // Expand party labels in ideological order → contiguous left-to-right wedges
  const labels: { party: string; color: string; name: string | null }[] = [];
  for (const alloc of ordered) {
    const color = getPartyColor(alloc.party);
    for (let i = 0; i < alloc.councilors; i++) {
      labels.push({ party: alloc.party, color, name: alloc.names?.[i] ?? null });
    }
  }

  return positions.map((pos, i) => ({
    x: pos.x,
    y: pos.y,
    party: labels[i].party,
    color: labels[i].color,
    name: labels[i].name,
  }));
}

// ── React component ───────────────────────────────────────────────────────────

interface ElectoralSemicircleProps {
  elections: ElectionResult[];
  councilors?: CouncilorRecord[];
  selectedYear?: number;
  title?: string;
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  name: string | null;
  party: string;
  councilors: number;
  votes: number | null;
}

const CARD_CLASS = 'rounded-2xl border bg-white/80 backdrop-blur-sm p-5 transition-all hover:bg-white/90';
const CARD_STYLE = { borderColor: 'rgba(0,0,0,0.08)', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' };

export const ElectoralSemicircle: React.FC<ElectoralSemicircleProps> = ({
  elections,
  councilors = [],
  selectedYear,
  title = 'Composición del pleno',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false, x: 0, y: 0, name: null, party: '', councilors: 0, votes: null,
  });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      if (entries[0]) setWidth(entries[0].contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Pick the most recent election year ≤ selectedYear (falls back to overall latest)
  const { year, allocations } = useMemo(() => {
    if (elections.length === 0) return { year: null, allocations: [] };
    const allYears = [...new Set(elections.map(e => e.year))].sort((a, b) => a - b);
    const eligibleYears = selectedYear && selectedYear > 0
      ? allYears.filter(y => y <= selectedYear)
      : allYears;
    const latestYear = eligibleYears.length > 0
      ? eligibleYears[eligibleYears.length - 1]
      : allYears[allYears.length - 1];
    const yearData = elections.filter(e => e.year === latestYear && (e.councilors ?? 0) > 0);
    // Sort left → right by ideology so legend order matches the arc
    yearData.sort((a, b) =>
      getPartyIdeology(a.party) - getPartyIdeology(b.party) ||
      (b.councilors ?? 0) - (a.councilors ?? 0));
    const namesByParty = new Map<string, string[]>();
    for (const c of councilors) {
      if (c.year !== latestYear) continue;
      const list = namesByParty.get(c.party) ?? [];
      list.push(c.name);
      namesByParty.set(c.party, list);
    }
    return {
      year: latestYear,
      allocations: yearData.map(e => ({
        party: e.party,
        councilors: e.councilors ?? 0,
        votes: e.votes,
        names: namesByParty.get(e.party),
      })),
    };
  }, [elections, councilors, selectedYear]);

  const svgHeight = Math.round(width * 0.52);
  const cx = width / 2;
  const cy = svgHeight;
  const rOuter = width * 0.43;
  const rInner = width * 0.27;

  const dots = useMemo(
    () => (width > 0 ? buildSemicircleLayout(allocations, cx, cy, rInner, rOuter) : []),
    [allocations, width, cx, cy, rInner, rOuter],
  );

  const dotRadius = useMemo(() => {
    if (dots.length < 2 || width === 0) return 6;
    // Size dots from the closest pair so neighbours never overlap,
    // whatever the row count.
    let minDistSq = Infinity;
    for (let i = 0; i < dots.length; i++) {
      for (let j = i + 1; j < dots.length; j++) {
        const d = (dots[i].x - dots[j].x) ** 2 + (dots[i].y - dots[j].y) ** 2;
        if (d < minDistSq) minDistSq = d;
      }
    }
    return Math.min(8, Math.max(3, Math.sqrt(minDistSq) * 0.42));
  }, [dots, width]);

  const totalSeats = allocations.reduce((s, a) => s + a.councilors, 0);

  const handleMouseEnter = (e: React.MouseEvent<SVGCircleElement>, dot: SeatDot, alloc: PartyAllocation) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip({
      visible: true,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      name: dot.name,
      party: dot.party,
      councilors: alloc.councilors,
      votes: alloc.votes,
    });
  };

  const handleMouseMove = (e: React.MouseEvent<SVGCircleElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip(prev => ({ ...prev, x: e.clientX - rect.left, y: e.clientY - rect.top }));
  };

  if (allocations.length === 0) {
    return (
      <div className={CARD_CLASS} style={CARD_STYLE}>
        <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest mb-3">{title}</h3>
        <p className="text-sm text-gray-400">No hay datos electorales disponibles.</p>
      </div>
    );
  }

  // Build lookup for tooltip data by party
  const allocByParty = Object.fromEntries(allocations.map(a => [a.party, a]));

  return (
    <div className={`${CARD_CLASS} flex flex-col`} style={CARD_STYLE}>
      <div className="mb-2">
        <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest">{title}</h3>
        {year && (
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tight mt-0.5">
            {totalSeats} concejales · Elecciones municipales {year}
          </p>
        )}
      </div>

      <div ref={containerRef} className="relative" style={{ height: svgHeight > 0 ? svgHeight : 120 }}>
        {width > 0 && (
          <svg width={width} height={svgHeight} style={{ display: 'block', overflow: 'visible' }}>
            {/* Baseline */}
            <line x1={0} y1={cy} x2={width} y2={cy} stroke="#f3f4f6" strokeWidth={2} />

            {dots.map((dot, i) => (
              <circle
                key={i}
                cx={dot.x}
                cy={dot.y}
                r={dotRadius}
                fill={dot.color}
                fillOpacity={0.92}
                stroke="white"
                strokeWidth={1}
                className="transition-all hover:fill-opacity-100"
                style={{ cursor: 'pointer' }}
                onMouseEnter={e => handleMouseEnter(e, dot, allocByParty[dot.party]!)}
                onMouseMove={handleMouseMove}
                onMouseLeave={() => setTooltip(prev => ({ ...prev, visible: false }))}
              />
            ))}
          </svg>
        )}

        {/* Tooltip */}
        {tooltip.visible && (
          <div
            className="absolute z-[100] pointer-events-none bg-white/95 backdrop-blur-md border border-black/5 rounded-xl shadow-xl p-3 flex flex-col gap-1 min-w-[160px]"
            style={{ left: Math.min(tooltip.x + 12, width - 172), top: tooltip.y - 12, transform: 'translateY(-50%)' }}
          >
            {tooltip.name && (
              <span className="text-xs font-bold text-gray-800 leading-tight">{tooltip.name}</span>
            )}
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: getPartyColor(tooltip.party) }} />
              <span className={`text-xs leading-tight ${tooltip.name ? 'font-medium text-gray-500' : 'font-bold text-gray-800'}`}>{tooltip.party}</span>
            </div>
            <div className="h-px bg-black/5 my-0.5" />
            <div className="text-[11px] font-medium text-gray-600">
              {tooltip.councilors} concejal{tooltip.councilors !== 1 ? 'es' : ''}
            </div>
            {tooltip.votes != null && (
              <div className="text-[10px] text-gray-400 font-medium">
                {fmtInt(tooltip.votes)} votos
              </div>
            )}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-3">
        {allocations.map(alloc => (
          <span key={alloc.party} className="flex items-center gap-1.5 text-[10px] font-bold text-gray-600">
            <span
              className="inline-block rounded-full flex-shrink-0"
              style={{ width: 8, height: 8, backgroundColor: getPartyColor(alloc.party) }}
            />
            {alloc.party} · {alloc.councilors}
          </span>
        ))}
      </div>
    </div>
  );
};

export default ElectoralSemicircle;
