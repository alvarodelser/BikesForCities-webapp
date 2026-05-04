import React, { useState, useMemo, useRef, useEffect } from 'react';
import { hierarchy, partition, type HierarchyRectangularNode } from 'd3-hierarchy';
import { arc } from 'd3-shape';

export interface BudgetNode {
  code: string;
  name: string;
  amount: number;
  children?: BudgetNode[];
}

interface BudgetSunburstProps {
  data: BudgetNode;
  year: number;
  budgetType: 'planned' | 'executed';
  onBudgetTypeChange: (t: 'planned' | 'executed') => void;
  title?: string;
  subtitle?: string;
}

const SUNBURST_COLORS = [
  '#3b82f6', // Blue
  '#22c55e', // Green
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#84cc16', // Lime
];

function formatEur(amount: number): string {
  if (Math.abs(amount) >= 1_000_000_000) {
    return `€${(amount / 1_000_000_000).toFixed(2)}B`;
  }
  if (Math.abs(amount) >= 1_000_000) {
    return `€${(amount / 1_000_000).toFixed(2)}M`;
  }
  if (Math.abs(amount) >= 1_000) {
    return `€${(amount / 1_000).toFixed(1)}K`;
  }
  return `€${amount.toFixed(0)}`;
}

function hexToRgba(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${opacity})`;
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  name: string;
  amount: number;
  pct: number;
}

export const BudgetSunburst: React.FC<BudgetSunburstProps> = ({
  data,
  year,
  budgetType,
  onBudgetTypeChange,
  title = 'Desglose presupuestario',
  subtitle,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    name: '',
    amount: 0,
    pct: 0,
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

  const HEIGHT = 400;
  const RADIUS = Math.min(width, HEIGHT) / 2 - 20;

  const root = useMemo(() => {
    if (!data) return null;
    const h = hierarchy<BudgetNode>(data)
      .sum(d => (d.children && d.children.length > 0 ? 0 : d.amount))
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    return partition<BudgetNode>().size([2 * Math.PI, RADIUS])(h);
  }, [data, RADIUS]);

  const totalValue = root?.value ?? 1;

  const arcGenerator = arc<HierarchyRectangularNode<BudgetNode>>()
    .startAngle(d => d.x0)
    .endAngle(d => d.x1)
    .innerRadius(d => d.y0)
    .outerRadius(d => d.y1 - 1);

  const topChildren = root?.children ?? [];
  const colorMap = useMemo(() => {
    const m = new Map<string, string>();
    topChildren.forEach((child, i) => {
      m.set(child.data.code, SUNBURST_COLORS[i % SUNBURST_COLORS.length]);
    });
    return m;
  }, [topChildren]);

  function getNodeColor(node: HierarchyRectangularNode<BudgetNode>): string {
    if (node.depth === 0) return '#f3f4f6';
    let cur: typeof node = node;
    while (cur.depth > 1 && cur.parent) {
      cur = cur.parent;
    }
    const baseColor = colorMap.get(cur.data.code) ?? '#9ca3af';
    const opacity = node.depth === 1 ? 0.9 : node.depth === 2 ? 0.65 : 0.45;
    return hexToRgba(baseColor, opacity);
  }

  const handleMouseEnter = (
    e: React.MouseEvent<SVGPathElement>,
    node: HierarchyRectangularNode<BudgetNode>,
  ) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pct = totalValue > 0 ? ((node.value ?? 0) / totalValue) * 100 : 0;
    setTooltip({
      visible: true,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      name: node.data.name,
      amount: node.value ?? 0,
      pct,
    });
  };

  const handleMouseMove = (e: React.MouseEvent<SVGPathElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip(prev => ({
      ...prev,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }));
  };

  const nodes: HierarchyRectangularNode<BudgetNode>[] = useMemo(() => {
    if (!root) return [];
    const res: HierarchyRectangularNode<BudgetNode>[] = [];
    root.each(node => {
      if (node.depth <= 3) res.push(node);
    });
    return res;
  }, [root]);

  return (
    <div
      className="rounded-2xl border bg-white/80 backdrop-blur-sm p-5 flex flex-col h-full transition-all hover:bg-white/90"
      style={{ borderColor: 'rgba(0,0,0,0.08)', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest">{title}</h3>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tight mt-0.5">
            {subtitle || `Año ${year}`}
          </p>
        </div>

        <div className="flex items-center gap-1 bg-gray-100/50 p-1 rounded-xl border border-black/5">
          {(['planned', 'executed'] as const).map(t => (
            <button
              key={t}
              onClick={() => onBudgetTypeChange(t)}
              className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${
                budgetType === t
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {t === 'planned' ? 'PLANIFICADO' : 'EJECUTADO'}
            </button>
          ))}
        </div>
      </div>

      <div ref={containerRef} className="flex-1 relative min-h-[350px]">
        {width > 0 && (
          <svg
            width={width}
            height={HEIGHT}
            style={{ display: 'block', overflow: 'visible' }}
          >
            <g transform={`translate(${width / 2}, ${HEIGHT / 2})`}>
              {nodes.map((node, i) => {
                if (node.depth === 0) return null;
                const d = arcGenerator(node);
                if (!d) return null;
                return (
                  <path
                    key={i}
                    d={d}
                    fill={getNodeColor(node)}
                    stroke="#fff"
                    strokeWidth={1}
                    onMouseEnter={e => handleMouseEnter(e, node)}
                    onMouseMove={handleMouseMove}
                    onMouseLeave={() => setTooltip(prev => ({ ...prev, visible: false }))}
                    className="transition-opacity hover:opacity-80"
                    style={{ cursor: 'pointer' }}
                  />
                );
              })}
            </g>
          </svg>
        )}

        {/* Premium Tooltip */}
        {tooltip.visible && (
          <div
            className="fixed z-[100] pointer-events-none bg-white/95 backdrop-blur-md border border-black/5 rounded-xl shadow-xl p-3 flex flex-col gap-1 min-w-[180px]"
            style={{
              left: tooltip.x + 15,
              top: tooltip.y - 15,
              transform: 'translateY(-50%)',
            }}
          >
            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">
              Partida Presupuestaria
            </div>
            <div className="text-xs font-bold text-gray-800 leading-tight">
              {tooltip.name}
            </div>
            <div className="h-px bg-black/5 my-1" />
            <div className="flex justify-between items-end">
              <span className="text-sm font-black text-gray-900">
                {formatEur(tooltip.amount)}
              </span>
              <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                {tooltip.pct.toFixed(1)}%
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BudgetSunburst;
