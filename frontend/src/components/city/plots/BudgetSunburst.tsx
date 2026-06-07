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
  variant?: 'overlay' | 'panel';
  showToggle?: boolean;
}

const SUNBURST_COLORS = [
  '#027A76', // dark teal
  '#3A6C7F', // dark blue
  '#C97828', // darkened amber (readable on cream)
  '#AF4749', // red
  '#2E6B52', // darkened sage green
  '#2A6A80', // darkened sky blue
  '#D4602A', // darkened coral
  '#2E7A60', // darkened mint
];

const ANIM_MS = 420;


type ArcParams = { x0: number; x1: number; y0: number; y1: number };

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
function lerpNum(a: number, b: number, t: number): number { return a + (b - a) * t; }
function lerpArc(a: ArcParams, b: ArcParams, t: number): ArcParams {
  return { x0: lerpNum(a.x0,b.x0,t), x1: lerpNum(a.x1,b.x1,t), y0: lerpNum(a.y0,b.y0,t), y1: lerpNum(a.y1,b.y1,t) };
}

function formatEur(amount: number): string {
  if (Math.abs(amount) >= 1_000_000_000) return `€${(amount/1_000_000_000).toFixed(2)}B`;
  if (Math.abs(amount) >= 1_000_000)     return `€${(amount/1_000_000).toFixed(2)}M`;
  if (Math.abs(amount) >= 1_000)         return `€${(amount/1_000).toFixed(1)}K`;
  return `€${amount.toFixed(0)}`;
}

