import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface ScoreSegment {
  label: string;
  weight: number;
  value: number; // 0-1
  color: string;
}

interface ScoreDonutProps {
  segments: ScoreSegment[];
  cityName: string;
  overallScore: number;
  accent: string;
  theme?: 'light' | 'dark';
}

export const ScoreDonut: React.FC<ScoreDonutProps> = ({
  segments,
  cityName,
  overallScore,
  accent,
  theme = 'light',
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const size = 220;

  const isDark = theme === 'dark';
  const labelColor    = isDark ? 'text-white/50'  : 'text-gray-400';
  const segLabelColor = isDark ? 'text-white/70'  : 'text-gray-600';
  const valueColor    = isDark ? 'text-white'      : 'text-gray-900';
  const scoreUnit     = isDark ? 'text-white/40'  : 'text-gray-400';

  useEffect(() => {
    if (!svgRef.current) return;
    const dark = theme === 'dark';

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const radius = size / 2;
    const g = svg.append('g').attr('transform', `translate(${radius},${radius})`);

    const totalWeight = d3.sum(segments, s => s.weight);
    const innerRadiusBase = 45;
    const outerRadiusBase = 95;
    const bandWidth = outerRadiusBase - innerRadiusBase;
    let currentRadius = innerRadiusBase;

    segments.forEach((seg) => {
      const segBandWidth = (seg.weight / totalWeight) * bandWidth;
      const inner = currentRadius;
      const outer = currentRadius + segBandWidth - 1.5;
      currentRadius += segBandWidth;

      const arcGen = d3.arc<object>()
        .innerRadius(inner)
        .outerRadius(outer)
        .startAngle(0)
        .endAngle(2 * Math.PI)
        .cornerRadius(2);

      g.append('path')
        .attr('d', arcGen({}))
        .attr('fill', seg.color)
        .attr('fill-opacity', dark ? 0.15 : 0.1);

      const valueArcGen = d3.arc<object>()
        .innerRadius(inner)
        .outerRadius(outer)
        .startAngle(0)
        .endAngle(seg.value * 2 * Math.PI)
        .cornerRadius(2);

      g.append('path')
        .attr('d', valueArcGen({}))
        .attr('fill', seg.color)
        .transition()
        .duration(1000)
        .attrTween('d', function() {
          const interpolate = d3.interpolate(0, seg.value * 2 * Math.PI);
          return function(t) {
            valueArcGen.endAngle(interpolate(t));
            return valueArcGen({}) as string;
          };
        });
    });
  }, [segments, theme]);

  return (
    <div className="flex flex-col items-center gap-4">
      <p className={`text-[10px] font-bold ${labelColor} tracking-widest uppercase`}>{cityName}</p>

      <div className="relative" style={{ width: size, height: size }}>
        <svg ref={svgRef} width={size} height={size}></svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-3xl font-bold leading-none tabular-nums" style={{ color: accent }}>
            {Math.round(overallScore)}
          </span>
          <span className={`text-[10px] ${scoreUnit} font-medium uppercase mt-1`}>Score / 100</span>
        </div>
      </div>

      <ul className="w-full space-y-2 mt-2">
        {segments.map((seg) => (
          <li key={seg.label} className="flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: seg.color }} />
              <span className={`${segLabelColor} font-medium`}>{seg.label}</span>
            </div>
            <span className={`font-bold ${valueColor}`}>
              {Math.round(seg.value * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ScoreDonut;
