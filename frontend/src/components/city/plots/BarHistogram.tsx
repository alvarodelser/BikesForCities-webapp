// BarHistogram.tsx
import React, { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import * as d3 from 'd3';
import GlassCard from '../../ui/GlassCard';

interface BarHistogramProps {
  data: { label: string; value: number }[];
  accent: string;
  title: string;
  subtitle?: string;
  helpContent?: ReactNode;
  gradient?: boolean;
  referenceLineX?: number;
  referenceLabel?: string;
}

export const BarHistogram: React.FC<BarHistogramProps> = ({
  data,
  accent,
  title,
  subtitle,
  helpContent,
  gradient = false,
  referenceLineX,
  referenceLabel,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [showHelp, setShowHelp] = useState(false);

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
    if (!svgRef.current || !data.length || width === 0) return;

    const height = 260;
    const margin = { top: 20, right: 20, bottom: 40, left: 40 };

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('width', width).attr('height', height);

    const x = d3.scaleBand()
      .domain(data.map(d => d.label))
      .range([margin.left, width - margin.right])
      .padding(0.2);

    const y = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.value) || 100])
      .nice()
      .range([height - margin.bottom, margin.top]);

    // Gradient def
    if (gradient) {
      const defs = svg.append('defs');
      const linearGradient = defs.append('linearGradient')
        .attr('id', 'bar-gradient')
        .attr('x1', '0%')
        .attr('y1', '0%')
        .attr('x2', '0%')
        .attr('y2', '100%');

      linearGradient.append('stop')
        .attr('offset', '0%')
        .attr('stop-color', accent)
        .attr('stop-opacity', 1);

      linearGradient.append('stop')
        .attr('offset', '100%')
        .attr('stop-color', accent)
        .attr('stop-opacity', 0.35);
    }

    // Grid lines
    svg.append('g')
      .attr('class', 'grid')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).tickSize(-(width - margin.left - margin.right)).tickFormat(() => ''))
      .call(g => g.select('.domain').remove())
      .selectAll('line')
      .attr('stroke', 'rgba(0,0,0,0.05)');

    // Axes
    svg.append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x))
      .call(g => g.select('.domain').attr('stroke', '#d1d5db'))
      .selectAll('text')
      .attr('font-size', '11px')
      .attr('fill', '#6b7280');

    svg.append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(5))
      .call(g => g.select('.domain').remove())
      .selectAll('text')
      .attr('font-size', '11px')
      .attr('fill', '#6b7280');

    // Bars
    svg.selectAll('.bar')
      .data(data)
      .enter()
      .append('rect')
      .attr('class', 'bar')
      .attr('x', d => x(d.label)!)
      .attr('y', d => y(d.value))
      .attr('width', x.bandwidth())
      .attr('height', d => height - margin.bottom - y(d.value))
      .attr('fill', gradient ? 'url(#bar-gradient)' : accent)
      .attr('rx', 4)
      .attr('ry', 4)
      .on('mousemove', (event, d) => {
        if (tooltipRef.current) {
          const tooltip = d3.select(tooltipRef.current);
          tooltip.style('display', 'block')
            .style('left', `${event.pageX + 10}px`)
            .style('top', `${event.pageY - 10}px`)
            .html(`
              <div class="font-bold text-gray-800">${d.label}</div>
              <div class="text-gray-600">Value: <span class="font-bold">${d.value}</span></div>
            `);
        }
      })
      .on('mouseleave', () => {
        if (tooltipRef.current) {
          d3.select(tooltipRef.current).style('display', 'none');
        }
      });

    // Reference Line
    if (referenceLineX !== undefined) {
      const refX = x(data[referenceLineX]?.label) || margin.left;
      svg.append('line')
        .attr('x1', refX + x.bandwidth() / 2)
        .attr('x2', refX + x.bandwidth() / 2)
        .attr('y1', margin.top)
        .attr('y2', height - margin.bottom)
        .attr('stroke', '#ef4444')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '4,4');

      if (referenceLabel) {
        svg.append('text')
          .attr('x', refX + x.bandwidth() / 2)
          .attr('y', margin.top - 5)
          .attr('text-anchor', 'middle')
          .attr('font-size', '10px')
          .attr('fill', '#ef4444')
          .attr('font-weight', 'bold')
          .text(referenceLabel);
      }
    }

  }, [data, accent, gradient, referenceLineX, referenceLabel, width]);

  return (
    <GlassCard surface="glass" className="w-full">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-gray-800 leading-tight">{title}</h3>
          {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        {helpContent && (
          <button
            type="button"
            onClick={() => setShowHelp(!showHelp)}
            className="ml-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            ❓
          </button>
        )}
      </div>

      {showHelp && helpContent && (
        <div className="mb-4 rounded-xl bg-gray-50 border border-gray-200 p-3 text-sm text-gray-700 shadow-inner animate-in fade-in slide-in-from-top-2">
          {helpContent}
        </div>
      )}

      <div ref={containerRef} className="w-full relative min-h-[260px]">
        <svg ref={svgRef}></svg>
        <div
          ref={tooltipRef}
          className="fixed z-50 hidden bg-white/95 backdrop-blur-sm border border-gray-200 rounded-lg p-2 shadow-lg text-[12px] min-w-[100px] pointer-events-none"
        ></div>
      </div>
    </GlassCard>
  );
};

export default BarHistogram;
