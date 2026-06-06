import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
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
  /** 'overlay' = transparent/on-map (default), 'panel' = white card in stats panel */
  variant?: 'overlay' | 'panel';
  /** Hide the built-in planificado/ejecutado toggle (when parent owns the state) */
  showToggle?: boolean;
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
  if (Math.abs(amount) >= 1_000_000_000) return `€${(amount / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(amount) >= 1_000_000) return `€${(amount / 1_000_000).toFixed(2)}M`;
  if (Math.abs(amount) >= 1_000) return `€${(amount / 1_000).toFixed(1)}K`;
  return `€${amount.toFixed(0)}`;
}

function hexToRgba(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${opacity})`;
}

function findNode(node: BudgetNode, code: string): BudgetNode | null {
  if (node.code === code) return node;
  for (const child of node.children ?? []) {
    const found = findNode(child, code);
    if (found) return found;
  }
  return null;
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  name: string;
  amount: number;
  pct: number;
  hasChildren: boolean;
}

export const BudgetSunburst: React.FC<BudgetSunburstProps> = ({
  data,
  year,
  budgetType,
  onBudgetTypeChange,
  title = 'Desglose presupuestario',
  subtitle,
  variant = 'overlay',
  showToggle = true,
}) => {
  const isPanel = variant === 'panel';
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [focusCode, setFocusCode] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false, x: 0, y: 0, name: '', amount: 0, pct: 0, hasChildren: false,
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

  // Reset drill-down when data changes (year/type change)
  useEffect(() => setFocusCode(null), [data]);

  const HEIGHT = 400;
  const RADIUS = Math.min(width, HEIGHT) / 2 - 20;

  // Focused subtree: re-root at the clicked node
  const focusedData = useMemo((): BudgetNode => {
    if (!focusCode) return data;
    return findNode(data, focusCode) ?? data;
  }, [data, focusCode]);

  const focusedName = useMemo((): string | null => {
    if (!focusCode) return null;
    return findNode(data, focusCode)?.name ?? null;
  }, [data, focusCode]);

  const root = useMemo(() => {
    if (!focusedData) return null;
    const h = hierarchy<BudgetNode>(focusedData)
      .sum(d => (d.children && d.children.length > 0 ? 0 : d.amount))
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    return partition<BudgetNode>().size([2 * Math.PI, RADIUS])(h);
  }, [focusedData, RADIUS]);

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
    if (node.depth === 0) return 'transparent';
    let cur: typeof node = node;
    while (cur.depth > 1 && cur.parent) cur = cur.parent;
    const baseColor = colorMap.get(cur.data.code) ?? '#9ca3af';
    const opacity = node.depth === 1 ? 0.88 : node.depth === 2 ? 0.6 : 0.4;
    return hexToRgba(baseColor, opacity);
  }

  const handleMouseEnter = useCallback((
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
      hasChildren: (node.data.children?.length ?? 0) > 0,
    });
  }, [totalValue]);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGPathElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip(prev => ({ ...prev, x: e.clientX - rect.left, y: e.clientY - rect.top }));
  }, []);

  const handleClick = useCallback((node: HierarchyRectangularNode<BudgetNode>) => {
    if (node.depth === 0) return;
    if ((node.data.children?.length ?? 0) > 0) {
      setFocusCode(node.data.code);
      setTooltip(prev => ({ ...prev, visible: false }));
    }
  }, []);

  const nodes: HierarchyRectangularNode<BudgetNode>[] = useMemo(() => {
    if (!root) return [];
    const res: HierarchyRectangularNode<BudgetNode>[] = [];
    root.each(node => { if (node.depth <= 3) res.push(node); });
    return res;
  }, [root]);

  const innerRadius = RADIUS * 0.18;

  return (
    <div className={`flex flex-col h-full ${isPanel ? 'rounded-2xl border bg-white/80 backdrop-blur-sm p-5' : ''}`}
      style={isPanel ? { borderColor: 'rgba(0,0,0,0.08)', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' } : undefined}
    >
      <div className="flex items-center justify-between mb-3 px-1">
        <div>
          <h3
            className="text-sm font-black uppercase tracking-widest"
            style={isPanel
              ? { color: '#1f2937' }
              : { color: '#fff', textShadow: '0 1px 6px rgba(0,0,0,0.5)' }
            }
          >
            {title}
          </h3>
          <p
            className="text-[10px] font-bold uppercase tracking-tight mt-0.5"
            style={isPanel
              ? { color: '#6b7280' }
              : { color: 'rgba(255,255,255,0.65)', textShadow: '0 1px 4px rgba(0,0,0,0.4)' }
            }
          >
            {subtitle || `Año ${year}`}
          </p>
        </div>

        {showToggle && (
          <div className={`flex items-center gap-1 p-1 rounded-xl ${isPanel ? 'bg-gray-100 border border-gray-200' : 'bg-black/30 backdrop-blur-sm border border-white/10'}`}>
            {(['planned', 'executed'] as const).map(t => (
              <button
                key={t}
                onClick={() => onBudgetTypeChange(t)}
                className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${
                  budgetType === t
                    ? isPanel
                      ? 'bg-white text-gray-800 shadow-sm'
                      : 'bg-white/20 text-white shadow-sm'
                    : isPanel
                      ? 'text-gray-400 hover:text-gray-600'
                      : 'text-white/50 hover:text-white/80'
                }`}
              >
                {t === 'planned' ? 'PLANIFICADO' : 'EJECUTADO'}
              </button>
            ))}
          </div>
        )}
      </div>

      <div ref={containerRef} className="flex-1 relative min-h-[350px]">
        {width > 0 && (
          <svg width={width} height={HEIGHT} style={{ display: 'block', overflow: 'visible' }}>
            <g transform={`translate(${width / 2}, ${HEIGHT / 2})`}>
              {nodes.map((node, i) => {
                if (node.depth === 0) return null;
                const d = arcGenerator(node);
                if (!d) return null;
                const hasChildren = (node.data.children?.length ?? 0) > 0;
                return (
                  <path
                    key={i}
                    d={d}
                    fill={getNodeColor(node)}
                    stroke="rgba(255,255,255,0.15)"
                    strokeWidth={1}
                    onMouseEnter={e => handleMouseEnter(e, node)}
                    onMouseMove={handleMouseMove}
                    onMouseLeave={() => setTooltip(prev => ({ ...prev, visible: false }))}
                    onClick={() => handleClick(node)}
                    style={{
                      cursor: hasChildren ? 'zoom-in' : 'default',
                      transition: 'd 0.4s ease, fill 0.3s ease, opacity 0.2s ease',
                    }}
                    className="hover:opacity-90"
                  />
                );
              })}

              {/* Center back button when drilled in */}
              {focusCode && (
                <g
                  style={{ cursor: 'pointer' }}
                  onClick={() => setFocusCode(null)}
                >
                  {/* Solid backdrop for visibility */}
                  <circle
                    r={innerRadius}
                    fill={isPanel ? 'rgba(30,30,30,0.08)' : 'rgba(15,15,15,0.55)'}
                    stroke={isPanel ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.5)'}
                    strokeWidth={2}
                  />
                  <text
                    textAnchor="middle"
                    dominantBaseline="middle"
                    y={-7}
                    fontSize={22}
                    fill={isPanel ? '#1f2937' : '#ffffff'}
                    style={{ filter: isPanel ? 'none' : 'drop-shadow(0 1px 4px rgba(0,0,0,0.6))' }}
                  >
                    ↩
                  </text>
                  <text
                    textAnchor="middle"
                    dominantBaseline="middle"
                    y={10}
                    fontSize={9}
                    fontWeight="800"
                    letterSpacing="0.1em"
                    fill={isPanel ? '#6b7280' : 'rgba(255,255,255,0.85)'}
                  >
                    VOLVER
                  </text>
                </g>
              )}

              {/* Center label — focused node name */}
              {focusCode && focusedName && (
                <text
                  textAnchor="middle"
                  dominantBaseline="middle"
                  y={innerRadius + 14}
                  fontSize={9}
                  fontWeight="bold"
                  fill={isPanel ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.6)'}
                  style={{ textTransform: 'uppercase', letterSpacing: '0.06em', pointerEvents: 'none' }}
                >
                  {focusedName.length > 18 ? focusedName.slice(0, 17) + '…' : focusedName}
                </text>
              )}

            </g>
          </svg>
        )}

        {/* Tooltip */}
        {tooltip.visible && (
          <div
            className="absolute z-[100] pointer-events-none bg-white/95 backdrop-blur-md border border-black/5 rounded-xl shadow-xl p-3 flex flex-col gap-1 min-w-[180px]"
            style={{ left: tooltip.x + 15, top: tooltip.y - 15, transform: 'translateY(-50%)' }}
          >
            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">
              Partida Presupuestaria
            </div>
            <div className="text-xs font-bold text-gray-800 leading-tight">
              {tooltip.name}
            </div>
            {tooltip.hasChildren && (
              <div className="text-[9px] text-blue-500 font-bold mt-0.5">Click para desglosar →</div>
            )}
            <div className="h-px bg-black/5 my-1" />
            <div className="flex justify-between items-end">
              <span className="text-sm font-black text-gray-900">{formatEur(tooltip.amount)}</span>
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
