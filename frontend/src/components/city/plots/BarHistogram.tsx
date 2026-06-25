import React, { useState, useEffect, useRef, type ReactNode } from 'react';
import { HelpCircle, X } from 'lucide-react';
import { fmtInt } from '../../../utils/formatters';

interface BarDatum {
  label: string;
  shortLabel?: string;
  subLabel?: string;
  icon?: React.ElementType;
  value: number;
  description?: string;
}

interface BarHistogramProps {
  data: BarDatum[];
  accent: string;
  title: string;
  subtitle?: string;
  helpContent?: ReactNode;
  gradient?: boolean;
  referenceLineX?: number;
  referenceLabel?: string;
  yUnit?: string;
  variant?: 'light' | 'darkTint';
}

function niceTicks(max: number): number[] {
  if (max <= 0) return [0];
  const raw = max / 3;
  const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = Math.ceil(raw / magnitude) * magnitude;
  const ticks: number[] = [];
  for (let v = 0; v <= max + step * 0.01; v += step) ticks.push(Math.round(v * 100) / 100);
  return ticks;
}

export const BarHistogram: React.FC<BarHistogramProps> = ({
  data,
  accent,
  title,
  subtitle,
  helpContent,
  referenceLineX,
  referenceLabel,
  yUnit = '',
  variant = 'light',
}) => {
  const [mounted, setMounted] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 80);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const clearTimer = () => { if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; } };
  const handleMouseLeave = () => { if (showHelp) timerRef.current = setTimeout(() => setShowHelp(false), 5000); };
  const handleMouseEnter = () => clearTimer();

  const max = Math.max(...data.map(d => d.value), 0.001);
  const total = data.reduce((s, d) => s + d.value, 0);
  const yTicks = niceTicks(max);
  const yMax = yTicks[yTicks.length - 1] || max;
  const BAR_HEIGHT = 120;

  return (
    <div
      className={`rounded-2xl border p-5 w-full transition-all ${
        variant === 'darkTint'
          ? 'backdrop-blur-md hover:brightness-95'
          : 'bg-white/80 backdrop-blur-sm hover:bg-white/90'
      }`}
      style={{
        borderColor: variant === 'darkTint' ? `color-mix(in srgb, ${accent} 30%, transparent)` : 'rgba(0,0,0,0.08)',
        boxShadow: variant === 'darkTint' ? 'none' : '0 4px 16px rgba(0,0,0,0.04)',
        ...(variant === 'darkTint' ? { backgroundColor: `color-mix(in srgb, ${accent} 15%, transparent)` } : {})
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className={`text-sm font-bold leading-tight ${variant === 'darkTint' ? 'text-[var(--blue-dark)]' : 'text-gray-900'}`}>{title}</h3>
          {subtitle && <p className={`text-xs mt-0.5 ${variant === 'darkTint' ? 'text-[var(--blue-dark)]/70' : 'text-gray-500'}`}>{subtitle}</p>}
        </div>
        {helpContent && (
          <button
            onClick={() => { clearTimer(); setShowHelp(v => !v); }}
            className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 bg-black/5 hover:bg-black/10 text-gray-400 hover:text-gray-600 transition-all"
            aria-label={showHelp ? 'Cerrar ayuda' : 'Mostrar ayuda'}
          >
            {showHelp ? <X className="w-3.5 h-3.5" /> : <HelpCircle className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {/* Chart body */}
      <div className="flex gap-2">

        {/* Y-axis labels */}
        <div className="flex flex-col-reverse justify-between items-end shrink-0" style={{ height: BAR_HEIGHT }}>
          {yTicks.map((t) => (
            <span key={t} className={`text-[9px] leading-none tabular-nums ${variant === 'darkTint' ? 'text-[var(--blue-dark)]/40' : 'text-gray-400'}`}>
              {t}{yUnit ? ` ${yUnit}` : ''}
            </span>
          ))}
        </div>

        {/* Bars + grid + X labels */}
        <div className="flex-1 flex flex-col min-w-0">

          {/* Bars area */}
          <div className="relative flex items-end gap-1.5 overflow-visible" style={{ height: BAR_HEIGHT }}>
            {yTicks.map((t) => (
              <div
                key={t}
                className={`absolute left-0 right-0 border-t pointer-events-none ${variant === 'darkTint' ? 'border-[var(--blue-dark)]/[0.06]' : 'border-black/[0.06]'}`}
                style={{ bottom: (t / yMax) * BAR_HEIGHT }}
              />
            ))}

            {data.map((d, i) => {
              const barH = mounted ? Math.max((d.value / yMax) * BAR_HEIGHT, d.value > 0 ? 3 : 0) : 0;
              const isHovered = hovered === i;
              const isRef = referenceLineX === i;
              const barColor = isRef ? '#ef4444' : accent;

              return (
                <div
                  key={i}
                  className="flex-1 flex flex-col items-center relative h-full justify-end"
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                >
                  {/* Tooltip */}
                  {isHovered && (
                    <div
                      className="absolute z-20 bottom-full mb-2 left-1/2 -translate-x-1/2 pointer-events-none"
                      style={{ minWidth: 160 }}
                    >
                      <div className="rounded-xl border border-black/10 bg-white/95 backdrop-blur-md shadow-xl p-3">
                        <p className="text-[11px] font-bold text-gray-900 mb-0.5">{d.label}</p>
                        <p className="text-[11px] text-gray-600 tabular-nums">
                          {fmtInt(d.value)}{yUnit ? ` ${yUnit}` : ''}
                        </p>
                        {total > 0 && (
                          <p className="text-[11px] text-gray-400">
                            {((d.value / total) * 100).toFixed(1)}% del total
                          </p>
                        )}
                      </div>
                      <div className="flex justify-center">
                        <div className="w-2 h-2 rotate-45 bg-white/95 border-r border-b border-black/10 -mt-1" />
                      </div>
                    </div>
                  )}

                  {/* Bar */}
                  <div
                    className="w-full rounded-t-md cursor-pointer"
                    style={{
                      height: barH,
                      backgroundColor: isHovered ? barColor : isRef ? `${barColor}cc` : `${barColor}70`,
                      boxShadow: isHovered ? `0 0 18px ${barColor}55` : 'none',
                      transition: `height 0.6s cubic-bezier(0.34,1.56,0.64,1) ${i * 60}ms, background-color 0.15s, box-shadow 0.15s`,
                    }}
                  />
                </div>
              );
            })}
          </div>

          {/* X-axis labels */}
          <div className="flex gap-1.5 mt-2">
            {data.map((d, i) => {
              const isHovered = hovered === i;
              const isRef = referenceLineX === i;
              const BarIcon = d.icon;
              const labelColor = isHovered
                ? (variant === 'darkTint' ? 'text-[var(--blue-dark)]' : 'text-gray-800')
                : isRef
                  ? 'text-red-500'
                  : (variant === 'darkTint' ? 'text-[var(--blue-dark)]/60' : 'text-gray-500');
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                  {BarIcon && (
                    <BarIcon
                      size={14}
                      weight={isHovered ? 'bold' : 'regular'}
                      className={`transition-colors ${labelColor}`}
                    />
                  )}
                  <span
                    className={`text-[10px] text-center leading-tight transition-colors font-medium ${labelColor}`}
                    style={{ wordBreak: 'break-word' }}
                  >
                    {d.shortLabel ?? d.label}
                  </span>
                  {d.subLabel && (
                    <span
                      className={`text-[9px] text-center leading-tight transition-colors ${
                        isHovered
                          ? (variant === 'darkTint' ? 'text-[var(--blue-dark)]/60' : 'text-gray-500')
                          : (variant === 'darkTint' ? 'text-[var(--blue-dark)]/40' : 'text-gray-300')
                      }`}
                      style={{ wordBreak: 'break-word' }}
                    >
                      {d.subLabel}
                    </span>
                  )}
                  {isRef && referenceLabel && (
                    <span className="text-[9px] font-bold text-red-500 text-center leading-tight">
                      {referenceLabel}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

        </div>
      </div>

      {/* Expandable help section */}
      {helpContent && showHelp && (
        <>
          <div className={`border-t mt-4 ${variant === 'darkTint' ? 'border-[var(--blue-dark)]/10' : 'border-black/10'}`} />
          <div className={`mt-4 text-[11px] leading-relaxed ${variant === 'darkTint' ? 'text-[var(--blue-dark)]/70' : 'text-gray-500'}`}>
            {helpContent}
          </div>
        </>
      )}
    </div>
  );
};

export default BarHistogram;
