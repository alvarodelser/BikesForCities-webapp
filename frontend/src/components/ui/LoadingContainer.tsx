import React, { useState, useEffect, useRef } from 'react';
import SpinnerSVG from './SpinnerSVG';

interface LoadingContainerProps {
  /** Optional tailwind classes for the container */
  className?: string;
  /** Optional inline styles */
  style?: React.CSSProperties;
  /** Color for the animation (defaults to std dark green #027A76) */
  color?: string;
  /** Optional text to display under the spinner */
  text?: string;
}

const LoadingContainer: React.FC<LoadingContainerProps> = ({
  className,
  style,
  color = '#FBF6EF',
  text = 'Cargando...'
}) => {
  const finalClassName = className !== undefined ? className : 'w-24';
  const [progress, setProgress] = useState(0);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number>(0);

  // p(t) = 95 * (1 - e^(-0.666t)) — 60% at 1.5s, asymptotes at 95%
  useEffect(() => {
    const animate = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const elapsed = (ts - startRef.current) / 1000;
      setProgress(95 * (1 - Math.exp(-0.666 * elapsed)));
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <div className={`flex flex-col items-center gap-0.5 ${finalClassName}`} style={style}>
      <div className="w-full relative" style={{ height: '80px' }}>
        <SpinnerSVG color={color} className="absolute inset-0 w-full h-full" />
      </div>
      {text && (
        <span className="text-xs font-medium tracking-wide opacity-80" style={{ color }}>
          {text}
        </span>
      )}
      <div
        className="w-full overflow-hidden"
        style={{
          height: '5px',
          borderRadius: '9999px',
          background: `color-mix(in srgb, ${color} 14%, transparent)`,
          border: `1px solid color-mix(in srgb, ${color} 28%, transparent)`,
          boxShadow: `0 0 6px color-mix(in srgb, ${color} 12%, transparent), inset 0 1px 2px rgba(255,255,255,0.06)`,
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${progress}%`,
            borderRadius: '9999px',
            background: `linear-gradient(90deg, color-mix(in srgb, ${color} 60%, transparent), ${color} 55%)`,
            boxShadow: `0 0 10px ${color}, 0 0 4px color-mix(in srgb, ${color} 55%, transparent)`,
            transition: 'width 80ms linear',
          }}
        />
      </div>
    </div>
  );
};

export default LoadingContainer;