import React, { useRef, useState, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { HelpCircle, X } from 'lucide-react';
import { scaleTime } from 'd3-scale';
import { timeFormat } from 'd3-time-format';
import type { MayorTerm } from '../../../services/api';
import { getPartyColor } from '../../../constants/parties';

interface MayorsGanttChartProps {
  terms: MayorTerm[];
  title?: string;
  subtitle?: string;
  helpContent?: ReactNode;
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

const BAR_HEIGHT = 16;
const LABEL_HEIGHT = 34;
const ROW_GAP = 12;
const AXIS_HEIGHT = 28;
const PADDING_TOP = 8;
const SLANT = 10;

const ROW_UNIT = LABEL_HEIGHT + BAR_HEIGHT;
const TOTAL_ROWS_HEIGHT = ROW_UNIT * 2 + ROW_GAP;
const CHART_HEIGHT = PADDING_TOP + TOTAL_ROWS_HEIGHT + AXIS_HEIGHT;

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
  helpContent,
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
  const [showHelp, setShowHelp] = useState(false);
  const helpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHelpTimer = () => { if (helpTimerRef.current) { clearTimeout(helpTimerRef.current); helpTimerRef.current = null; } };
  const handleHelpMouseEnter = () => clearHelpTimer();
  const handleHelpMouseLeave = () => { if (showHelp) helpTimerRef.current = setTimeout(() => setShowHelp(false), 5000); };
  useEffect(() => () => { if (helpTimerRef.current) clearTimeout(helpTimerRef.current); }, []);

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

  const { minDate, maxDate, xScale } = useMemo(() => {
    if (terms.length === 0 || width === 0) {
      return { minDate: new Date(), maxDate: new Date(), xScale: null };
    }

    const allStarts = terms.map(t => parseDate(t.start_date));
    const allEnds = terms.map(t => parseDate(t.end_date));

    const min = allStarts.reduce((a, b) => (a < b ? a : b));
    const max = allEnds.reduce((a, b) => (a > b ? a : b));

    const scale = scaleTime().domain([min, max]).range([0, width]);

    return { minDate: min, maxDate: max, xScale: scale };
  }, [terms, width]);

  const yearTicks = useMemo(() => {
    if (!xScale || width === 0) return [];
    const startYear = minDate.getFullYear();
    const endYear = maxDate.getFullYear();
    const totalYears = endYear - startYear;

    // Pick the smallest "nice" step that keeps labels from overlapping.
    // Year labels ("2026") are ~32px wide; target 7–10 visible ticks max.
    const LABEL_PX = 32;
    const maxTicks = Math.max(2, Math.floor(width / LABEL_PX));
    const rawStep = totalYears / maxTicks;
    const niceSteps = [1, 2, 5, 10, 25, 50];
    const step = niceSteps.find(s => s >= rawStep) ?? 50;

    const ticks: Date[] = [];
    const firstTick = Math.ceil(startYear / step) * step;
    for (let y = firstTick; y <= endYear; y += step) {
      ticks.push(new Date(y, 0, 1));
    }
    return ticks;
  }, [minDate, maxDate, xScale, width]);

  const handleMouseEnter = (
    e: React.MouseEvent<SVGPolygonElement>,
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

  const handleMouseMove = (e: React.MouseEvent<SVGPolygonElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip(prev => ({
      ...prev,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }));
  };

  const cardClass = "rounded-2xl border bg-white/80 backdrop-blur-sm p-5 transition-all hover:bg-white/90";
  const cardStyle = { borderColor: 'rgba(0,0,0,0.08)', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' };

  if (terms.length === 0) {
    return (
      <div className={cardClass} style={cardStyle}>
        <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest mb-3">{title}</h3>
        <p className="text-sm text-gray-400">No hay datos de alcaldía disponibles.</p>
      </div>
    );
  }

  return (
    <div
      className={`${cardClass} flex flex-col h-full`}
      style={cardStyle}
      onMouseEnter={handleHelpMouseEnter}
      onMouseLeave={handleHelpMouseLeave}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest">{title}</h3>
          {subtitle && (
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tight mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
        {helpContent && (
          <button
            onClick={() => { clearHelpTimer(); setShowHelp(v => !v); }}
            className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 transition-all bg-black/5 hover:bg-black/10 text-gray-400 hover:text-gray-600"
            aria-label={showHelp ? 'Cerrar ayuda' : 'Mostrar ayuda'}
          >
            {showHelp ? <X className="w-3.5 h-3.5" /> : <HelpCircle className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      <div ref={containerRef} className="flex-1 relative" style={{ minHeight: CHART_HEIGHT }}>
        {width > 0 && xScale && (
          <svg width={width} height={CHART_HEIGHT} style={{ display: 'block', overflow: 'hidden' }}>
            <defs>
              {terms.map((term, i) => {
                const x = xScale(parseDate(term.start_date));
                const row = i % 2;
                const barY = PADDING_TOP + row * (ROW_UNIT + ROW_GAP) + LABEL_HEIGHT;
                const nextSameRow = terms.find((_, j) => j > i && j % 2 === row);
                const clipRight = nextSameRow
                  ? xScale(parseDate(nextSameRow.start_date)) - 4
                  : width - 8;
                const labelX = x + SLANT;
                return (
                  <clipPath key={`clip-${i}`} id={`mayor-label-clip-${i}`}>
                    <rect
                      x={labelX}
                      y={barY - LABEL_HEIGHT}
                      width={Math.max(clipRight - labelX, 0)}
                      height={LABEL_HEIGHT}
                    />
                  </clipPath>
                );
              })}
            </defs>

            {/* Year Grid Lines */}
            {yearTicks.map((tick, i) => {
              const x = xScale(tick);
              return (
                <line
                  key={`grid-${i}`}
                  x1={x}
                  y1={PADDING_TOP}
                  x2={x}
                  y2={PADDING_TOP + TOTAL_ROWS_HEIGHT}
                  stroke="#f3f4f6"
                  strokeWidth={1}
                />
              );
            })}

            {/* Bars and Labels */}
            {terms.map((term, i) => {
              const startDate = parseDate(term.start_date);
              const endDate = parseDate(term.end_date);
              const isCurrent = term.end_date === null;

              const x = xScale(startDate);
              const barEndX = xScale(endDate);
              const barWidth = Math.max(barEndX - x, SLANT + 4);

              const row = i % 2;
              const barY = PADDING_TOP + row * (ROW_UNIT + ROW_GAP) + LABEL_HEIGHT;
              const labelNameY = barY - LABEL_HEIGHT + 14;
              const labelPartyY = barY - LABEL_HEIGHT + 26;

              const color = getPartyColor(term.party);

              // Available label width: to next same-row term or SVG right edge
              const nextSameRow = terms.find((_, j) => j > i && j % 2 === row);
              const clipRight = nextSameRow
                ? xScale(parseDate(nextSameRow.start_date)) - 4
                : width - 8;
              const availWidth = Math.max(clipRight - (x + SLANT), 0);

              // Truncate with ellipsis based on approximate char widths
              const truncate = (text: string, pxPerChar: number) => {
                const max = Math.floor(availWidth / pxPerChar);
                return text.length > max && max > 3 ? text.slice(0, max - 2) + '…' : text;
              };
              const displayName = truncate(term.name, 6.5);
              const displayParty = truncate(term.party ?? '—', 5.5);

              // Parallelogram: top edge offset right by SLANT, bottom edge aligned left
              const poly = [
                `${x + SLANT},${barY}`,
                `${x + barWidth},${barY}`,
                `${x + barWidth - SLANT},${barY + BAR_HEIGHT}`,
                `${x},${barY + BAR_HEIGHT}`,
              ].join(' ');

              return (
                <g key={`${term.name}-${i}`}>
                  {/* Labels clipped to bar width */}
                  <g clipPath={`url(#mayor-label-clip-${i})`}>
                    <text
                      x={x + SLANT}
                      y={labelNameY}
                      fontSize={10}
                      fontWeight="800"
                      fill="#1f2937"
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >
                      {displayName}
                    </text>
                    <text
                      x={x + SLANT}
                      y={labelPartyY}
                      fontSize={9}
                      fontWeight="700"
                      fill={color}
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >
                      {displayParty}
                    </text>
                  </g>

                  {/* Parallelogram bar */}
                  <polygon
                    points={poly}
                    fill={color}
                    fillOpacity={0.82}
                    onMouseEnter={e => handleMouseEnter(e, term)}
                    onMouseMove={handleMouseMove}
                    onMouseLeave={() => setTooltip(prev => ({ ...prev, visible: false }))}
                    className="transition-all hover:fill-opacity-100"
                    style={{ cursor: 'pointer' }}
                  />

                  {isCurrent && (
                    <rect
                      x={x + barWidth - SLANT - 5}
                      y={barY + 2}
                      width={3}
                      height={BAR_HEIGHT - 4}
                      fill="#fff"
                      fillOpacity={0.6}
                      rx={1}
                      className="animate-pulse"
                    />
                  )}
                </g>
              );
            })}

            {/* X-axis year ticks */}
            <g transform={`translate(0, ${PADDING_TOP + TOTAL_ROWS_HEIGHT + 8})`}>
              {yearTicks.map((tick, i) => {
                const x = xScale(tick);
                return (
                  <g key={`axis-${i}`} transform={`translate(${x}, 0)`}>
                    <text
                      y={14}
                      textAnchor="middle"
                      fontSize={10}
                      fontWeight="900"
                      fill="#9ca3af"
                      className="uppercase tracking-tighter"
                    >
                      {formatYear(tick)}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        )}

        {/* Tooltip */}
        {tooltip.visible && (
          <div
            className="absolute z-[100] pointer-events-none bg-white/95 backdrop-blur-md border border-black/5 rounded-xl shadow-xl p-3 flex flex-col gap-1 min-w-[200px]"
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

      {/* Expandable help section */}
      {helpContent && showHelp && (
        <>
          <div className="border-t border-black/10 mt-4" />
          <div className="text-[11px] leading-relaxed text-gray-500 mt-3">
            {helpContent}
          </div>
        </>
      )}
    </div>
  );
};

export default MayorsGanttChart;
