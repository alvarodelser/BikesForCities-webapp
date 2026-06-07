import React, { useRef, useState, useEffect, useCallback } from 'react';

interface Props {
  items: string[];
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
const DIVOT_H    = 4;   // px — notch depth from each edge
const DIVOT_W    = 3;   // half-width of each notch triangle

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
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2.5,
        flexShrink: 0,
        transition: 'box-shadow 0.15s',
        pointerEvents: 'none',
      }}
    >
      {[0, 1, 2].map(i => (
        <div key={i} style={{ width: 3, height: 1.2, backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 1 }} />
      ))}
    </div>
  );
}

// ── Label strategy ────────────────────────────────────────────────────────────
// For YYYY-MM items: always show first/last item; show Jan and Jun with 2-digit year.
// For other items: show up to 7 evenly-spaced labels.

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

// Header display — always returns a string for the selected from/to item.
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

// ── Component ─────────────────────────────────────────────────────────────────

export default function PeriodRangeTimeline({
  items,
  from,
  to,
  onChange,
  accent,
  unit = 'año',
  formatLabel,
}: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef  = useRef<DragState | null>(null);
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fromIdxRef   = useRef(0);
  const toIdxRef     = useRef(0);
  const snapCandidateRef = useRef<number | null>(null);

  const [activeDrag,    setActiveDrag]    = useState<DragMode | null>(null);
  const [displayFromIdx, setDisplayFromIdx] = useState(0);
  const [displayToIdx,   setDisplayToIdx]   = useState(0);
  const [hoverZone,     setHoverZone]     = useState<HoverZone>(null);

  const n            = items.length;
  const isMonthFmt   = n > 0 && isMonthItem(items[0]);
  const clampIdx     = (i: number) => Math.max(0, Math.min(n - 1, i));

  const resolveIdx = useCallback((val: string) => {
    const idx = items.indexOf(val);
    return idx >= 0 ? idx : n > 0 ? n - 1 : 0;
  }, [items, n]);

  useEffect(() => {
    const fi = resolveIdx(from);
    const ti = resolveIdx(to);
    fromIdxRef.current = fi;
    toIdxRef.current   = ti;
    setDisplayFromIdx(fi);
    setDisplayToIdx(ti);
  }, [from, to, resolveIdx]);

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
    const clickedIdx = clampIdx(Math.floor(frac * n));
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
    if (snapCandidateRef.current !== null && Math.abs(e.clientX - drag.startX) > 5) {
      snapCandidateRef.current = null;
    }
    if (n < 2) return;
    const track = trackRef.current;
    if (!track) return;
    const { width } = track.getBoundingClientRect();
    const stepPx     = width / n;
    const deltaSteps = Math.round((e.clientX - drag.startX) / stepPx);

    let fi = fromIdxRef.current;
    let ti = toIdxRef.current;

    if (drag.mode === 'from') {
      fi = Math.min(clampIdx(drag.startFromIdx + deltaSteps), drag.startToIdx - 1);
      fromIdxRef.current = fi;
    } else if (drag.mode === 'to') {
      ti = Math.max(clampIdx(drag.startToIdx + deltaSteps), drag.startFromIdx + 1);
      toIdxRef.current = ti;
    } else {
      const span = drag.startToIdx - drag.startFromIdx;
      fi = clampIdx(drag.startFromIdx + deltaSteps);
      ti = fi + span;
      if (ti > n - 1) { ti = n - 1; fi = ti - span; }
      if (fi < 0)     { fi = 0;     ti = fi + span; }
      fromIdxRef.current = fi;
      toIdxRef.current   = ti;
    }
    setDisplayFromIdx(fromIdxRef.current);
    setDisplayToIdx(toIdxRef.current);
  };

  const onPointerUp = () => {
    if (!dragRef.current) return;
    const snapIdx = snapCandidateRef.current;
    snapCandidateRef.current = null;
    dragRef.current = null;
    setActiveDrag(null);
    if (snapIdx !== null) {
      fromIdxRef.current = snapIdx;
      toIdxRef.current = snapIdx;
      setDisplayFromIdx(snapIdx);
      setDisplayToIdx(snapIdx);
      fireChange(snapIdx, snapIdx);
    } else {
      fireChange(fromIdxRef.current, toIdxRef.current);
    }
  };

  if (n === 0) return null;

  const fi = displayFromIdx;
  const ti = displayToIdx;
  const fromLabel = getHeaderLabel(items[fi] ?? '', isMonthFmt, formatLabel);
  const toLabel   = getHeaderLabel(items[ti] ?? '', isMonthFmt, formatLabel);
  const rangeText = fi === ti ? fromLabel : `${fromLabel} – ${toLabel}`;
  const span      = ti - fi + 1;
  const sublabel  = `${span} ${span === 1 ? unit : unit + 's'}`;

  // Handle positions (at segment boundaries, not midpoints)
  const leftPct  = (fi / n) * 100;
  const rightPct = ((ti + 1) / n) * 100;

  // For non-month items: stride-based label density
  const stride = isMonthFmt ? 1 : (n <= 7 ? 1 : Math.ceil(n / 7));

  const cursor = activeDrag === 'shift'        ? 'grabbing'
    : activeDrag                               ? 'ew-resize'
    : hoverZone === 'range'                    ? 'grab'
    : hoverZone === 'unselected'               ? 'pointer'
    : hoverZone                                ? 'ew-resize'
    : 'default';

  // Divot at every interior boundary (i = 1 .. n-1)
  const divotBoundaries = Array.from({ length: n - 1 }, (_, i) => i + 1);

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
      <div className="px-4 pb-5 pt-3">
        <div
          ref={trackRef}
          className="relative"
          style={{ height: 56, cursor, touchAction: 'none' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={() => { if (!activeDrag) setHoverZone(null); }}
        >
          {/* ── Continuous pill bar (gradient for selected region) ──────── */}
          <div
            className="absolute left-0 right-0"
            style={{
              top: BAR_TOP,
              height: BAR_HEIGHT,
              borderRadius: BAR_HEIGHT / 2,
              background: `linear-gradient(to right, rgba(0,0,0,0.09) ${leftPct}%, ${accent} ${leftPct}%, ${accent} ${rightPct}%, rgba(0,0,0,0.09) ${rightPct}%)`,
              transition: 'background 0.08s',
            }}
          />

          {/* ── Triangular divots at every snap boundary ───────────────── */}
          {divotBoundaries.map(i => {
            const pct = (i / n) * 100;
            const sharedStyle: React.CSSProperties = {
              position: 'absolute',
              left: `${pct}%`,
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              pointerEvents: 'none',
              zIndex: 2,
            };
            return (
              <React.Fragment key={`d${i}`}>
                {/* Top notch — ∨ pointing into bar from above */}
                <div style={{
                  ...sharedStyle,
                  top: BAR_TOP,
                  borderLeft:   `${DIVOT_W}px solid transparent`,
                  borderRight:  `${DIVOT_W}px solid transparent`,
                  borderTop:    `${DIVOT_H}px solid rgba(255,255,255,0.95)`,
                }} />
                {/* Bottom notch — ∧ pointing into bar from below */}
                <div style={{
                  ...sharedStyle,
                  top: BAR_TOP + BAR_HEIGHT - DIVOT_H,
                  borderLeft:   `${DIVOT_W}px solid transparent`,
                  borderRight:  `${DIVOT_W}px solid transparent`,
                  borderBottom: `${DIVOT_H}px solid rgba(255,255,255,0.95)`,
                }} />
              </React.Fragment>
            );
          })}

          {/* ── From grip ──────────────────────────────────────────────── */}
          <div
            className="absolute"
            style={{ left: `${leftPct}%`, top: 4, transform: 'translateX(-50%)', pointerEvents: 'none' }}
          >
            <GripHandle accent={accent} lit={activeDrag === 'from' || hoverZone === 'from'} />
          </div>

          {/* ── To grip ────────────────────────────────────────────────── */}
          <div
            className="absolute"
            style={{ left: `${rightPct}%`, top: 4, transform: 'translateX(-50%)', pointerEvents: 'none' }}
          >
            <GripHandle accent={accent} lit={activeDrag === 'to' || hoverZone === 'to'} />
          </div>

          {/* ── Labels at segment midpoints ────────────────────────────── */}
          {items.map((item, i) => {
            const isFirst = i === 0;
            const isLast  = i === n - 1;
            const label = getTickLabel(item, isMonthFmt, isFirst, isLast, formatLabel);
            if (isMonthFmt && label === null) return null;
            if (!isMonthFmt && i % stride !== 0 && !isLast) return null;
            if (!label) return null;
            const pct     = ((i + 0.5) / n) * 100;
            const inRange = i >= fi && i <= ti;
            return (
              <div
                key={item}
                className="absolute"
                style={{
                  left: `${pct}%`,
                  top: 30,
                  transform: 'translateX(-50%)',
                  color: inRange ? accent : 'rgba(0,0,0,0.28)',
                  fontSize: 9,
                  fontWeight: inRange ? 700 : 500,
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
  );
}
