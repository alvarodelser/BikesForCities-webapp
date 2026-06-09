import React, { useRef, useState, useEffect, useMemo } from 'react';
import { scaleBand, scaleLinear } from 'd3-scale';
import type { BudgetYear } from '../../../services/api';

export interface DeltaDatum {
  code: string;
  name: string;
  planned: number;
  executed: number;
  delta: number;
  deltaPct: number | null;
}

export function buildDeltaData(budgetYear: BudgetYear): DeltaDatum[] {
  const { lines } = budgetYear;
  if (lines.length === 0) return [];

  // Guard: need BOTH planned and executed to show a meaningful comparison
  const hasPlanned = lines.some(l => l.budget_type === 'planned');
  const hasExecuted = lines.some(l => l.budget_type === 'executed');
  if (!hasPlanned || !hasExecuted) return [];

  const minLen = Math.min(...lines.map(l => l.category_code.length));
  const topLines = lines.filter(l => l.category_code.length === minLen);

  const planned = new Map<string, { name: string; amount: number }>();
  const executed = new Map<string, { name: string; amount: number }>();

  for (const line of topLines) {
    const map = line.budget_type === 'planned' ? planned : line.budget_type === 'executed' ? executed : null;
    if (!map) continue;
    const existing = map.get(line.category_code);
    map.set(line.category_code, {
      name: line.category_name ?? line.category_code,
      amount: (existing?.amount ?? 0) + line.amount,
    });
  }

  const codes = new Set([...planned.keys(), ...executed.keys()]);
  return Array.from(codes)
    .map(code => {
      const p = planned.get(code)?.amount ?? 0;
      const e = executed.get(code)?.amount ?? 0;
      const delta = e - p;
      const deltaPct = p !== 0 ? (delta / p) * 100 : null;
      const name = planned.get(code)?.name ?? executed.get(code)?.name ?? code;
      return { code, name, planned: p, executed: e, delta, deltaPct };
    })
    .filter(d => d.planned > 0 || d.executed > 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

function formatDelta(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '+';
  if (abs >= 1_000_000) return `${sign}€${(abs / 1_000_000).toFixed(1)} M`;
  if (abs >= 1_000) return `${sign}€${(abs / 1_000).toFixed(0)} K`;
  return `${sign}€${abs.toFixed(0)}`;
}

function formatEur(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) return `€${(amount / 1_000_000).toFixed(1)} M`;
  if (abs >= 1_000) return `€${(amount / 1_000).toFixed(0)} K`;
  return `€${amount.toFixed(0)}`;
}

const MARGIN = { top: 24, right: 16, bottom: 80, left: 64 };
const CHART_HEIGHT = 300;

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  datum: DeltaDatum | null;
}

interface BudgetDeltaChartProps {
  budgetYear: BudgetYear;
  title?: string;
  subtitle?: string;
}

