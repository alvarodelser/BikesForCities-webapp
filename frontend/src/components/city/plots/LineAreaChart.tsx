// LineAreaChart.tsx
import React, { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import * as d3 from 'd3';
import { HelpCircle, X } from 'lucide-react';
import { fmtMonth, fmtInt } from '../../../utils/formatters';

interface Series {
  key: string;
  label: string;
  color: string;
  type?: 'line' | 'area';
  axis?: 'primary' | 'secondary';
  dashed?: boolean;
}

interface LineAreaChartProps {
  data: Record<string, any>[];
  xKey: string;
  series: Series[];
  title: string;
  subtitle?: string;
  helpContent?: ReactNode;
  variant?: 'light' | 'darkTint';
  accent?: string;
}

export const LineAreaChart: React.FC<LineAreaChartProps> = ({
  data,
  xKey,
  series,
  title,
  subtitle,
  helpContent,
  variant = 'light',
  accent = '#3b82f6',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => { if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; } };
  const handleMouseLeave = () => { if (showHelp) timerRef.current = setTimeout(() => setShowHelp(false), 5000); };
  const handleMouseEnter = () => clearTimer();
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      if (entries[0]) setWidth(entries[0].contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || !data.length || width === 0) return;

    const isDarkTint = variant === 'darkTint';
    const axisColor = isDarkTint ? 'var(--blue-dark)' : '#6b7280';
    const gridColor = isDarkTint ? 'rgba(0,0,0,0.05)' : 'rgba(0,0,0,0.05)';

    const height = 260;
    const margin = { top: 20, right: series.some(s => s.axis === 'secondary') ? 50 : 20, bottom: 30, left: 50 };

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('width', width).attr('height', height);

    const x = d3.scalePoint()
      .domain(data.map(d => d[xKey]))
      .range([margin.left, width - margin.right]);

    const yLeft = d3.scaleLinear()
      .domain([0, d3.max(data, d => d3.max(series.filter(s => s.axis !== 'secondary'), s => d[s.key])) as number])
      .nice()
      .range([height - margin.bottom, margin.top]);

    const hasSecondary = series.some(s => s.axis === 'secondary');
    const yRight = hasSecondary
      ? d3.scaleLinear()
          .domain([0, d3.max(data, d => d3.max(series.filter(s => s.axis === 'secondary'), s => d[s.key])) as number])
          .nice()
          .range([height - margin.bottom, margin.top])
      : null;

    // Grid lines
    svg.append('g')
      .attr('class', 'grid')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).tickSize(-(height - margin.top - margin.bottom)).tickFormat(() => ''))
      .call(g => g.select('.domain').remove())
      .selectAll('line')
      .attr('stroke', gridColor);

    svg.append('g')
      .attr('class', 'grid')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(yLeft).tickSize(-(width - margin.left - margin.right)).tickFormat(() => ''))
      .call(g => g.select('.domain').remove())
      .selectAll('line')
      .attr('stroke', gridColor);

    // Width-aware x tick density: ~48px per label minimum, at least 2 ticks.
    // Auto-detect YYYY-MM values and format as "Jun 26".
    const xDomain = data.map(d => d[xKey] as string);
    const isMonthFmt = xDomain.length > 0 && /^\d{4}-\d{2}$/.test(xDomain[0]);
    const maxTicks = Math.max(2, Math.floor((width - margin.left - margin.right) / 48));
    const tickStep = Math.ceil(xDomain.length / maxTicks);
    const xTickValues = xDomain.filter((_, i) => i % tickStep === 0);

    // Axes
    svg.append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(
        d3.axisBottom(x)
          .tickValues(xTickValues)
          .tickFormat(v => isMonthFmt ? fmtMonth(String(v)) : String(v))
      )
      .call(g => g.select('.domain').attr('stroke', 'rgba(0,0,0,0.1)'))
      .selectAll('text')
      .attr('font-size', '10px')
      .attr('fill', axisColor)
      .attr('opacity', isDarkTint ? 0.5 : 1);

    svg.append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(yLeft).ticks(5))
      .call(g => g.select('.domain').remove())
      .selectAll('text')
      .attr('font-size', '10px')
      .attr('fill', axisColor)
      .attr('opacity', isDarkTint ? 0.5 : 1);

    if (yRight) {
      svg.append('g')
        .attr('transform', `translate(${width - margin.right},0)`)
        .call(d3.axisRight(yRight).ticks(5))
        .call(g => g.select('.domain').remove())
        .selectAll('text')
        .attr('font-size', '10px')
        .attr('fill', axisColor)
        .attr('opacity', isDarkTint ? 0.5 : 1);
    }

    // Render series
    series.forEach(s => {
      const yScale = s.axis === 'secondary' ? yRight! : yLeft;

      if (s.type === 'area') {
        const area = d3.area<any>()
          .x(d => x(d[xKey])!)
          .y0(height - margin.bottom)
          .y1(d => yScale(d[s.key]))
          .curve(d3.curveMonotoneX);

        svg.append('path')
          .datum(data)
          .attr('fill', s.color)
          .attr('fill-opacity', 0.15)
          .attr('d', area);
      }

      const line = d3.line<any>()
        .x(d => x(d[xKey])!)
        .y(d => yScale(d[s.key]))
        .curve(d3.curveMonotoneX);

      const path = svg.append('path')
        .datum(data)
        .attr('fill', 'none')
        .attr('stroke', s.color)
        .attr('stroke-width', 2)
        .attr('stroke-linejoin', 'round')
        .attr('stroke-linecap', 'round')
        .attr('d', line);

      if (s.dashed) path.attr('stroke-dasharray', '4,4');
    });

    // Vertical crosshair line (snaps to nearest data point)
    const crosshair = svg.append('line')
      .attr('y1', margin.top)
      .attr('y2', height - margin.bottom)
      .attr('stroke', 'rgba(0,0,0,0.12)')
      .attr('stroke-width', 1)
      .attr('pointer-events', 'none')
      .style('display', 'none');

    // Tooltip
    svg.append('rect')
      .attr('width', width)
      .attr('height', height)
      .attr('fill', 'transparent')
      .on('mousemove', (event) => {
        const [mx, my] = d3.pointer(event);
        const xValues = data.map(d => x(d[xKey])!);
        const i = d3.bisectCenter(xValues, mx);
        const d = data[i];
        const snappedX = xValues[i];

        crosshair
          .style('display', null)
          .attr('x1', snappedX)
          .attr('x2', snappedX);

        if (d && tooltipRef.current && containerRef.current) {
          const containerW = containerRef.current.offsetWidth;
          const tooltipW = tooltipRef.current.offsetWidth || 140;
          const flipLeft = mx + 12 + tooltipW > containerW;
          d3.select(tooltipRef.current)
            .style('display', 'block')
            .style('left', flipLeft ? `${mx - tooltipW - 8}px` : `${mx + 12}px`)
            .style('top', `${Math.max(0, my - 10)}px`)
            .html(`
              <div class="font-bold border-b border-black/10 pb-1 mb-1">${isMonthFmt ? fmtMonth(String(d[xKey])) : d[xKey]}</div>
              ${series.map(s => `
                <div class="flex items-center gap-2">
                  <div class="w-2 h-2 rounded-full" style="background: ${s.color}"></div>
                  <span>${s.label}:</span>
                  <span class="font-bold ml-auto">${d[s.key] != null && typeof d[s.key] === 'number' ? fmtInt(d[s.key] as number) : (d[s.key] != null ? d[s.key] : '—')}</span>
                </div>
              `).join('')}
            `);
        }
      })
      .on('mouseleave', () => {
        crosshair.style('display', 'none');
        if (tooltipRef.current) d3.select(tooltipRef.current).style('display', 'none');
      });

  }, [data, xKey, series, width]);

  return (
    <div
      className={`rounded-2xl border p-5 w-full flex flex-col gap-4 transition-all ${
        variant === 'darkTint'
          ? 'backdrop-blur-md hover:brightness-95'
          : 'bg-white/80 backdrop-blur-sm hover:bg-white/90'
      }`}
      style={{
        borderColor: variant === 'darkTint' ? `color-mix(in srgb, ${accent} 30%, transparent)` : 'rgba(0,0,0,0.08)',
        boxShadow: variant === 'darkTint' ? 'none' : '0 4px 16px rgba(0,0,0,0.04)',
        ...(variant === 'darkTint' ? { backgroundColor: `color-mix(in srgb, ${accent} 15%, transparent)` } : {})
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className={`text-sm font-bold leading-tight ${variant === 'darkTint' ? 'text-[var(--blue-dark)]' : 'text-gray-900'}`}>{title}</h3>
          {subtitle && <p className={`mt-0.5 text-xs ${variant === 'darkTint' ? 'text-[var(--blue-dark)]/70' : 'text-gray-500'}`}>{subtitle}</p>}
        </div>
        {helpContent && (
          <button
            onClick={() => { clearTimer(); setShowHelp(v => !v); }}
            className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${
              variant === 'darkTint'
                ? 'bg-black/5 hover:bg-black/10 text-[var(--blue-dark)]/40 hover:text-[var(--blue-dark)]/70'
                : 'bg-black/5 hover:bg-black/10 text-gray-400 hover:text-gray-600'
            }`}
            aria-label={showHelp ? 'Cerrar ayuda' : 'Mostrar ayuda'}
          >
            {showHelp ? <X className="w-3.5 h-3.5" /> : <HelpCircle className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {/* Chart */}
      <div ref={containerRef} className="w-full relative">
        <svg ref={svgRef}></svg>
        <div
          ref={tooltipRef}
          className="absolute z-20 hidden bg-white/95 backdrop-blur-sm border border-black/10 rounded-lg p-2 shadow-lg text-[11px] min-w-[120px] pointer-events-none text-gray-700"
        ></div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {series.map(s => (
          <div key={s.key} className="flex items-center gap-1.5">
            <div
              className={`h-0.5 w-4 ${s.dashed ? 'border-t-2 border-dashed' : ''}`}
              style={{ borderColor: s.color, backgroundColor: s.dashed ? 'transparent' : s.color }}
            />
            <span className={`text-[10px] font-medium ${variant === 'darkTint' ? 'text-[var(--blue-dark)]/60' : 'text-gray-500'}`}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Expandable help section */}
      {helpContent && showHelp && (
        <>
          <div className={`border-t ${variant === 'darkTint' ? 'border-[var(--blue-dark)]/10' : 'border-black/10'}`} />
          <div className={`text-[11px] leading-relaxed ${variant === 'darkTint' ? 'text-[var(--blue-dark)]/70' : 'text-gray-500'}`}>
            {helpContent}
          </div>
        </>
      )}
    </div>
  );
};

export default LineAreaChart;
