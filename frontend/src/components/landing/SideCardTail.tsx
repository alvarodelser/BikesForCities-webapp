import {
  type ReactNode,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { useViewport } from '../../hooks/useViewport';

interface Rect { left: number; top: number; width: number; height: number; }
interface Layout {
  side: 'left' | 'right';
  card: Rect;
  pin: { x: number; y: number };
}

const CARD_WIDTH = 300;
const CARD_MARGIN = 40;
const VIEWPORT_MARGIN = 16;

function computeLayout(
  target: DOMRect,
  cardH: number,
  viewportW: number,
  viewportH: number,
  preferred: 'auto' | 'left' | 'right',
  layoutMode: 'default' | 'map' = 'default',
): Layout {
  const targetCX = target.left + target.width / 2;
  const targetCY = target.top + target.height / 2;
  let side: 'left' | 'right';
  let cardLeft: number;

  if (layoutMode === 'map') {
    // Define two vertical lines: one over Canary Islands area and one off the East coast sea
    // Moved a bit more to the center (18% and 82%) as requested
    const leftLineX = viewportW * 0.18;
    const rightLineX = viewportW * 0.82;

    // Closest side logic: choose the line closest to the pin
    const lineX = Math.abs(targetCX - leftLineX) < Math.abs(targetCX - rightLineX) ? leftLineX : rightLineX;
    cardLeft = lineX - CARD_WIDTH / 2;

    // Determine side based on target position relative to the line
    // If target (pin) is to the right of the line, the card is to its LEFT.
    side = targetCX > lineX ? 'left' : 'right';
  } else {
    side = preferred === 'auto' ? (targetCX < viewportW / 2 ? 'right' : 'left') : preferred;
    cardLeft = side === 'right'
      ? Math.min(viewportW - CARD_WIDTH - VIEWPORT_MARGIN, targetCX + CARD_MARGIN)
      : Math.max(VIEWPORT_MARGIN, targetCX - CARD_MARGIN - CARD_WIDTH);
  }

  const cardTop = Math.min(
    Math.max(VIEWPORT_MARGIN, targetCY - cardH / 2),
    viewportH - cardH - VIEWPORT_MARGIN,
  );

  return {
    side,
    card: { left: cardLeft, top: cardTop, width: CARD_WIDTH, height: cardH },
    pin: { x: targetCX, y: targetCY },
  };
}

// Build two smooth cubic bezier paths from pin to the top and bottom inner card corners
function buildCurvePaths(layout: Layout): { top: string; bottom: string } {
  const { pin, card, side } = layout;
  // The card edge facing the pin
  const cardEdgeX = side === 'right' ? card.left : card.left + card.width;
  const cardTopY = card.top + 16; // slight inset so curve lands on card face
  const cardBotY = card.top + card.height - 16;

  // Control points: first handle pulls horizontally from pin, second pulls vertically into card edge
  const dist = Math.abs(cardEdgeX - pin.x);
  const cpOffset = Math.max(dist * 0.55, 48);
  const cpX1 = side === 'right' ? pin.x + cpOffset : pin.x - cpOffset;

  // Top curve: pin → top corner
  const top = `M ${pin.x} ${pin.y} C ${cpX1} ${pin.y}, ${cardEdgeX} ${cardTopY - cpOffset * 0.3}, ${cardEdgeX} ${cardTopY}`;
  // Bottom curve: pin → bottom corner
  const bottom = `M ${pin.x} ${pin.y} C ${cpX1} ${pin.y}, ${cardEdgeX} ${cardBotY + cpOffset * 0.3}, ${cardEdgeX} ${cardBotY}`;

  return { top, bottom };
}

export interface SideCardTailProps {
  targetRef: RefObject<Element | null>;
  visible: boolean;
  side?: 'auto' | 'left' | 'right';
  layoutMode?: 'default' | 'map';
  children: ReactNode;
}

export default function SideCardTail({ targetRef, visible, side = 'auto', layoutMode = 'default', children }: SideCardTailProps) {
  const { isMobile } = useViewport();
  const cardRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<Layout | null>(null);
  // Track whether the card has mounted and been measured at least once
  const [mounted, setMounted] = useState(false);

  const recompute = (fromVisible: boolean) => {
    if (isMobile || !fromVisible || !targetRef.current) {
      setLayout(null);
      setMounted(false);
      return;
    }
    const target = targetRef.current.getBoundingClientRect();
    const cardH = cardRef.current?.offsetHeight ?? 220;
    setLayout(computeLayout(target, cardH, window.innerWidth, window.innerHeight, side, layoutMode));
  };

  useLayoutEffect(() => {
    recompute(visible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile, visible, side, targetRef]);

  // After card renders, re-measure height (initial render cardH may be 0)
  // Also resets mounted → triggers entrance animation on every new selection
  useEffect(() => {
    if (!visible || isMobile) {
      setMounted(false);
      return;
    }
    setMounted(false);
    const timer = setTimeout(() => {
      recompute(visible);
      setMounted(true);
    }, 10);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, isMobile, targetRef]);

  useEffect(() => {
    if (isMobile || !visible || !targetRef.current) return;
    const handler = () => recompute(visible);
    window.addEventListener('resize', handler);
    window.addEventListener('scroll', handler, true);
    const ro = new ResizeObserver(handler);
    ro.observe(targetRef.current);
    return () => {
      window.removeEventListener('resize', handler);
      window.removeEventListener('scroll', handler, true);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile, visible, side, targetRef]);

  if (isMobile || !visible || !layout) return null;

  const curves = buildCurvePaths(layout);

  // Entrance transform: card slides in from the pin position
  const originX = layout.pin.x - layout.card.left;
  const originY = layout.pin.y - layout.card.top;
  const transformOrigin = `${originX}px ${originY}px`;

  return (
    <div className="pointer-events-none fixed inset-0 z-40">
      {/* SVG connector: two curved bezier lines from pin to card corners */}
      <svg
        className="absolute inset-0 h-full w-full"
        style={{ 
          overflow: 'visible', 
          pointerEvents: 'none',
          opacity: mounted ? 1 : 0,
          transition: 'opacity 220ms ease-out'
        }}
      >
        <defs>
          <filter id="curve-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Filled area between the two curves — gives a "fan" feel */}
        {layout && (() => {
          const { pin, card, side } = layout;
          const cardEdgeX = side === 'right' ? card.left : card.left + card.width;
          const cardTopY = card.top + 16;
          const cardBotY = card.top + card.height - 16;
          const dist = Math.abs(cardEdgeX - pin.x);
          const cpOffset = Math.max(dist * 0.55, 48);
          const cpX1 = side === 'right' ? pin.x + cpOffset : pin.x - cpOffset;
          const fillPath = [
            `M ${pin.x} ${pin.y}`,
            `C ${cpX1} ${pin.y}, ${cardEdgeX} ${cardTopY - cpOffset * 0.3}, ${cardEdgeX} ${cardTopY}`,
            `L ${cardEdgeX} ${cardBotY}`,
            `C ${cardEdgeX} ${cardBotY + cpOffset * 0.3}, ${cpX1} ${pin.y}, ${pin.x} ${pin.y}`,
            `Z`,
          ].join(' ');
          return (
            <path
              d={fillPath}
              fill="rgba(251,246,239,0.55)"
              style={{ transition: 'all 280ms cubic-bezier(0.4,0,0.2,1)' }}
            />
          );
        })()}

        {/* Top boundary curve */}
        <path
          d={curves.top}
          fill="none"
          stroke="rgba(255,255,255,0.6)"
          strokeWidth={1.5}
          filter="url(#curve-glow)"
          style={{ transition: 'd 280ms cubic-bezier(0.4,0,0.2,1)' }}
        />

        {/* Bottom boundary curve */}
        <path
          d={curves.bottom}
          fill="none"
          stroke="rgba(255,255,255,0.6)"
          strokeWidth={1.5}
          filter="url(#curve-glow)"
          style={{ transition: 'd 280ms cubic-bezier(0.4,0,0.2,1)' }}
        />

        {/* Pin pulse ring */}
        <circle
          cx={layout.pin.x}
          cy={layout.pin.y}
          r={10}
          fill="rgba(244,162,76,0.15)"
          stroke="rgba(244,162,76,0.6)"
          strokeWidth={1.5}
        />
      </svg>

      {/* Card — animates in from pin origin */}
      <div
        ref={cardRef}
        data-sidecard-root
        className="pointer-events-auto absolute"
        style={{
          left: layout.card.left,
          top: layout.card.top,
          width: layout.card.width,
          transformOrigin,
          transform: mounted ? 'scale(1) translateY(0px)' : 'scale(0.6) translateY(12px)',
          opacity: mounted ? 1 : 0,
          transition: 'transform 280ms cubic-bezier(0.34,1.56,0.64,1), opacity 220ms ease-out',
          willChange: 'transform, opacity',
        }}
      >
        {children}
      </div>
    </div>
  );
}