export const BudgetDeltaChart: React.FC<BudgetDeltaChartProps> = ({
  budgetYear,
  title = 'Ejecución presupuestaria',
  subtitle,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [tooltip, setTooltip] = useState<TooltipState>({ visible: false, x: 0, y: 0, datum: null });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      if (entries[0]) setWidth(entries[0].contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const data = useMemo(() => buildDeltaData(budgetYear), [budgetYear]);

  const innerWidth = Math.max(width - MARGIN.left - MARGIN.right, 0);
  const innerHeight = CHART_HEIGHT - MARGIN.top - MARGIN.bottom;

  const xScale = useMemo(
    () => scaleBand<string>().domain(data.map(d => d.code)).range([0, innerWidth]).padding(0.3),
    [data, innerWidth],
  );

  const yMax = useMemo(
    () => (data.length > 0 ? Math.max(...data.map(d => Math.abs(d.delta))) * 1.15 : 1),
    [data],
  );

  const yScale = useMemo(
    () => scaleLinear().domain([-yMax, yMax]).range([innerHeight, 0]).nice(),
    [yMax, innerHeight],
  );

  const cardClass = 'rounded-2xl border bg-white/80 backdrop-blur-sm p-5 transition-all hover:bg-white/90';
  const cardStyle = { borderColor: 'rgba(0,0,0,0.08)', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' };

  if (data.length === 0) {
    return (
      <div className={cardClass} style={cardStyle}>
        <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest mb-3">{title}</h3>
        <p className="text-sm text-gray-400">No hay datos comparables para este año.</p>
      </div>
    );
  }

  const zeroY = yScale(0);
  const yTicks = yScale.ticks(5);

  const handleMouseEnter = (e: React.MouseEvent<SVGRectElement>, datum: DeltaDatum) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip({ visible: true, x: e.clientX - rect.left, y: e.clientY - rect.top, datum });
  };
  const handleMouseMove = (e: React.MouseEvent<SVGRectElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip(prev => ({ ...prev, x: e.clientX - rect.left, y: e.clientY - rect.top }));
  };
  const handleMouseLeave = () => setTooltip(prev => ({ ...prev, visible: false }));

  return (
    <div className={`${cardClass} flex flex-col`} style={cardStyle}>
      <div className="mb-4">
        <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest">{title}</h3>
        {subtitle && (
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tight mt-0.5">{subtitle}</p>
        )}
      </div>

      <div ref={containerRef} className="relative" style={{ height: CHART_HEIGHT }}>
        {width > 0 && (
          <svg width={width} height={CHART_HEIGHT} style={{ display: 'block', overflow: 'visible' }}>
            <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
              {yTicks.map((tick, i) => (
                <g key={i} transform={`translate(0, ${yScale(tick)})`}>
                  <line x1={0} x2={innerWidth} stroke="#f3f4f6" strokeWidth={1} />
                  <text x={-8} textAnchor="end" dominantBaseline="middle" fontSize={9} fontWeight={600} fill="#9ca3af">
                    {formatDelta(tick)}
                  </text>
                </g>
              ))}

              {data.map(d => {
                const x = xScale(d.code) ?? 0;
                const bw = xScale.bandwidth();
                const isPositive = d.delta >= 0;
                const barY = isPositive ? yScale(d.delta) : zeroY;
                const barH = Math.abs(yScale(d.delta) - zeroY);
                const color = isPositive ? 'var(--red, #e74c3c)' : '#3A6C7F';
                return (
                  <rect
                    key={d.code}
                    x={x}
                    y={barY}
                    width={bw}
                    height={Math.max(barH, 1)}
                    fill={color}
                    fillOpacity={0.85}
                    rx={3}
                    onMouseEnter={e => handleMouseEnter(e, d)}
                    onMouseMove={handleMouseMove}
                    onMouseLeave={handleMouseLeave}
                    style={{ cursor: 'pointer' }}
                  />
                );
              })}

              <line x1={0} x2={innerWidth} y1={zeroY} y2={zeroY} stroke="#374151" strokeWidth={1.5} />

              {data.map(d => {
                const x = (xScale(d.code) ?? 0) + xScale.bandwidth() / 2;
                const label = d.name.length > 14 ? d.name.slice(0, 13) + '…' : d.name;
                return (
                  <text
                    key={d.code}
                    x={x}
                    y={innerHeight + 12}
                    textAnchor="end"
                    fontSize={9}
                    fontWeight={600}
                    fill="#6b7280"
                    transform={`rotate(-40, ${x}, ${innerHeight + 12})`}
                    style={{ userSelect: 'none' }}
                  >
                    {label}
                  </text>
                );
              })}
            </g>
          </svg>
        )}

        {tooltip.visible && tooltip.datum && (
          <div
            className="absolute z-[100] pointer-events-none bg-white/95 backdrop-blur-md border border-black/5 rounded-xl shadow-xl p-3 flex flex-col gap-1 min-w-[200px]"
            style={{ left: tooltip.x + 15, top: tooltip.y - 15, transform: 'translateY(-50%)' }}
          >
            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Ejecución</div>
            <div className="text-xs font-bold text-gray-800 leading-tight">{tooltip.datum.name}</div>
            <div className="h-px bg-black/5 my-1" />
            <div className="flex justify-between text-[11px] font-medium text-gray-600">
              <span>Planificado</span><span>{formatEur(tooltip.datum.planned)}</span>
            </div>
            <div className="flex justify-between text-[11px] font-medium text-gray-600">
              <span>Ejecutado</span><span>{formatEur(tooltip.datum.executed)}</span>
            </div>
            <div className="flex justify-between text-[11px] font-bold mt-0.5"
              style={{ color: tooltip.datum.delta >= 0 ? 'var(--red, #e74c3c)' : '#3A6C7F' }}>
              <span>Desviación</span>
              <span>
                {formatDelta(tooltip.datum.delta)}
                {tooltip.datum.deltaPct !== null ? ` (${tooltip.datum.deltaPct.toFixed(1)}%)` : ''}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BudgetDeltaChart;
