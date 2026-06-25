import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { hierarchy, partition, type HierarchyRectangularNode } from 'd3-hierarchy';
import { arc } from 'd3-shape';
import { Bicycle, Bus, RoadHorizon, TrafficCone, Wrench, type Icon } from '@phosphor-icons/react';

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
  showBudgetTypeToggle?: boolean;
  mobilityHighlight?: Set<string>;
}

export const MOBILITY_CODES = new Set(['133', '134', '44', '153', '442']);

const MOBILITY_ICONS: Record<string, Icon> = {
  '133': TrafficCone,
  '134': Bicycle,
  '44':  Bus,
  '153': RoadHorizon,
  '442': Wrench,
};

const MOBILITY_LEGEND: Record<string, string> = {
  '133': 'Tráfico',
  '134': 'Movilidad urbana',
  '44':  'Transporte público',
  '153': 'Vías públicas',
  '442': 'Infraest. transporte',
};

export const SUNBURST_COLORS = [
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
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) return `€${(amount/1_000_000).toFixed(1)} M`;
  if (abs >= 1_000)     return `€${(amount/1_000).toFixed(1)} K`;
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
const BOUNDS_MARGIN = 8;
const PILL_H_1 = 34;          // single-line pill height
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

interface HoverState {
  parentCode: string;
  nodeName: string;
  nodeAmount: number;
  nodePct: number;
  nodeHasChildren: boolean;
  highlightCodes: Set<string>;
}

