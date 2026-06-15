import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';

interface Props {
  items: string[];
  disabledItems?: Set<string>;
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  accent: string;
  unit?: string;
  formatLabel?: (item: string) => string;
}

type DragMode = 'from' | 'to' | 'shift';
type HoverZone = 'from' | 'to' | 'range' | 'unselected' | null;

interface DragState {
  mode: DragMode;
  startX: number;
  startFromIdx: number;
  startToIdx: number;
}

// Bar geometry constants
const BAR_TOP    = 9;   // px from top of track container
const BAR_HEIGHT = 10;  // px

function CalendarIcon({ color }: { color: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function GripHandle({ accent, lit }: { accent: string; lit: boolean }) {
  return (
    <div
      style={{
        width: 7,
        height: 24,
        borderRadius: 4,
        backgroundColor: accent,
        boxShadow: lit
          ? `0 0 0 3px ${accent}30, 0 3px 10px ${accent}70`
          : `0 2px 6px ${accent}50`,
        flexShrink: 0,
        transition: 'box-shadow 0.15s',
        pointerEvents: 'none',
      }}
    />
  );
}

// ── Label strategy ────────────────────────────────────────────────────────────
const MONTH_NAMES_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function isMonthItem(s: string) { return /^\d{4}-\d{2}$/.test(s); }

function getTickLabel(
  item: string,
  isMonthFmt: boolean,
  isFirst: boolean,
  isLast: boolean,
  formatLabel?: (s: string) => string,
): string | null {
  if (!isMonthFmt) return formatLabel ? formatLabel(item) : item;
  const [year, month] = item.split('-');
  const m = parseInt(month, 10);
  const yy = year.slice(2);
  if (m === 1) return `Ene ${yy}`;
  if (m === 6) return `Jun ${yy}`;
  if (isFirst || isLast) return `${MONTH_NAMES_SHORT[m - 1] ?? month} ${yy}`;
  return null;
}

function getHeaderLabel(
  item: string,
  isMonthFmt: boolean,
  formatLabel?: (s: string) => string,
): string {
  if (formatLabel) return formatLabel(item);
  if (!isMonthFmt) return item;
  const [year, month] = item.split('-');
  const m = parseInt(month, 10);
  return `${MONTH_NAMES_SHORT[m - 1] ?? month} ${year.slice(2)}`;
}

// ── Sequential fill utility ───────────────────────────────────────────────────
// Given a (possibly sparse, possibly duplicate) list of period strings, returns
// the full sequential range and a set marking which entries have no data.
export function fillSequential(rawItems: string[]): { items: string[]; disabled: Set<string> } {
  if (rawItems.length === 0) return { items: [], disabled: new Set() };
  const sorted = [...new Set(rawItems)].sort();
  const enabled = new Set(sorted);

  if (isMonthItem(sorted[0])) {
    const [fy, fm] = sorted[0].split('-').map(Number);
    const [ly, lm] = sorted[sorted.length - 1].split('-').map(Number);
    const all: string[] = [];
    let y = fy, m = fm;
    while (y < ly || (y === ly && m <= lm)) {
      all.push(`${y}-${String(m).padStart(2, '0')}`);
      if (++m > 12) { m = 1; y++; }
    }
    return { items: all, disabled: new Set(all.filter(i => !enabled.has(i))) };
  } else {
    const min = parseInt(sorted[0], 10);
    const max = parseInt(sorted[sorted.length - 1], 10);
    const all = Array.from({ length: max - min + 1 }, (_, i) => String(min + i));
    return { items: all, disabled: new Set(all.filter(i => !enabled.has(i))) };
  }
}

// ── Find nearest enabled index ────────────────────────────────────────────────
function nearestEnabled(
  idx: number,
  n: number,
  disabled: Set<string> | undefined,
  items: string[],
): number {
  const i = Math.max(0, Math.min(n - 1, idx));
  if (!disabled || disabled.size === 0 || !disabled.has(items[i])) return i;
  for (let d = 1; d < n; d++) {
    if (i - d >= 0 && !disabled.has(items[i - d])) return i - d;
    if (i + d < n  && !disabled.has(items[i + d])) return i + d;
  }
  return i;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PeriodRangeTimeline({
  items,
  disabledItems,
  from,
  to,
  onChange,
  accent,
  unit = 'año',
  formatLabel,
}: Props) {
  const trackRef  = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragRef   = useRef<DragState | null>(null);
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fromIdxRef   = useRef(0);
  const toIdxRef     = useRef(0);
  const snapCandidateRef = useRef<number | null>(null);

  const [activeDrag,    setActiveDrag]    = useState<DragMode | null>(null);
  const [displayFromIdx, setDisplayFromIdx] = useState(0);
  const [displayToIdx,   setDisplayToIdx]   = useState(0);
  const [hoverZone,     setHoverZone]     = useState<HoverZone>(null);
  const [canScrollLeft,  setCanScrollLeft]  = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const n          = items.length;
  const isMonthFmt = n > 0 && isMonthItem(items[0]);
  const stride     = isMonthFmt ? 1 : (n <= 7 ? 1 : Math.ceil(n / 7));
  const clampIdx   = (i: number) => Math.max(0, Math.min(n - 1, i));
  const snap       = (idx: number) => nearestEnabled(idx, n, disabledItems, items);

  const visibleLabelIndices = useMemo(() => {
    const candidates: number[] = [];
    for (let i = 0; i < n; i++) {
      const label = getTickLabel(items[i], isMonthFmt, i === 0, i === n - 1, formatLabel);
      if (!label) continue;
      if (!isMonthFmt && i % stride !== 0 && i !== n - 1) continue;
      candidates.push(i);
    }
    const visible = new Set<number>();
    let lastIdx = -Infinity;
    for (const i of candidates) {
      if (i - lastIdx >= 2) { visible.add(i); lastIdx = i; }
    }
    return visible;
  }, [items, n, isMonthFmt, stride, formatLabel]);

  const resolveIdx = useCallback((val: string) => {
    const idx = items.indexOf(val);
    return idx >= 0 ? idx : n > 0 ? n - 1 : 0;
  }, [items, n]);

  useEffect(() => {
    const fi = snap(resolveIdx(from));
    const ti = snap(resolveIdx(to));
    fromIdxRef.current = fi;
    toIdxRef.current   = ti;
    setDisplayFromIdx(fi);
    setDisplayToIdx(ti);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, resolveIdx, n]);

  const updateScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScroll();
    el.addEventListener('scroll', updateScroll);
    window.addEventListener('resize', updateScroll);
    return () => {
      el.removeEventListener('scroll', updateScroll);
      window.removeEventListener('resize', updateScroll);
    };
  }, [n, updateScroll]);

  const fireChange = useCallback((fi: number, ti: number) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onChange(items[fi], items[ti]), 400);
  }, [items, onChange]);

  const getHoverZone = (clientX: number): HoverZone => {
    const track = trackRef.current;
    if (!track || n < 2) return null;
    const { left, width } = track.getBoundingClientRect();
    const x     = clientX - left;
    const fromPx = (fromIdxRef.current / n) * width;
    const toPx   = ((toIdxRef.current + 1) / n) * width;
    if (Math.abs(x - fromPx) <= 14) return 'from';
    if (Math.abs(x - toPx)   <= 14) return 'to';
    if (x > fromPx + 14 && x < toPx - 14) return 'range';
    if (x >= 0 && x <= width) return 'unselected';
    return null;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (n < 2) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const track = trackRef.current;
    if (!track) return;
    const { left, width } = track.getBoundingClientRect();
    const frac       = Math.max(0, Math.min(1 - 1e-9, (e.clientX - left) / width));
    const clickedIdx = snap(clampIdx(Math.floor(frac * n)));
    const x          = e.clientX - left;
    const fi         = fromIdxRef.current;
    const ti         = toIdxRef.current;
    const fromPx     = (fi / n) * width;
    const toPx       = ((ti + 1) / n) * width;
    const distFrom   = Math.abs(x - fromPx);
    const distTo     = Math.abs(x - toPx);

    let mode: DragMode;
    if (distFrom <= 16 && distFrom <= distTo) {
      mode = 'from';
      snapCandidateRef.current = null;
    } else if (distTo <= 16) {
      mode = 'to';
      snapCandidateRef.current = null;
    } else if (clickedIdx < fi || clickedIdx > ti) {
      mode = clickedIdx < fi ? 'from' : 'to';
      snapCandidateRef.current = clickedIdx;
    } else {
      mode = 'shift';
      snapCandidateRef.current = null;
    }

    dragRef.current = { mode, startX: e.clientX, startFromIdx: fi, startToIdx: ti };
    setActiveDrag(mode);
    setHoverZone(null);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) { setHoverZone(getHoverZone(e.clientX)); return; }
    if (n < 2) return;
    const track = trackRef.current;
    if (!track) return;
    const { width } = track.getBoundingClientRect();
    const stepPx     = width / n;
    const deltaSteps = Math.round((e.clientX - drag.startX) / stepPx);

    let fi = fromIdxRef.current;
    let ti = toIdxRef.current;

    if (drag.mode === 'from') {
      fi = snap(Math.min(clampIdx(drag.startFromIdx + deltaSteps), drag.startToIdx - 1));
      fi = Math.min(fi, toIdxRef.current - 1);
      fromIdxRef.current = fi;
    } else if (drag.mode === 'to') {
      ti = snap(Math.max(clampIdx(drag.startToIdx + deltaSteps), drag.startFromIdx + 1));
      ti = Math.max(ti, fromIdxRef.current + 1);
      toIdxRef.current = ti;
    } else {
      const span = drag.startToIdx - drag.startFromIdx;
      fi = snap(clampIdx(drag.startFromIdx + deltaSteps));
      ti = fi + span;
      if (ti > n - 1) { ti = n - 1; fi = ti - span; }
      if (fi < 0)     { fi = 0;     ti = fi + span; }
      fromIdxRef.current = fi;
      toIdxRef.current   = ti;
    }
    setDisplayFromIdx(fromIdxRef.current);
    setDisplayToIdx(toIdxRef.current);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const snapIdx      = snapCandidateRef.current;
    const snapMode     = dragRef.current.mode;
    const displacement = Math.abs(e.clientX - dragRef.current.startX);
    snapCandidateRef.current = null;
    dragRef.current = null;
    setActiveDrag(null);
    if (snapIdx !== null && displacement <= 12) {
      if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }
      const enabledIdx = snap(snapIdx);
      if (snapMode === 'from') {
        fromIdxRef.current = enabledIdx;
        setDisplayFromIdx(enabledIdx);
        onChange(items[enabledIdx], items[toIdxRef.current]);
      } else {
        toIdxRef.current = enabledIdx;
        setDisplayToIdx(enabledIdx);
        onChange(items[fromIdxRef.current], items[enabledIdx]);
      }
    } else {
      fireChange(fromIdxRef.current, toIdxRef.current);
    }
  };

  const onPointerCancel = () => {
    if (!dragRef.current) return;
    snapCandidateRef.current = null;
    dragRef.current = null;
    setActiveDrag(null);
    fireChange(fromIdxRef.current, toIdxRef.current);
  };

  if (n === 0) return null;

  const fi = displayFromIdx;
  const ti = displayToIdx;
  const fromLabel = getHeaderLabel(items[fi] ?? '', isMonthFmt, formatLabel);
  const toLabel   = getHeaderLabel(items[ti] ?? '', isMonthFmt, formatLabel);
  const rangeText = fi === ti ? fromLabel : `${fromLabel} – ${toLabel}`;
  const span      = ti - fi + 1;
  const unitPlural = /[aeiouáéíóú]$/i.test(unit) ? unit + 's' : unit + 'es';
  const sublabel  = `${span} ${span === 1 ? unit : unitPlural}`;

  const leftPct  = (fi / n) * 100;
  const rightPct = ((ti + 1) / n) * 100;

  const cursor = activeDrag === 'shift'        ? 'grabbing'
    : activeDrag                               ? 'ew-resize'
    : hoverZone === 'range'                    ? 'grab'
    : hoverZone === 'unselected'               ? 'pointer'
    : hoverZone                                ? 'ew-resize'
    : 'default';

  return (
    <div
      className="rounded-2xl border bg-white/80 backdrop-blur-sm overflow-hidden select-none"
      style={{ borderColor: 'rgba(0,0,0,0.08)', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `linear-gradient(135deg, ${accent}, ${accent}cc)`, boxShadow: `0 4px 12px ${accent}55` }}
        >
          <CalendarIcon color="white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xl font-bold text-[var(--blue-dark)] leading-tight">{rangeText}</div>
          <div className="text-[10px] text-[var(--blue)] opacity-60 tracking-wide uppercase">{sublabel}</div>
        </div>
      </div>

      {/* ── Divider ────────────────────────────────────────────────────────── */}
      <div className="mx-4" style={{ height: 1, backgroundColor: 'rgba(0,0,0,0.06)' }} />

      {/* ── Track ──────────────────────────────────────────────────────────── */}
      <div className="pb-5 pt-3">
        <div
          ref={scrollRef}
          className="overflow-x-auto no-scrollbar px-4 min-w-0"
          style={{
            WebkitMaskImage: canScrollLeft && canScrollRight
              ? 'linear-gradient(to right, transparent, black 40px, black calc(100% - 40px), transparent)'
              : canScrollLeft
              ? 'linear-gradient(to right, transparent, black 40px, black 100%)'
              : canScrollRight
              ? 'linear-gradient(to right, black calc(100% - 40px), transparent)'
              : undefined,
            maskImage: canScrollLeft && canScrollRight
              ? 'linear-gradient(to right, transparent, black 40px, black calc(100% - 40px), transparent)'
              : canScrollLeft
              ? 'linear-gradient(to right, transparent, black 40px, black 100%)'
              : canScrollRight
              ? 'linear-gradient(to right, black calc(100% - 40px), transparent)'
              : undefined,
          }}
        >
        <div
          ref={trackRef}
          className="relative"
          style={{ height: 56, cursor, touchAction: 'none', minWidth: n * 22 }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onPointerLeave={() => { if (!activeDrag) setHoverZone(null); }}
        >
          {/* ── Per-segment bars (gaps shown as very light slots) ─────────── */}
          {items.map((item, i) => {
            const isDisabled = disabledItems?.has(item) ?? false;
            const inRange    = !isDisabled && i >= fi && i <= ti;
            const bgColor    = isDisabled
              ? 'rgba(0,0,0,0.07)'
              : inRange ? accent : 'rgba(0,0,0,0.22)';
            return (
              <div
                key={`seg-${i}`}
                style={{
                  position: 'absolute',
                  left: `calc(${(i / n) * 100}% + 0.5px)`,
                  width: `calc(${(1 / n) * 100}% - 1px)`,
                  top: BAR_TOP,
                  height: BAR_HEIGHT,
                  borderRadius: BAR_HEIGHT / 2,
                  backgroundColor: bgColor,
                  transition: 'background-color 0.08s',
                }}
              />
            );
          })}

          {/* ── From grip ──────────────────────────────────────────────────── */}
          <div
            className="absolute"
            style={{ left: `${leftPct}%`, top: 4, transform: 'translateX(-50%)', pointerEvents: 'none', zIndex: 3 }}
          >
            <GripHandle accent={accent} lit={activeDrag === 'from' || hoverZone === 'from'} />
          </div>

          {/* ── To grip ────────────────────────────────────────────────────── */}
          <div
            className="absolute"
            style={{ left: `${rightPct}%`, top: 4, transform: 'translateX(-50%)', pointerEvents: 'none', zIndex: 3 }}
          >
            <GripHandle accent={accent} lit={activeDrag === 'to' || hoverZone === 'to'} />
          </div>

          {/* ── Labels at segment midpoints ────────────────────────────────── */}
          {items.map((item, i) => {
            if (!visibleLabelIndices.has(i)) return null;
            const isFirst = i === 0;
            const isLast  = i === n - 1;
            const label = getTickLabel(item, isMonthFmt, isFirst, isLast, formatLabel);
            if (!label) return null;
            const pct     = ((i + 0.5) / n) * 100;
            const isDisabled = disabledItems?.has(item) ?? false;
            const inRange = !isDisabled && i >= fi && i <= ti;
            return (
              <div
                key={`lbl-${i}`}
                className="absolute"
                style={{
                  left: `${pct}%`,
                  top: 30,
                  transform: 'translateX(-50%)',
                  color: isDisabled ? 'rgba(0,0,0,0.18)' : inRange ? accent : 'rgba(0,0,0,0.28)',
                  fontSize: 9,
                  fontWeight: inRange ? 700 : 500,
                  fontStyle: isDisabled ? 'italic' : undefined,
                  letterSpacing: '0.01em',
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                  transition: 'color 0.1s',
                }}
              >
                {label}
              </div>
            );
          })}
        </div>
        </div>
      </div>
    </div>
  );
}
