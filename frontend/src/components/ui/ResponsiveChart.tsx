import { type ReactNode, useEffect, useRef, useState } from 'react';

export type ChartBand = 'narrow' | 'medium' | 'wide';

function bandFor(width: number): ChartBand {
  if (width < 480) return 'narrow';
  if (width < 960) return 'medium';
  return 'wide';
}

interface RenderArgs { band: ChartBand; width: number; height: number; }

interface ResponsiveChartProps {
  minHeight: number;
  maxHeight: number;
  maxWidth?: number;
  children: (args: RenderArgs) => ReactNode;
}

export default function ResponsiveChart({ minHeight, maxHeight, maxWidth, children }: ResponsiveChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: minHeight });

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      const h = Math.min(maxHeight, Math.max(minHeight, Math.round(w * 0.5)));
      setSize({ width: w, height: h });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [minHeight, maxHeight]);

  return (
    <div
      ref={ref}
      style={{ containerType: 'inline-size', maxWidth, width: '100%', minHeight, height: size.height }}
    >
      {size.width > 0 && children({ band: bandFor(size.width), width: size.width, height: size.height })}
    </div>
  );
}
