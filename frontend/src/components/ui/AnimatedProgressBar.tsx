import { useEffect, useRef, useState } from 'react';

interface AnimatedProgressBarProps {
  color?: string;
  value?: number;
  className?: string;
}

export default function AnimatedProgressBar({ color = '#027A76', value, className }: AnimatedProgressBarProps) {
  const [animatedPct, setAnimatedPct] = useState(0);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (value !== undefined) return;
    startRef.current = null;
    const animate = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const elapsed = (ts - startRef.current) / 1000;
      setAnimatedPct(95 * (1 - Math.exp(-0.666 * elapsed)));
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value]);

  const pct = value !== undefined ? value : animatedPct;

  return (
    <div
      className={className}
      style={{
        height: '5px',
        borderRadius: '9999px',
        background: `color-mix(in srgb, ${color} 14%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 28%, transparent)`,
        boxShadow: `0 0 6px color-mix(in srgb, ${color} 12%, transparent), inset 0 1px 2px rgba(255,255,255,0.06)`,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${pct}%`,
          borderRadius: '9999px',
          background: `linear-gradient(90deg, color-mix(in srgb, ${color} 60%, transparent), ${color} 55%)`,
          boxShadow: `0 0 10px ${color}, 0 0 4px color-mix(in srgb, ${color} 55%, transparent)`,
          transition: 'width 80ms linear',
        }}
      />
    </div>
  );
}