function hexToRgba(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${opacity})`;
}

// ── HSL helpers for zoomed-in color variants ──────────────────────────────
function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1,3),16)/255;
  const g = parseInt(hex.slice(3,5),16)/255;
  const b = parseInt(hex.slice(5,7),16)/255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b), d = max - min;
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2*l - 1));
  let h = 0;
  if (d !== 0) {
    if (max === r) h = (((g - b) / d) % 6 + 6) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [h, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const hue2rgb = (p: number, q: number, t: number): number => {
    t = ((t % 1) + 1) % 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l*(1+s) : l+s-l*s, p = 2*l - q;
  const toC = (x: number) => s === 0 ? l : hue2rgb(p, q, x);
  return '#' + [toC(h/360+1/3), toC(h/360), toC(h/360-1/3)]
    .map(x => Math.round(x*255).toString(16).padStart(2,'0')).join('');
}

function variantColors(baseHex: string, count: number): string[] {
  const [h, s, l] = hexToHsl(baseHex);
  const anchorL = Math.max(0.35, Math.min(0.62, l));
  const spread   = Math.min(0.14, (count - 1) * 0.05);
  return Array.from({ length: count }, (_, i) => {
    const t = count > 1 ? i / (count - 1) : 0.5;
    const lVariant = anchorL - spread + t * 2 * spread;
    const hShift   = (i - (count - 1) / 2) * 8;
    return hslToHex(((h + hShift) % 360 + 360) % 360, Math.min(0.95, s * 0.88), lVariant);
  });
}

function findNode(node: BudgetNode, code: string): BudgetNode | null {
  if (node.code === code) return node;
  for (const child of node.children ?? []) {
    const found = findNode(child, code);
    if (found) return found;
  }
  return null;
}

// d3 partition angle (0 = top, clockwise) + radius → SVG x,y relative to center
function a2xy(angle: number, r: number): [number, number] {
  return [Math.sin(angle) * r, -Math.cos(angle) * r];
}

// ── Label / callout constants ─────────────────────────────────────────────
const CHAR_W = 6.4;           // px per uppercase char at font-size 10
const PILL_PAD_X = 9;
const LABEL_GAP = 5;
const BOUNDS_MARGIN = 8;
const PILL_H_1 = 34;          // single-line pill height
const PILL_H_2 = 48;          // two-line pill height
const MIN_LABEL_AREA_W = 65;  // px reserved per side for callout labels

function wrapText(name: string, maxChars: number): string[] {
  const upper = name.toUpperCase();
  const words = upper.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (!current) {
      current = word;
    } else if ((current + ' ' + word).length <= maxChars) {
      current += ' ' + word;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [upper];
}

interface TooltipState {
  visible: boolean; x: number; y: number;
  name: string; amount: number; pct: number; hasChildren: boolean;
}

export const BudgetSunburst: React.FC<BudgetSunburstProps> = ({
  data, year, budgetType, onBudgetTypeChange,
  subtitle, variant = 'overlay', showToggle = true,
}) => {
  const isPanel = variant === 'panel';
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [focusCode, setFocusCode] = useState<string | null>(null);
  const [focusBaseColor, setFocusBaseColor] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false, x: 0, y: 0, name: '', amount: 0, pct: 0, hasChildren: false,
  });

  const prevParamsRef  = useRef<Map<string, ArcParams>>(new Map());
  const clickedArcRef  = useRef<ArcParams | null>(null);
  const animStartRef   = useRef<number>(0);
  const rafRef         = useRef<number>(0);
  const [animProgress, setAnimProgress] = useState(1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => { if (entries[0]) setWidth(entries[0].contentRect.width); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    setFocusCode(null); setFocusBaseColor(null);
    prevParamsRef.current = new Map(); clickedArcRef.current = null;
    setAnimProgress(1); cancelAnimationFrame(rafRef.current);
  }, [data]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const HEIGHT = 480;
  // Label area scales with viewport: 20% of width, floor at MIN_LABEL_AREA_W
  const labelAreaW = Math.max(MIN_LABEL_AREA_W, width * 0.25);
  const RADIUS  = Math.max(50, Math.min(width / 2 - labelAreaW - 14 - BOUNDS_MARGIN, HEIGHT / 2 - 14));
  const LABEL_R = RADIUS + 14;
  const maxCharsPerLine = Math.max(8, Math.floor((labelAreaW - PILL_PAD_X * 2) / CHAR_W));

  const focusedData = useMemo((): BudgetNode => {
    if (!focusCode) return data;
    return findNode(data, focusCode) ?? data;
  }, [data, focusCode]);

  const focusedName = useMemo((): string | null => {
    if (!focusCode) return null;
    return findNode(data, focusCode)?.name ?? null;
  }, [data, focusCode]);

  const root = useMemo(() => {
    if (!focusedData || RADIUS <= 0) return null;
    const h = hierarchy<BudgetNode>(focusedData)
      .sum(d => (d.children && d.children.length > 0 ? 0 : d.amount))
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    return partition<BudgetNode>().size([2 * Math.PI, RADIUS])(h);
  }, [focusedData, RADIUS]);

  const totalValue = root?.value ?? 1;

  const arcGenerator = arc<ArcParams>()
    .startAngle(d => d.x0).endAngle(d => d.x1)
    .innerRadius(d => d.y0).outerRadius(d => d.y1 - 1);

  const topChildren = root?.children ?? [];

  const colorMap = useMemo(() => {
    const m = new Map<string, string>();
    if (focusCode && focusBaseColor) {
      const variants = variantColors(focusBaseColor, topChildren.length);
      topChildren.forEach((child, i) => m.set(child.data.code, variants[i]));
    } else {
      topChildren.forEach((child, i) => m.set(child.data.code, SUNBURST_COLORS[i % SUNBURST_COLORS.length]));
    }
    return m;
  }, [topChildren, focusCode, focusBaseColor]);

  function getNodeColor(node: HierarchyRectangularNode<BudgetNode>): string {
    if (node.depth === 0) return 'transparent';
    let cur: typeof node = node;
    while (cur.depth > 1 && cur.parent) cur = cur.parent;
    const baseColor = colorMap.get(cur.data.code) ?? '#9ca3af';
    const opacity = node.depth === 1 ? 0.88 : node.depth === 2 ? 0.62 : 0.42;
    return hexToRgba(baseColor, opacity);
  }

  const captureSnapshot = useCallback(() => {
    if (!root) return;
    const snapshot = new Map<string, ArcParams>();
    root.each(n => { if (n.depth > 0 && n.depth <= 3) snapshot.set(n.data.code, { x0: n.x0, x1: n.x1, y0: n.y0, y1: n.y1 }); });
    prevParamsRef.current = snapshot;
  }, [root]);

  const startAnim = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    animStartRef.current = performance.now();
    setAnimProgress(0);
    const tick = (now: number) => {
      const p = Math.min((now - animStartRef.current) / ANIM_MS, 1);
      setAnimProgress(p);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const handleMouseEnter = useCallback((e: React.MouseEvent<SVGPathElement>, node: HierarchyRectangularNode<BudgetNode>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pct = totalValue > 0 ? ((node.value ?? 0) / totalValue) * 100 : 0;
    setTooltip({ visible: true, x: e.clientX - rect.left, y: e.clientY - rect.top,
      name: node.data.name, amount: node.value ?? 0, pct, hasChildren: (node.data.children?.length ?? 0) > 0 });
  }, [totalValue]);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGPathElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip(prev => ({ ...prev, x: e.clientX - rect.left, y: e.clientY - rect.top }));
  }, []);

  const handleClick = useCallback((node: HierarchyRectangularNode<BudgetNode>) => {
    if (node.depth === 0 || (node.data.children?.length ?? 0) === 0) return;
    let cur = node;
    while (cur.depth > 1 && cur.parent) cur = cur.parent;
    const baseColor = colorMap.get(cur.data.code) ?? null;
    captureSnapshot();
    clickedArcRef.current = { x0: node.x0, x1: node.x1, y0: node.y0, y1: node.y1 };
    startAnim();
    setFocusBaseColor(baseColor);
    setFocusCode(node.data.code);
    setTooltip(prev => ({ ...prev, visible: false }));
  }, [captureSnapshot, startAnim, colorMap]);

  const handleBack = useCallback(() => {
    captureSnapshot(); clickedArcRef.current = null;
    startAnim(); setFocusCode(null); setFocusBaseColor(null);
  }, [captureSnapshot, startAnim]);

  const getDisplayedArc = (node: HierarchyRectangularNode<BudgetNode>): ArcParams => {
    const target: ArcParams = { x0: node.x0, x1: node.x1, y0: node.y0, y1: node.y1 };
    if (animProgress >= 1) return target;
    const t = easeInOutCubic(animProgress);
    const prev = prevParamsRef.current.get(node.data.code);
    if (prev) return lerpArc(prev, target, t);
    const from = clickedArcRef.current ?? { x0: 0, x1: 2 * Math.PI, y0: 0, y1: 0 };
    return lerpArc(from, target, t);
  };

  const getNodeOpacity = (node: HierarchyRectangularNode<BudgetNode>): number => {
    if (animProgress >= 1) return 1;
    if (!prevParamsRef.current.has(node.data.code)) return easeInOutCubic(animProgress);
    return 1;
  };

  const nodes: HierarchyRectangularNode<BudgetNode>[] = useMemo(() => {
    if (!root) return [];
    const res: HierarchyRectangularNode<BudgetNode>[] = [];
    root.each(node => { if (node.depth <= 3) res.push(node); });
    return res;
  }, [root]);

  const innerRadius = RADIUS * 0.2;

  const labelColor = isPanel ? 'rgba(0,0,0,0.75)' : 'rgba(255,255,255,0.9)';
  const labelColorMuted = isPanel ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.5)';

  // ── Depth-1 callout labels ────────────────────────────────────────────────
  const pillBg = isPanel ? 'rgba(251,246,239,0.92)' : 'rgba(251,246,239,0.88)';

  function renderCallouts(): React.ReactNode {
    if (!root || animProgress < 1 || width === 0) return null;

    const svgHalfH = HEIGHT / 2;

    type LabelDatum = {
      code: string; baseColor: string;
      pax: number; pay: number;
      lx: number; ly: number;
      onRight: boolean;
      lines: string[]; pct: string;
      pillW: number; pillH: number;
      pillX: number;
      pillY: number;
    };

    const children = root.children ?? [];

    const items: LabelDatum[] = children.map(parent => {
      const baseColor = colorMap.get(parent.data.code) ?? '#9ca3af';
      const mid = (parent.x0 + parent.x1) / 2;
      const [pax, pay] = a2xy(mid, parent.y1 + 2);
      const [lx, ly]   = a2xy(mid, LABEL_R);
      const onRight = lx >= 0;
      const pct   = totalValue > 0 ? ((parent.value ?? 0) / totalValue * 100).toFixed(1) : '0';
      const lines = wrapText(parent.data.name, maxCharsPerLine);
      const pctW  = (pct.length + 2) * 7.5;
      const pillW = Math.max(...lines.map(l => l.length * CHAR_W), pctW) + PILL_PAD_X * 2;
      const pillH = lines.length === 1 ? PILL_H_1 : PILL_H_1 + (lines.length - 1) * 12;
      const pillX = onRight ? lx : lx - pillW;
      const pillY = ly - pillH / 2;
      return { code: parent.data.code, baseColor, pax, pay, lx, ly, onRight, lines, pct, pillW, pillH, pillX, pillY };
    });

    // Resolve vertical overlaps per side — clamp to SVG y bounds
    const resolve = (group: LabelDatum[]) => {
      group.sort((a, b) => a.pillY - b.pillY);
      for (let i = 1; i < group.length; i++) {
        const minY = group[i - 1].pillY + group[i - 1].pillH + LABEL_GAP;
        if (group[i].pillY < minY) group[i].pillY = minY;
      }
      for (let i = group.length - 2; i >= 0; i--) {
        const maxY = group[i + 1].pillY - group[i].pillH - LABEL_GAP;
        if (group[i].pillY > maxY) group[i].pillY = maxY;
      }
      for (const l of group) {
        l.pillY = Math.max(-svgHalfH + BOUNDS_MARGIN, Math.min(svgHalfH - BOUNDS_MARGIN - l.pillH, l.pillY));
      }
    };

    resolve(items.filter(l => l.onRight));
    resolve(items.filter(l => !l.onRight));

    // Push pills outward to clear the sunburst circle — no re-clamp (SVG overflow:visible)
    for (const l of items) {
      const connY = l.pillY + l.pillH / 2;
      const circleX = Math.sqrt(Math.max(0, RADIUS * RADIUS - connY * connY)) + BOUNDS_MARGIN;
      if (l.onRight) {
        if (l.pillX < circleX) l.pillX = circleX;
      } else {
        const maxRight = -circleX;
        if (l.pillX + l.pillW > maxRight) l.pillX = maxRight - l.pillW;
      }
    }

    return items.map(l => {
      const connX = l.onRight ? l.pillX : l.pillX + l.pillW;
      const connY = l.pillY + l.pillH / 2;
      const textX = l.pillX + PILL_PAD_X;
      const multi = l.lines.length > 1;
      // For 1 line: name at +12, pct at +25 (compact layout)
      // For N lines: lines start at +9 spaced 12px, pct after last line + gap
      const lineBaseY = multi ? l.pillY + 9 : l.pillY + 12;
      const pctY = multi ? l.pillY + 9 + l.lines.length * 12 + 4 : l.pillY + 25;

      return (
        <g key={l.code}>
          <circle cx={l.pax} cy={l.pay} r={2} fill={l.baseColor} opacity={0.7} />
          <line x1={l.pax} y1={l.pay} x2={connX} y2={connY}
            stroke={l.baseColor} strokeWidth={1.2} opacity={0.6} />
          <rect x={l.pillX} y={l.pillY} width={l.pillW} height={l.pillH} rx={7} ry={7} fill={pillBg} />
          {l.lines.map((ln, i) => (
            <text key={i} x={textX} y={lineBaseY + i * 12} textAnchor="start" dominantBaseline="middle"
              fontSize={10} fontWeight={700} fill={l.baseColor} style={{ letterSpacing: '0.03em' }}>
              {ln}
            </text>
          ))}
          <text x={textX} y={pctY} textAnchor="start" dominantBaseline="middle"
            fontSize={12} fontWeight={800} fill={l.baseColor} opacity={0.85}>
            {l.pct}%
          </text>
        </g>
      );
    });
  }

  return (
    <div className={`flex flex-col h-full ${isPanel ? 'rounded-2xl border bg-white/80 backdrop-blur-sm p-5' : ''}`}
      style={isPanel ? { borderColor: 'rgba(0,0,0,0.08)', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' } : undefined}
    >
      <div className="flex items-center justify-between mb-2 px-1">
        <p className="text-[10px] font-bold uppercase tracking-tight"
          style={isPanel ? { color: '#6b7280' } : { color: 'rgba(255,255,255,0.6)', textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>
          {subtitle || `Año ${year}`}
        </p>
        {showToggle && (
          <div className={`flex items-center gap-1 p-1 rounded-xl ${isPanel ? 'bg-gray-100 border border-gray-200' : 'bg-black/30 backdrop-blur-sm border border-white/10'}`}>
            {(['planned', 'executed'] as const).map(t => (
              <button key={t} onClick={() => onBudgetTypeChange(t)}
                className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${
                  budgetType === t
                    ? isPanel ? 'bg-white text-gray-800 shadow-sm' : 'bg-white/20 text-white shadow-sm'
                    : isPanel ? 'text-gray-400 hover:text-gray-600' : 'text-white/50 hover:text-white/80'
                }`}>
                {t === 'planned' ? 'PLANIFICADO' : 'EJECUTADO'}
              </button>
            ))}
          </div>
        )}
      </div>

      <div ref={containerRef} className="flex-1 relative" style={{ minHeight: HEIGHT, overflowY: 'clip' }}>
        {/* Top-right label: category name when drilled in, "Presupuesto" at root */}
        <div className="absolute top-2 right-2 pointer-events-none z-10 text-right"
          style={{ fontSize: 11, fontWeight: 700, color: labelColor,
            textShadow: isPanel ? 'none' : '0 1px 4px rgba(0,0,0,0.5)' }}>
          {focusCode && focusedName ? focusedName : 'Presupuesto'}
        </div>
        {width > 0 && RADIUS > 0 && (
          <svg width={width} height={HEIGHT} style={{ display: 'block', overflow: 'visible' }}>
            <g transform={`translate(${width / 2}, ${HEIGHT / 2})`}>

              {/* ── Arcs ── */}
              {nodes.map((node) => {
                if (node.depth === 0) return null;
                const displayed = getDisplayedArc(node);
                const d = arcGenerator(displayed);
                if (!d) return null;
                const hasChildren = (node.data.children?.length ?? 0) > 0;
                return (
                  <path key={node.data.code} d={d}
                    fill={getNodeColor(node)}
                    stroke="rgba(255,255,255,0.07)"
                    strokeWidth={1}
                    opacity={getNodeOpacity(node)}
                    onMouseEnter={e => handleMouseEnter(e, node)}
                    onMouseMove={handleMouseMove}
                    onMouseLeave={() => setTooltip(prev => ({ ...prev, visible: false }))}
                    onClick={() => handleClick(node)}
                    style={{ cursor: hasChildren ? 'zoom-in' : 'default' }}
                  />
                );
              })}

              {/* ── Center hole ── */}
              <circle r={innerRadius}
                fill={isPanel ? 'white' : 'rgba(0,0,0,0.25)'}
                stroke="rgba(255,255,255,0.06)" strokeWidth={1} />


              {/* ── Back button when drilled in ── */}
              {focusCode && (
                <g style={{ cursor: 'pointer' }} onClick={handleBack}>
                  <circle r={innerRadius}
                    fill={isPanel ? 'rgba(30,30,30,0.08)' : 'rgba(0,0,0,0.4)'}
                    stroke="rgba(255,255,255,0.15)" strokeWidth={1.5} />
                  <text textAnchor="middle" dominantBaseline="middle"
                    y={-4} fontSize={18} fill={isPanel ? '#1f2937' : '#ffffff'}>↩</text>
                  <text textAnchor="middle" dominantBaseline="middle"
                    y={12} fontSize={8} fontWeight={800} letterSpacing="0.1em"
                    fill={isPanel ? '#6b7280' : 'rgba(255,255,255,0.7)'}>VOLVER</text>
                </g>
              )}

              {/* ── Callout labels ── */}
              {renderCallouts()}
            </g>

          </svg>
        )}

        {/* ── Tooltip ── */}
        {tooltip.visible && (
          <div className="absolute z-[100] pointer-events-none bg-white/95 backdrop-blur-md border border-black/5 rounded-xl shadow-xl p-3 flex flex-col gap-1 min-w-[180px]"
            style={{ left: tooltip.x + 15, top: tooltip.y - 15, transform: 'translateY(-50%)' }}>
            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">
              Partida presupuestaria
            </div>
            <div className="text-xs font-bold text-gray-800 leading-tight">{tooltip.name}</div>
            {tooltip.hasChildren && (
              <div className="text-[9px] text-blue-500 font-bold mt-0.5">Click para desglosar →</div>
            )}
            <div className="h-px bg-black/5 my-1" />
            <div className="flex justify-between items-end gap-3">
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