export const BudgetSunburst: React.FC<BudgetSunburstProps> = ({
  data, budgetType, onBudgetTypeChange,
  variant = 'overlay', showToggle = true, showBudgetTypeToggle = true, mobilityHighlight,
}) => {
  const isPanel = variant === 'panel';
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(600);
  const [focusCode, setFocusCode] = useState<string | null>(null);
  const [focusBaseColor, setFocusBaseColor] = useState<string | null>(null);
  const [hovered, setHovered] = useState<HoverState | null>(null);

  const prevParamsRef  = useRef<Map<string, ArcParams>>(new Map());
  const clickedArcRef  = useRef<ArcParams | null>(null);
  const animStartRef   = useRef<number>(0);
  const rafRef         = useRef<number>(0);
  const [animProgress, setAnimProgress] = useState(1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      if (entries[0]) {
        setWidth(entries[0].contentRect.width);
        setHeight(entries[0].contentRect.height || 600);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    setFocusCode(null); setFocusBaseColor(null);
    prevParamsRef.current = new Map(); clickedArcRef.current = null;
    setAnimProgress(1); cancelAnimationFrame(rafRef.current);
  }, [data]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const HEIGHT = Math.max(400, height);
  // Label area scales with viewport, floor at MIN_LABEL_AREA_W
  const labelAreaW = Math.max(MIN_LABEL_AREA_W, width * 0.27);
  const RADIUS  = Math.max(50, Math.min(width / 2 - labelAreaW - 6 - BOUNDS_MARGIN, HEIGHT / 2 - 10));
  const MAX_ARC_R = RADIUS + 20;  // sunburst extends past callout arc indicators
  const innerRadius = RADIUS * 0.42;
  const pillAreaW = Math.max(MIN_LABEL_AREA_W, width * 0.27);
  const maxCharsPerLine = Math.max(8, Math.floor((pillAreaW - PILL_PAD_X * 2) / CHAR_W));

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
    return partition<BudgetNode>().size([2 * Math.PI, MAX_ARC_R])(h);
  }, [focusedData, RADIUS]);

  const totalValue = root?.value ?? 1;

  // Equal-width bands: divide (MAX_ARC_R − innerRadius) evenly across depth levels
  const maxDepth = root?.height ?? 3;
  const bandW = maxDepth > 0 ? (MAX_ARC_R - innerRadius) / maxDepth : MAX_ARC_R - innerRadius;

  const arcGenerator = arc<ArcParams>()
    .startAngle(d => d.x0).endAngle(d => d.x1)
    .innerRadius(d => d.y0).outerRadius(d => d.y1);

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

  function getNodeColor(node: HierarchyRectangularNode<BudgetNode>, highlighted = false): string {
    if (node.depth === 0) return 'transparent';
    const isMobility = mobilityHighlight?.has(node.data.code) ?? false;
    let cur: typeof node = node;
    while (cur.depth > 1 && cur.parent) cur = cur.parent;
    const baseColor = isMobility ? '#059669' : (colorMap.get(cur.data.code) ?? '#9ca3af');
    const opacity = highlighted
      ? (node.depth === 1 ? 0.95 : node.depth === 2 ? 0.80 : 0.65)
      : (node.depth === 1 ? 0.88 : node.depth === 2 ? 0.62 : 0.42);
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

  const handleArcMouseEnter = useCallback((node: HierarchyRectangularNode<BudgetNode>) => {
    let top = node;
    while (top.depth > 1 && top.parent) top = top.parent;
    const pct = totalValue > 0 ? ((node.value ?? 0) / totalValue) * 100 : 0;
    const highlightCodes = new Set<string>();
    // descendants (including self)
    node.each(n => highlightCodes.add(n.data.code));
    // ancestors up to depth 1
    let anc = node.parent;
    while (anc && anc.depth > 0) { highlightCodes.add(anc.data.code); anc = anc.parent; }
    setHovered({
      parentCode: top.data.code,
      nodeName: node.data.name,
      nodeAmount: node.value ?? 0,
      nodePct: pct,
      nodeHasChildren: (node.data.children?.length ?? 0) > 0,
      highlightCodes,
    });
  }, [totalValue]);

  const handleLegendEnter = useCallback((code: string) => {
    if (!root) return;
    let target: HierarchyRectangularNode<BudgetNode> | null = null;
    root.each(n => { if (n.data.code === code) target = n; });
    if (!target) return;
    const t = target as HierarchyRectangularNode<BudgetNode>;
    const highlightCodes = new Set<string>();
    t.each(n => highlightCodes.add(n.data.code));
    let anc = t.parent;
    while (anc && anc.depth > 0) { highlightCodes.add(anc.data.code); anc = anc.parent; }
    let top = t;
    while (top.depth > 1 && top.parent) top = top.parent;
    setHovered({
      parentCode: top.data.code,
      nodeName: t.data.name,
      nodeAmount: t.value ?? 0,
      nodePct: totalValue > 0 ? ((t.value ?? 0) / totalValue) * 100 : 0,
      nodeHasChildren: (t.data.children?.length ?? 0) > 0,
      highlightCodes,
    });
  }, [root, totalValue]);

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
    setHovered(null);
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
    const animOp = animProgress >= 1 ? 1 : (prevParamsRef.current.has(node.data.code) ? 1 : easeInOutCubic(animProgress));
    if (!hovered) return animOp;
    let cur = node;
    while (cur.depth > 1 && cur.parent) cur = cur.parent;
    return hovered.highlightCodes.has(node.data.code) ? animOp : animOp * 0.5;
  };

  const nodes: HierarchyRectangularNode<BudgetNode>[] = useMemo(() => {
    if (!root) return [];
    const res: HierarchyRectangularNode<BudgetNode>[] = [];
    root.each(node => { if (node.depth <= 3) res.push(node); });
    return res;
  }, [root]);

  // ── Depth-1 callout labels ────────────────────────────────────────────────
  const pillBg = isPanel ? 'rgba(251,246,239,0.92)' : 'rgba(251,246,239,0.88)';

  function renderCallouts(): React.ReactNode {
    if (!root || animProgress < 1 || width === 0) return null;

    const svgHalfH = HEIGHT / 2;
    const TOP_MARGIN = 20;  // px from canvas top edge to first pill
    const COL_GAP    = 6;   // px between stacked pills
    const COL_OFFSET = 14;  // px gap between circle edge and pill column

    type LabelDatum = {
      code: string; baseColor: string;
      pax: number; pay: number;
      arcPath: string;
      onRight: boolean;
      lines: string[]; pct: string; eur: string;
      pillW: number; pillH: number;
      pillX: number; pillY: number;
      node: HierarchyRectangularNode<BudgetNode>;
    };

    const children = root.children ?? [];

    const items: LabelDatum[] = children.map(parent => {
      const baseColor = colorMap.get(parent.data.code) ?? '#9ca3af';
      const mid = (parent.x0 + parent.x1) / 2;
      // Connector and indicator arc start from the outer edge of the arc ring
      const [pax, pay] = a2xy(mid, MAX_ARC_R);
      const onRight    = Math.sin(mid) >= 0;
      const ARC_GAP = Math.min(0.03, (parent.x1 - parent.x0) * 0.08);
      const trimX0 = parent.x0 + ARC_GAP, trimX1 = parent.x1 - ARC_GAP;
      const ax0 = Math.sin(trimX0) * MAX_ARC_R, ay0 = -Math.cos(trimX0) * MAX_ARC_R;
      const ax1 = Math.sin(trimX1) * MAX_ARC_R, ay1 = -Math.cos(trimX1) * MAX_ARC_R;
      const largeArc = (trimX1 - trimX0) > Math.PI ? 1 : 0;
      const arcPath = `M ${ax0.toFixed(2)} ${ay0.toFixed(2)} A ${MAX_ARC_R} ${MAX_ARC_R} 0 ${largeArc} 1 ${ax1.toFixed(2)} ${ay1.toFixed(2)}`;
      const pct   = totalValue > 0 ? ((parent.value ?? 0) / totalValue * 100).toFixed(1) : '0';
      const eur   = formatEur(parent.value ?? 0);
      const lines = wrapText(parent.data.name, maxCharsPerLine);
      const bottomRowW = (pct.length + 2) * 7.5 + 8 + eur.length * 7.5;
      const pillW = Math.max(...lines.map(l => l.length * CHAR_W), bottomRowW) + PILL_PAD_X * 2;
      const pillH = lines.length === 1 ? PILL_H_1 : PILL_H_1 + (lines.length - 1) * 12;
      return { code: parent.data.code, baseColor, pax, pay, arcPath, onRight,
               lines, pct, eur, pillW, pillH, pillX: 0, pillY: 0, node: parent };
    });

    // ── Assign columns: geometric left/right split, sorted top-to-bottom ─────
    const rightGroup = items.filter(l =>  l.onRight).sort((a, b) => a.pay - b.pay);
    const leftGroup  = items.filter(l => !l.onRight).sort((a, b) => a.pay - b.pay);

    // Available width per side = canvas half-width minus outer arc ring edge minus gap minus margin
    const svgHalfW = width / 2;
    const availW = Math.max(40, svgHalfW - BOUNDS_MARGIN - MAX_ARC_R - COL_OFFSET);

    // Normalize pill widths within each column, capped to available space
    const maxRW = rightGroup.length > 0 ? Math.min(Math.max(...rightGroup.map(l => l.pillW)), availW) : 0;
    const maxLW = leftGroup.length  > 0 ? Math.min(Math.max(...leftGroup.map(l => l.pillW)),  availW) : 0;
    for (const l of rightGroup) l.pillW = maxRW;
    for (const l of leftGroup)  l.pillW = maxLW;

    // Column x anchors just outside the outer arc ring — guaranteed to fit within canvas
    const rightColX = MAX_ARC_R + COL_OFFSET;
    const leftColX  = -(MAX_ARC_R + COL_OFFSET + maxLW);

    // Seed each pill at the y of its arc sector midpoint, then resolve overlaps
    for (const l of rightGroup) { l.pillX = rightColX; l.pillY = l.pay - l.pillH / 2; }
    for (const l of leftGroup)  { l.pillX = leftColX;  l.pillY = l.pay - l.pillH / 2; }

    const resolveY = (group: LabelDatum[]) => {
      // Push down pass
      for (let i = 1; i < group.length; i++) {
        const minY = group[i - 1].pillY + group[i - 1].pillH + COL_GAP;
        if (group[i].pillY < minY) group[i].pillY = minY;
      }
      // Push up pass
      for (let i = group.length - 2; i >= 0; i--) {
        const maxY = group[i + 1].pillY - group[i].pillH - COL_GAP;
        if (group[i].pillY > maxY) group[i].pillY = maxY;
      }
      // Clamp to canvas bounds
      for (const l of group) {
        l.pillY = Math.max(-svgHalfH + TOP_MARGIN, Math.min(svgHalfH - BOUNDS_MARGIN - l.pillH, l.pillY));
      }
    };

    resolveY(rightGroup);
    resolveY(leftGroup);

    const INFO_PAD_X = 9;
    const INFO_PAD_Y = 7;
    const INFO_LINE_H = 14;
    const INFO_GAP = 5;

    return items.map(l => {
      const isActive = hovered?.parentCode === l.code;
      const anyHovered = hovered !== null;
      const labelOpacity = anyHovered ? (isActive ? 1 : 0) : 1;

      const connX = l.onRight ? l.pillX : l.pillX + l.pillW;
      const connY = l.pillY + 10;

      // Polyline with only 45°/horizontal segments: diagonal to label y-level, then horizontal
      const dy = connY - l.pay;
      const elbowDX = l.onRight ? Math.abs(dy) : -Math.abs(dy);
      let elbowX = l.pax + elbowDX;
      if (l.onRight) elbowX = Math.min(elbowX, connX);
      else elbowX = Math.max(elbowX, connX);
      const polyPoints = Math.abs(dy) < 0.5
        ? `${l.pax.toFixed(2)},${l.pay.toFixed(2)} ${connX.toFixed(2)},${connY.toFixed(2)}`
        : `${l.pax.toFixed(2)},${l.pay.toFixed(2)} ${elbowX.toFixed(2)},${connY.toFixed(2)} ${connX.toFixed(2)},${connY.toFixed(2)}`;

      const textX = l.pillX + PILL_PAD_X;
      const multi = l.lines.length > 1;
      const lineBaseY = multi ? l.pillY + 9 : l.pillY + 12;
      const pctY = multi ? l.pillY + 9 + l.lines.length * 12 + 4 : l.pillY + 25;

      // Info box content (shown only when a child arc is hovered)
      const showName = isActive && hovered ? hovered.nodeName !== l.node.data.name : false;
      let infoBox: React.ReactNode = null;
      if (isActive && hovered && showName) {
        const hasHint = hovered.nodeHasChildren;
        const nameLines = wrapText(hovered.nodeName, maxCharsPerLine);
        const nameRowCount = nameLines.length;
        const rowCount = nameRowCount + 1 /* amount+pct */ + (hasHint ? 1 : 0);
        const infoH = INFO_PAD_Y * 2 + rowCount * INFO_LINE_H + (rowCount - 1) * 2;
        const infoY = l.pillY + l.pillH + INFO_GAP;
        const infoX = l.pillX;
        const rowY = (i: number) => infoY + INFO_PAD_Y + i * (INFO_LINE_H + 2) + INFO_LINE_H / 2;

        infoBox = (
          <g>
            <rect x={infoX} y={infoY} width={l.pillW} height={infoH} rx={7} ry={7}
              fill={pillBg} stroke={l.baseColor} strokeWidth={1.5} opacity={0.97} />
            {nameLines.map((ln, i) => (
              <text key={i} x={infoX + INFO_PAD_X} y={rowY(i)} textAnchor="start" dominantBaseline="middle"
                fontSize={10} fontWeight={700} fill={l.baseColor} style={{ letterSpacing: '0.03em' }}>
                {ln}
              </text>
            ))}
            <text x={infoX + INFO_PAD_X} y={rowY(nameRowCount)} textAnchor="start" dominantBaseline="middle"
              fontSize={11} fontWeight={800} fill={l.baseColor} opacity={0.85}>
              {hovered.nodePct.toFixed(1)}%
            </text>
            <text x={infoX + l.pillW - INFO_PAD_X} y={rowY(nameRowCount)} textAnchor="end" dominantBaseline="middle"
              fontSize={11} fontWeight={700} fill={l.baseColor} opacity={0.7}>
              {formatEur(hovered.nodeAmount)}
            </text>
            {hasHint && (
              <text x={infoX + INFO_PAD_X} y={rowY(nameRowCount + 1)} textAnchor="start" dominantBaseline="middle"
                fontSize={9} fontWeight={600} fill={hexToRgba(l.baseColor, 0.55)} style={{ letterSpacing: '0.02em' }}>
                → Click para desglosar
              </text>
            )}
          </g>
        );
      }

      const setLabelHover = () => {
        const nodeVal = l.node.value ?? 0;
        const pct = totalValue > 0 ? (nodeVal / totalValue) * 100 : 0;
        const highlightCodes = new Set<string>();
        l.node.each(n => highlightCodes.add(n.data.code));
        setHovered({
          parentCode: l.code,
          nodeName: l.node.data.name,
          nodeAmount: nodeVal,
          nodePct: pct,
          nodeHasChildren: (l.node.data.children?.length ?? 0) > 0,
          highlightCodes,
        });
      };

      return (
        <g key={l.code} opacity={labelOpacity} style={{ cursor: 'default', transition: 'opacity 0.15s' }}
          onMouseEnter={setLabelHover}
          onMouseLeave={() => setHovered(null)}>
          <path d={l.arcPath} fill="none" stroke={l.baseColor} strokeWidth={2} opacity={0.5} />
          <polyline points={polyPoints} fill="none"
            stroke={l.baseColor} strokeWidth={1.2} opacity={0.6} />
          <rect x={l.pillX} y={l.pillY} width={l.pillW} height={l.pillH} rx={7} ry={7}
            fill={pillBg} stroke={l.baseColor} strokeWidth={1.5} opacity={0.95} />
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
          <text x={l.pillX + l.pillW - PILL_PAD_X} y={pctY} textAnchor="end" dominantBaseline="middle"
            fontSize={11} fontWeight={700} fill={l.baseColor} opacity={0.7}>
            {l.eur}
          </text>
          {infoBox}
        </g>
      );
    });
  }

  return (
    <div className={`flex flex-col h-full ${isPanel ? 'rounded-2xl border bg-white/80 backdrop-blur-sm p-5' : ''}`}
      style={isPanel ? { borderColor: 'rgba(0,0,0,0.08)', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' } : undefined}
    >
      {showToggle && (
        <div className="flex items-center justify-between gap-2 mb-2 px-1 flex-wrap">
          {/* Functional category filter */}
          <div className={`flex items-center gap-1 p-1 rounded-xl flex-wrap ${isPanel ? 'bg-gray-100 border border-gray-200' : 'bg-black/30 backdrop-blur-sm border border-white/10'}`}>
            <button
              onClick={focusCode ? handleBack : undefined}
              className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                !focusCode
                  ? isPanel ? 'bg-white text-gray-800 shadow-sm' : 'bg-white/20 text-white shadow-sm'
                  : isPanel ? 'text-gray-400 hover:text-gray-600' : 'text-white/50 hover:text-white/80'
              }`}
            >
              TODOS
            </button>
            {topChildren.map(child => {
              const color = colorMap.get(child.data.code) ?? '#9ca3af';
              const isActive = focusCode === child.data.code;
              const label = child.data.name.length > 13 ? child.data.name.slice(0, 12) + '…' : child.data.name;
              return (
                <button
                  key={child.data.code}
                  title={child.data.name}
                  onClick={() => isActive ? handleBack() : handleClick(child)}
                  className="px-2 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1"
                  style={{
                    background: isActive ? color : 'transparent',
                    color: isActive ? 'white' : isPanel ? '#6b7280' : 'rgba(255,255,255,0.7)',
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: 2, background: color, display: 'inline-block', flexShrink: 0 }} />
                  {label}
                </button>
              );
            })}
          </div>

          {/* Planned / executed */}
          {showBudgetTypeToggle && (
            <div className={`flex items-center gap-1 p-1 rounded-xl flex-shrink-0 ${isPanel ? 'bg-gray-100 border border-gray-200' : 'bg-black/30 backdrop-blur-sm border border-white/10'}`}>
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
      )}

      <div ref={containerRef} className="flex-1 min-h-0 relative overflow-hidden" style={{ isolation: 'isolate' }}>
        {width > 0 && RADIUS > 0 && (
          <svg width={width} height={HEIGHT} style={{ display: 'block', overflow: 'hidden' }}>
            <g transform={`translate(${width / 2}, ${HEIGHT / 2})`}>

              {/* ── Arcs ── */}
              {nodes.map((node) => {
                if (node.depth === 0) return null;
                const displayed = getDisplayedArc(node);
                const nodeInnerR = innerRadius + (node.depth - 1) * bandW;
                const nodeOuterR = innerRadius + node.depth * bandW - 1;
                const d = arcGenerator({ ...displayed, y0: nodeInnerR, y1: nodeOuterR });
                if (!d) return null;
                const hasChildren = (node.data.children?.length ?? 0) > 0;
                const highlighted = !hovered || hovered.highlightCodes.has(node.data.code);
                const isMobility = mobilityHighlight?.has(node.data.code) ?? false;
                const arcSpan = displayed.x1 - displayed.x0;
                const midAngle = (displayed.x0 + displayed.x1) / 2;
                const midR = (nodeInnerR + nodeOuterR) / 2;
                const [iconX, iconY] = a2xy(midAngle, midR);
                return (
                  <React.Fragment key={node.data.code}>
                    <path d={d}
                      fill={getNodeColor(node, highlighted)}
                      stroke="rgba(255,255,255,0.07)"
                      strokeWidth={1}
                      opacity={getNodeOpacity(node)}
                      onMouseEnter={() => handleArcMouseEnter(node)}
                      onMouseLeave={() => setHovered(null)}
                      onClick={() => handleClick(node)}
                      style={{ cursor: hasChildren ? 'zoom-in' : 'default', transition: 'opacity 0.15s' }}
                    />
                    {isMobility && arcSpan > 0.12 && (() => {
                      const IconComp = MOBILITY_ICONS[node.data.code];
                      if (!IconComp) return null;
                      const sz = 10;
                      return (
                        <g
                          transform={`translate(${iconX - sz / 2}, ${iconY - sz / 2})`}
                          opacity={getNodeOpacity(node)}
                          style={{ pointerEvents: 'none' }}
                        >
                          <IconComp size={sz} weight="bold" color="rgba(255,255,255,0.9)" />
                        </g>
                      );
                    })()}
                  </React.Fragment>
                );
              })}

              {/* ── Center circle ── */}
              {(() => {
                const labelText = (focusCode && focusedName) ? focusedName : 'Presupuesto';
                const fSize = Math.max(8, Math.min(12, innerRadius * 0.22));
                const charsPerLine = Math.max(6, Math.floor((innerRadius * 1.3) / (fSize * 0.62)));
                const lines = wrapText(labelText, charsPerLine).slice(0, 2);
                const lineH = fSize + 3;
                const amountText = formatEur(totalValue);
                const amountFSize = Math.max(9, Math.min(14, innerRadius * 0.26));
                // Shift label block up slightly to center label+amount together
                const labelCY = focusCode ? -(innerRadius * 0.28) : -(amountFSize * 0.55);
                const amountY = labelCY + (lines.length * 0.5 + 0.5) * lineH + amountFSize * 0.1 + 3;
                const volverY = innerRadius * 0.62;
                return (
                  <g style={focusCode ? { cursor: 'pointer' } : undefined} onClick={focusCode ? handleBack : undefined}>
                    <circle r={innerRadius} fill="rgba(250,245,238,0.50)" stroke="rgba(51,65,85,0.08)" strokeWidth={1} />
                    {lines.map((ln, i) => (
                      <text key={i}
                        textAnchor="middle" dominantBaseline="middle"
                        x={0} y={labelCY + (i - (lines.length - 1) / 2) * lineH}
                        fontSize={fSize} fontWeight={700} letterSpacing="0.07em"
                        fill="#334155">
                        {ln}
                      </text>
                    ))}
                    <text textAnchor="middle" dominantBaseline="middle"
                      x={0} y={amountY}
                      fontSize={amountFSize} fontWeight={800} letterSpacing="0.03em"
                      fill="#334155" opacity={0.8}>
                      {amountText}
                    </text>
                    {focusCode && (
                      <text textAnchor="middle" dominantBaseline="middle"
                        y={volverY}
                        fontSize={fSize * 0.78} fontWeight={700} letterSpacing="0.10em"
                        fill="#64748b">
                        ← VOLVER
                      </text>
                    )}
                  </g>
                );
              })()}

              {/* ── Callout labels ── */}
              {renderCallouts()}
            </g>

          </svg>
        )}

        {/* ── Highlight legend ── */}
        {mobilityHighlight && mobilityHighlight.size > 0 && (
          <div className="absolute bottom-8 right-6 flex flex-col items-end gap-0.5">
            {[...mobilityHighlight].map(code => {
              const IconComp = MOBILITY_ICONS[code];
              const label = MOBILITY_LEGEND[code] ?? findNode(data, code)?.name ?? code;
              return (
                <div
                  key={code}
                  className="flex items-center gap-1 cursor-default"
                  onMouseEnter={() => handleLegendEnter(code)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <span style={{ fontSize: 8, fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.85 }}>
                    {label}
                  </span>
                  {IconComp && <IconComp size={9} weight="bold" color="#059669" />}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default BudgetSunburst;
