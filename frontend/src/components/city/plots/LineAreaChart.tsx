// LineAreaChart.tsx
import React, { useEffect, useRef, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import * as d3 from 'd3';
import GlassCard from '../../ui/GlassCard';

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
}

export const LineAreaChart: React.FC<LineAreaChartProps> = ({
  data,
  xKey,
  series,
  title,
  subtitle,
  helpContent,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

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

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || !data.length || width === 0) return;

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
      .attr('stroke', 'rgba(0,0,0,0.05)');

    svg.append('g')
      .attr('class', 'grid')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(yLeft).tickSize(-(width - margin.left - margin.right)).tickFormat(() => ''))
      .call(g => g.select('.domain').remove())
      .selectAll('line')
      .attr('stroke', 'rgba(0,0,0,0.05)');

    // Axes
    svg.append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x))
      .call(g => g.select('.domain').attr('stroke', 'rgba(0,0,0,0.1)'))
      .selectAll('text')
      .attr('font-size', '10px')
      .attr('fill', '#6b7280');

    svg.append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(yLeft).ticks(5))
      .call(g => g.select('.domain').remove())
      .selectAll('text')
      .attr('font-size', '10px')
      .attr('fill', '#6b7280');

    if (yRight) {
      svg.append('g')
        .attr('transform', `translate(${width - margin.right},0)`)
        .call(d3.axisRight(yRight).ticks(5))
        .call(g => g.select('.domain').remove())
        .selectAll('text')
        .attr('font-size', '10px')
        .attr('fill', '#6b7280');
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
          .attr('fill-opacity', 0.1)
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

      if (s.dashed) {
        path.attr('stroke-dasharray', '4,4');
      }
    });

    // Tooltip logic
    const bisect = d3.bisector((d: any) => d[xKey]).center;
    const overlay = svg.append('rect')
      .attr('width', width)
      .attr('height', height)
      .attr('fill', 'transparent')
      .on('mousemove', (event) => {
        const [mx] = d3.pointer(event);
        // Map pointer position back to data index
        const xValues = data.map(d => x(d[xKey])!);
        const i = d3.bisectCenter(xValues, mx);
        const d = data[i];

        if (d && tooltipRef.current) {
          const tooltip = d3.select(tooltipRef.current);
          tooltip.style('display', 'block')
            .style('left', `${event.pageX + 10}px`)
            .style('top', `${event.pageY - 10}px`)
            .html(`
              <div class="font-bold border-b pb-1 mb-1">${d[xKey]}</div>
              ${series.map(s => `
                <div class="flex items-center gap-2">
                  <div class="w-2 h-2 rounded-full" style="background: ${s.color}"></div>
                  <span>${s.label}:</span>
                  <span class="font-bold ml-auto">${d[s.key]}</span>
                </div>
              `).join('')}
            `);
        }
      })
      .on('mouseleave', () => {
        if (tooltipRef.current) {
          d3.select(tooltipRef.current).style('display', 'none');
        }
      });

  }, [data, xKey, series, width]);

  return (
    <GlassCard surface="glass" className="flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900 leading-tight">{title}</h3>
          {subtitle && <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>}
        </div>
        {helpContent && <div className="ml-3 shrink-0 text-gray-400">{helpContent}</div>}
      </div>

      <div ref={containerRef} className="w-full relative">
        <svg ref={svgRef}></svg>
        <div
          ref={tooltipRef}
          className="fixed z-50 hidden bg-white/95 backdrop-blur-sm border border-black/10 rounded-lg p-2 shadow-lg text-[11px] min-w-[120px] pointer-events-none"
        ></div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-2 mt-2">
        {series.map(s => (
          <div key={s.key} className="flex items-center gap-1.5">
            <div className={`h-0.5 w-4 ${s.dashed ? 'border-t-2 border-dashed' : ''}`} style={{ borderColor: s.color, backgroundColor: s.dashed ? 'transparent' : s.color }}></div>
            <span className="text-[10px] text-gray-500 font-medium">{s.label}</span>
          </div>
        ))}
      </div>
    </GlassCard>
  );
};

export default LineAreaChart;
