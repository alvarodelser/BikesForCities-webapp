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
interface Layout { side: 'left' | 'right'; card: Rect; ray: [number, number][]; }

const CARD_WIDTH = 320;
const CARD_MARGIN = 24;
const RAY_HALF_HEIGHT = 20;
const VIEWPORT_MARGIN = 16;

function computeLayout(
  target: DOMRect,
  cardH: number,
  viewportW: number,
  viewportH: number,
  preferred: 'auto' | 'left' | 'right',
): Layout {
  const targetCX = target.left + target.width / 2;
  const targetCY = target.top + target.height / 2;
  const side = preferred === 'auto' ? (targetCX < viewportW / 2 ? 'left' : 'right') : preferred;

  const cardLeft = side === 'left'
    ? Math.max(CARD_MARGIN, targetCX - CARD_MARGIN - CARD_WIDTH)
    : Math.min(viewportW - CARD_WIDTH - CARD_MARGIN, targetCX + CARD_MARGIN);
  const cardTop = Math.min(
    Math.max(VIEWPORT_MARGIN, targetCY - cardH / 2),
    viewportH - cardH - VIEWPORT_MARGIN,
  );

  const innerEdgeX = side === 'left' ? cardLeft + CARD_WIDTH : cardLeft;
  const ray: [number, number][] = [
    [targetCX, targetCY],
    [innerEdgeX, targetCY - RAY_HALF_HEIGHT],
    [innerEdgeX, targetCY + RAY_HALF_HEIGHT],
  ];

  return {
    side,
    card: { left: cardLeft, top: cardTop, width: CARD_WIDTH, height: cardH },
    ray,
  };
}

export interface SideCardTailProps {
  targetRef: RefObject<Element | null>;
  visible: boolean;
  side?: 'auto' | 'left' | 'right';
  children: ReactNode;
}

export default function SideCardTail({ targetRef, visible, side = 'auto', children }: SideCardTailProps) {
  const { isMobile } = useViewport();
  const cardRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<Layout | null>(null);

  useLayoutEffect(() => {
    if (isMobile || !visible || !targetRef.current) {
      setLayout(null);
      return;
    }
    const target = targetRef.current.getBoundingClientRect();
    const cardH = cardRef.current?.offsetHeight ?? 180;
    setLayout(computeLayout(target, cardH, window.innerWidth, window.innerHeight, side));
  }, [isMobile, visible, side, targetRef]);

  useEffect(() => {
    if (isMobile || !visible || !targetRef.current) return;
    const recompute = () => {
      const t = targetRef.current?.getBoundingClientRect();
      if (!t) return;
      const cardH = cardRef.current?.offsetHeight ?? 180;
      setLayout(computeLayout(t, cardH, window.innerWidth, window.innerHeight, side));
    };
    window.addEventListener('resize', recompute);
    window.addEventListener('scroll', recompute, true);
    const ro = new ResizeObserver(recompute);
    ro.observe(targetRef.current);
    return () => {
      window.removeEventListener('resize', recompute);
      window.removeEventListener('scroll', recompute, true);
      ro.disconnect();
    };
  }, [isMobile, visible, side, targetRef]);

  if (isMobile || !visible || !layout) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-40">
      <svg className="absolute inset-0 h-full w-full">
        <polygon
          points={layout.ray.map(([x, y]) => `${x},${y}`).join(' ')}
          fill="rgba(251,246,239,0.95)"
          style={{ transition: 'all 220ms ease' }}
        />
      </svg>
      <div
        ref={cardRef}
        className="pointer-events-auto absolute transition-all duration-[220ms] ease-out"
        style={{
          left: layout.card.left,
          top: layout.card.top,
          width: layout.card.width,
        }}
      >
        {children}
      </div>
    </div>
  );
}
