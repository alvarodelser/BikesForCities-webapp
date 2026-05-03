import React, { useRef, useState, useEffect, useMemo } from 'react';
import { scaleTime } from 'd3-scale';
import { timeFormat } from 'd3-time-format';
import type { MayorTerm } from '../../../services/api';
import { getPartyColor } from '../../../constants/parties';
import GlassCard from '../../ui/GlassCard';

interface MayorsGanttChartProps {
  terms: MayorTerm[];
  title?: string;
  subtitle?: string;
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  name: string;
  party: string | null;
  start: string | null;
  end: string | null;
}

const BAR_HEIGHT = 40;
const BAR_GAP = 12;
const AXIS_HEIGHT = 30;
const PADDING_TOP = 10;

function parseDate(s: string | null): Date {
  if (!s) return new Date();
  return new Date(s);
}

const formatYear = timeFormat('%Y');
const formatDate = timeFormat('%b %Y');

export const MayorsGanttChart: React.FC<MayorsGanttChartProps> = ({
  terms,
  title = 'Historial de Alcaldía',
  subtitle,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    name: '',
    party: null,
    start: null,
    end: null,
  });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      if (entries[0]) {
        setWidth(entries[0].contentRect.width);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { minDate, maxDate, chartHeight, xScale } = useMemo(() => {
    if (terms.length === 0 || width === 0) {
      return { minDate: new Date(), maxDate: new Date(), chartHeight: 0, xScale: null };
    }

    const allStarts = terms.map(t => parseDate(t.start_date));
    const allEnds = terms.map(t => parseDate(t.end_date));

    const min = allStarts.reduce((a, b) => (a < b ? a : b));
    const max = allEnds.reduce((a, b) => (a > b ? a : b));

    const h = terms.length * (BAR_HEIGHT + BAR_GAP) + AXIS_HEIGHT + PADDING_TOP;
    const scale = scaleTime().domain([min, max]).range([0, width]);

    return { minDate: min, maxDate: max, chartHeight: h, xScale: scale };
  }, [terms, width]);

  const yearTicks = useMemo(() => {
    if (!xScale) return [];
    const startYear = minDate.getFullYear();
    const endYear = maxDate.getFullYear();
    const ticks: Date[] = [];
    for (let y = startYear; y <= endYear; y++) {
      ticks.push(new Date(y, 0, 1));
    }
    return ticks;
  }, [minDate, maxDate, xScale]);

  const handleMouseEnter = (
    e: React.MouseEvent<SVGRectElement>,
    term: MayorTerm,
  ) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip({
      visible: true,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      name: term.name,
      party: term.party,
      start: term.start_date,
      end: term.end_date,
    });
  };

  const handleMouseMove = (e: React.MouseEvent<SVGRectElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip(prev => ({
      ...prev,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }));
  };

  if (terms.length === 0) {
    return (
      <GlassCard>
        <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest mb-3">{title}</h3>
        <p className="text-sm text-gray-400">No hay datos de alcaldía disponibles.</p>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="flex flex-col h-full">
      <div className="mb-6">
        <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest">{title}</h3>
        {subtitle && (
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tight mt-0.5">
            {subtitle}
          </p>
        )}
      </div>

      <div ref={containerRef} className="flex-1 relative min-h-[300px]">
        {width > 0 && xScale && (
          <svg width={width} height={chartHeight} style={{ display: 'block', overflow: 'visible' }}>
            <g transform={`translate(0, ${PADDING_TOP})`}>
              {/* Year Grid Lines */}
              {yearTicks.map((tick, i) => {
                const x = xScale(tick);
                return (
                  <line
                    key={`grid-${i}`}
                    x1={x}
                    y1={0}
                    x2={x}
                    y2={terms.length * (BAR_HEIGHT + BAR_GAP)}
                    stroke="#f3f4f6"
                    strokeWidth={1}
                  />
                );
              })}

              {/* Bars */}
              {terms.map((term, i) => {
                const startDate = parseDate(term.start_date);
                const endDate = parseDate(term.end_date);
                const isCurrent = term.end_date === null;

                const x = xScale(startDate);
                const barEndX = xScale(endDate);
                const barWidth = Math.max(barEndX - x, 4);
                const y = i * (BAR_HEIGHT + BAR_GAP);

                const color = getPartyColor(term.party);
                const label = `${term.name}${term.party ? ` (${term.party})` : ''}`;

                return (
                  <g key={`${term.name}-${i}`}>
                    <rect
                      x={x}
                      y={y}
                      width={barWidth}
                      height={BAR_HEIGHT}
                      fill={color}
                      fillOpacity={0.8}
                      rx={8}
                      onMouseEnter={e => handleMouseEnter(e, term)}
                      onMouseMove={handleMouseMove}
                      onMouseLeave={() => setTooltip(prev => ({ ...prev, visible: false }))}
                      className="transition-all hover:fill-opacity-100"
                      style={{ cursor: 'pointer' }}
                    />

                    {isCurrent && (
                      <rect
                        x={x + barWidth - 4}
                        y={y}
                        width={4}
                        height={BAR_HEIGHT}
                        fill={color}
                        rx={2}
                        className="animate-pulse"
                      />
                    )}

                    {barWidth > 100 && (
                      <text
                        x={x + 12}
                        y={y + BAR_HEIGHT / 2 + 1}
                        dominantBaseline="middle"
                        fontSize={11}
                        fontWeight="bold"
                        fill="#fff"
                        style={{ pointerEvents: 'none', userSelect: 'none' }}
                      >
                        {label.length > Math.floor(barWidth / 8)
                          ? label.slice(0, Math.floor(barWidth / 8) - 1) + '…'
                          : label}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* X-axis ticks */}
              <g transform={`translate(0, ${terms.length * (BAR_HEIGHT + BAR_GAP) + 8})`}>
                {yearTicks.map((tick, i) => {
                  const x = xScale(tick);
                  return (
                    <g key={`axis-${i}`} transform={`translate(${x}, 0)`}>
                      <text
                        y={14}
                        textAnchor="middle"
                        fontSize={10}
                        fontWeight="black"
                        fill="#9ca3af"
                        className="uppercase tracking-tighter"
                      >
                        {formatYear(tick)}
                      </text>
                    </g>
                  );
                })}
              </g>
            </g>
          </svg>
        )}

        {/* Premium Tooltip */}
        {tooltip.visible && (
          <div
            className="fixed z-[100] pointer-events-none bg-white/95 backdrop-blur-md border border-black/5 rounded-xl shadow-xl p-3 flex flex-col gap-1 min-w-[200px]"
            style={{
              left: tooltip.x + 15,
              top: tooltip.y - 15,
              transform: 'translateY(-50%)',
            }}
          >
            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">
              Mandato Municipal
            </div>
            <div className="text-xs font-bold text-gray-800 leading-tight">
              {tooltip.name}
            </div>
            {tooltip.party && (
              <div className="flex items-center gap-1.5 mt-0.5">
                <div 
                  className="w-2 h-2 rounded-full" 
                  style={{ backgroundColor: getPartyColor(tooltip.party) }}
                />
                <span className="text-[10px] font-bold text-gray-500">
                  {tooltip.party}
                </span>
              </div>
            )}
            <div className="h-px bg-black/5 my-1" />
            <div className="text-[11px] font-medium text-gray-600 flex items-center justify-between">
              <span>{tooltip.start ? formatDate(parseDate(tooltip.start)) : '?'}</span>
              <span className="text-gray-300">→</span>
              <span>{tooltip.end ? formatDate(parseDate(tooltip.end)) : 'Actualidad'}</span>
            </div>
          </div>
        )}
      </div>
    </GlassCard>
  );
};

export default MayorsGanttChart;


export default MayorsGanttChart;
