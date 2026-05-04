// StackedBarMatrix.tsx
import React, { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import * as d3 from 'd3';
import { HelpCircle, X } from 'lucide-react';

interface Segment {
  value: number;
  color: string;
  label: string;
}

interface RowData {
  label: string;
  total: number;
  segments: Segment[];
}

interface StackedBarMatrixProps {
  rows: RowData[];
  segmentLabels: string[];
  title: string;
  subtitle?: string;
  helpContent?: ReactNode;
  onRowClick?: (rowLabel: string) => void;
}

export const StackedBarMatrix: React.FC<StackedBarMatrixProps> = ({
  rows,
  segmentLabels,
  title,
  subtitle,
  helpContent,
  onRowClick,
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
    if (!svgRef.current || !rows.length || width === 0) return;

    const barHeight = 28;
    const barGap = 10;
    const margin = { top: 10, right: 60, bottom: 20, left: 100 };
    const height = rows.length * (barHeight + barGap) + margin.top + margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('width', width).attr('height', height);

    const x = d3.scaleLinear()
      .domain([0, 100])
      .range([margin.left, width - margin.right]);

    const y = d3.scaleBand()
      .domain(rows.map(r => r.label))
      .range([margin.top, height - margin.bottom])
      .padding(0.2);

    // Prepare stacked data
    const keys = segmentLabels.map((_, i) => `seg_${i}`);
    const stackData = rows.map(r => {
      const d: any = { label: r.label, total: r.total };
      r.segments.forEach((s, i) => {
        d[`seg_${i}`] = r.total > 0 ? (s.value / r.total) * 100 : 0;
        d[`seg_${i}_raw`] = s.value;
        d[`seg_${i}_color`] = s.color;
      });
      return d;
    });

    const series = d3.stack()
      .keys(keys)
      (stackData);

    // X Axis
    svg.append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(5).tickFormat(d => `${d}%`))
      .call(g => g.select('.domain').remove())
      .selectAll('text')
      .attr('font-size', '11px')
      .attr('fill', '#9ca3af');

    // Y Axis
    svg.append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(y))
      .call(g => g.select('.domain').remove())
      .selectAll('text')
      .attr('font-size', '12px')
      .attr('fill', '#374151');

    // Bars
    const layer = svg.selectAll('.layer')
      .data(series)
      .enter()
      .append('g')
      .attr('class', 'layer');

    layer.selectAll('rect')
      .data(d => d)
      .enter()
      .append('rect')
      .attr('y', (d: any) => y(String(d.data.label))!)
      .attr('x', (d: any) => x(d[0]))
      .attr('width', (d: any) => x(d[1]) - x(d[0]))
      .attr('height', y.bandwidth())
      .attr('fill', (d: any, i, nodes) => {
        const key = (d3.select(nodes[i].parentNode as any).datum() as any).key;
        return d.data[`${key}_color`];
      })
      .attr('cursor', onRowClick ? 'pointer' : 'default')
      .on('click', (_event, d: any) => {
        if (onRowClick) onRowClick(String(d.data.label));
      })
      .on('mousemove', (event: any, d: any) => {
        if (tooltipRef.current) {
          const key = (d3.select((event.currentTarget as any).parentNode).datum() as any).key;
          const segIdx = parseInt(key.replace('seg_', ''), 10);
          const tooltip = d3.select(tooltipRef.current);
          tooltip.style('display', 'block')
            .style('left', `${event.pageX + 10}px`)
            .style('top', `${event.pageY - 10}px`)
            .html(`
              <div class="font-bold border-b mb-1 pb-1">${d.data.label}</div>
              <div class="space-y-1">
                ${segmentLabels.map((lbl, i) => `
                  <div class="flex items-center gap-2 text-[11px] ${i === segIdx ? 'font-bold' : 'text-gray-500'}">
                    <div class="w-2 h-2 rounded-sm" style="background: ${d.data[`seg_${i}_color`]}"></div>
                    <span>${lbl}:</span>
                    <span class="ml-auto">${d.data[`seg_${i}_raw`]}</span>
                    <span class="text-[9px] opacity-60">(${d.data[`seg_${i}`].toFixed(1)}%)</span>
                  </div>
                `).join('')}
                <div class="border-t mt-1 pt-1 font-bold text-[11px] flex justify-between">
                  <span>Total:</span>
                  <span>${d.data.total}</span>
                </div>
              </div>
            `);
        }
      })
      .on('mouseleave', () => {
        if (tooltipRef.current) {
          d3.select(tooltipRef.current).style('display', 'none');
        }
      });

    // Total Labels
    svg.selectAll('.total-label')
      .data(stackData)
      .enter()
      .append('text')
      .attr('class', 'total-label')
      .attr('x', () => x(100) + 8)
      .attr('y', d => y(d.label)! + y.bandwidth() / 2)
      .attr('dominant-baseline', 'middle')
      .attr('font-size', '11px')
      .attr('fill', '#6b7280')
      .text((d: any) => d.total);

  }, [rows, segmentLabels, width, onRowClick]);

  return (
    <div
      className="rounded-2xl border bg-white/80 backdrop-blur-sm p-5 w-full transition-all hover:bg-white/90"
      style={{ borderColor: 'rgba(0,0,0,0.08)', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-gray-900 leading-tight">{title}</h3>
          {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        {helpContent && (
          <button
            type="button"
            onClick={() => setShowHelp(v => !v)}
            className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 bg-black/5 hover:bg-black/10 text-gray-400 hover:text-gray-600 transition-all"
          >
            {showHelp ? <X className="w-3.5 h-3.5" /> : <HelpCircle className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {showHelp && helpContent && (
        <>
          <div className="border-t border-black/10 mb-4" />
          <div className="mb-4 text-[11px] text-gray-500 leading-relaxed">{helpContent}</div>
        </>
      )}

      <div ref={containerRef} className="w-full relative">
        <svg ref={svgRef}></svg>
        <div
          ref={tooltipRef}
          className="fixed z-50 hidden bg-white/95 backdrop-blur-sm border border-black/10 rounded-lg p-2 shadow-lg text-[12px] min-w-[160px] pointer-events-none"
        ></div>
      </div>

      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-4">
        {segmentLabels.map((lbl, i) => (
          <div key={lbl} className="flex items-center gap-1.5 text-[10px] text-gray-600 font-medium">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: rows[0]?.segments[i]?.color ?? '#9ca3af' }}></div>
            {lbl}
          </div>
        ))}
      </div>
    </div>
  );
};

export default StackedBarMatrix;
