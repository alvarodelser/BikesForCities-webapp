// frontend/src/components/city/plots/ElectoralSemicircle.tsx
import React, { useRef, useState, useEffect, useMemo } from 'react';
import type { ElectionResult } from '../../../services/api';
import { getPartyColor } from '../../../constants/parties';
import { fmtInt } from '../../../utils/formatters';

export interface PartyAllocation {
  party: string;
  councilors: number;
  votes: number | null;
}

export interface SeatDot {
  x: number;
  y: number;
  party: string;
  color: string;
}

/**
 * Computes SVG dot positions for a two-row hemiciclo.
 * Algorithm mirrors poli_sci_kit: inner row gets fewer seats, outer more;
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

  const base = Math.floor(totalSeats / 2);
  const seatsInner = Math.max(1, base - 1);
  const seatsOuter = totalSeats - seatsInner;

  const arcAngles = (n: number): number[] =>
    n === 1
      ? [Math.PI / 2]
      : Array.from({ length: n }, (_, i) => Math.PI - (i * Math.PI) / (n - 1));

  const positions: { theta: number; row: number; x: number; y: number }[] = [];

  for (const theta of arcAngles(seatsInner)) {
    positions.push({ theta, row: 0, x: cx + rInner * Math.cos(theta), y: cy - rInner * Math.sin(theta) });
  }
  for (const theta of arcAngles(seatsOuter)) {
    positions.push({ theta, row: 1, x: cx + rOuter * Math.cos(theta), y: cy - rOuter * Math.sin(theta) });
  }

  // Sort left-to-right (theta desc = π→0), inner before outer at same angle
  positions.sort((a, b) => b.theta - a.theta || a.row - b.row);

  // Expand party labels in order (biggest party first → fills left side)
  const labels: { party: string; color: string }[] = [];
  for (const alloc of allocations) {
    for (let i = 0; i < alloc.councilors; i++) {
      labels.push({ party: alloc.party, color: getPartyColor(alloc.party) });
    }
  }

  return positions.map((pos, i) => ({
    x: pos.x,
    y: pos.y,
    party: labels[i].party,
    color: labels[i].color,
  }));
}

// ── React component ───────────────────────────────────────────────────────────

interface ElectoralSemicircleProps {
  elections: ElectionResult[];
  selectedYear?: number;
  title?: string;
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  party: string;
  councilors: number;
  votes: number | null;
}

const CARD_CLASS = 'rounded-2xl border bg-white/80 backdrop-blur-sm p-5 transition-all hover:bg-white/90';
const CARD_STYLE = { borderColor: 'rgba(0,0,0,0.08)', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' };

export const ElectoralSemicircle: React.FC<ElectoralSemicircleProps> = ({
  elections,
  selectedYear,
  title = 'Composición del pleno',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false, x: 0, y: 0, party: '', councilors: 0, votes: null,
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
    yearData.sort((a, b) => (b.councilors ?? 0) - (a.councilors ?? 0));
    return {
      year: latestYear,
      allocations: yearData.map(e => ({
        party: e.party,
        councilors: e.councilors ?? 0,
        votes: e.votes,
      })),
    };
  }, [elections]);

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
    if (dots.length === 0 || width === 0) return 6;
    const outerArcLen = Math.PI * rOuter;
    const outerCount = dots.filter(d => {
      const r = Math.sqrt((d.x - cx) ** 2 + (d.y - cy) ** 2);
      return r > (rInner + rOuter) / 2;
    }).length;
    return Math.min(8, Math.max(3, (outerArcLen / (outerCount || 1)) * 0.38));
  }, [dots, width, rInner, rOuter, cx, cy]);

  const totalSeats = allocations.reduce((s, a) => s + a.councilors, 0);

  const handleMouseEnter = (e: React.MouseEvent<SVGCircleElement>, dot: SeatDot, alloc: PartyAllocation) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip({
      visible: true,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
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
                fillOpacity={0.88}
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
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: getPartyColor(tooltip.party) }} />
              <span className="text-xs font-bold text-gray-800 leading-tight">{tooltip.party}</span>
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
