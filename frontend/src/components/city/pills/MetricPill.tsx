import React, { useState, useRef, useEffect, type ComponentType, type ReactNode } from 'react';
import { HelpCircle, X } from 'lucide-react';

function fmtNumber(raw: string): string {
  const n = parseFloat(raw);
  if (isNaN(n)) return raw;
  const [intStr, decStr] = n.toString().split('.');
  const intFormatted = intStr.replace(/\B(?=(\d{3})+(?!\d))/g, ' '); // narrow no-break space
  return decStr ? `${intFormatted}.${decStr}` : intFormatted;
}

export interface MetricPillProps {
  value: string;
  unit?: string;
  label: string;
  sublabel?: string;
  icon?: ComponentType<{ className?: string; style?: React.CSSProperties }>;
  // Structured help — three sections
  helpQueVes?: string;
  helpComoSeRecogieron?: string;
  helpPorQueEsUtil?: string;
  // Legacy fallback — rendered under "Qué estás viendo" if structured props absent
  helpContent?: ReactNode;
  accent?: string;
  loading?: boolean;
  variant?: 'light' | 'darkTint';
}

const MetricPill: React.FC<MetricPillProps> = ({
  value,
  unit,
  label,
  sublabel,
  helpQueVes,
  helpComoSeRecogieron,
  helpPorQueEsUtil,
  helpContent,
  accent = '#ffffff',
  loading = false,
  variant = 'light',
}) => {
  const [flipped, setFlipped] = useState(false);
  const [showScrollHint, setShowScrollHint] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const hasHelp = !!(helpQueVes || helpComoSeRecogieron || helpPorQueEsUtil || helpContent);
  const resolvedQueVes = helpQueVes ?? (typeof helpContent === 'string' ? helpContent : undefined);

  const clearTimer = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  };

  useEffect(() => () => clearTimer(), []);

  useEffect(() => {
    if (!flipped) return;
    const el = scrollRef.current;
    if (!el) return;
    const check = () => setShowScrollHint(el.scrollHeight - el.scrollTop > el.clientHeight + 4);
    const t = setTimeout(check, 420);
    el.addEventListener('scroll', check);
    return () => { clearTimeout(t); el.removeEventListener('scroll', check); };
  }, [flipped]);

  const handleMouseLeave = () => {
    if (flipped) timerRef.current = setTimeout(() => setFlipped(false), 5000);
  };
  const handleMouseEnter = () => clearTimer();

  const isDark = variant === 'darkTint';

  const textPrimary = isDark ? 'text-[var(--blue-dark)]' : 'text-white';
  const textMuted = isDark ? 'text-[var(--blue-dark)]/45' : 'text-white/45';
  const textBody = isDark ? 'text-[var(--blue-dark)]/75' : 'text-white/75';

  const sectionHead = (text: string) => (
    <p className={`text-[8px] font-black uppercase tracking-widest mb-0.5 ${isDark ? 'text-[var(--blue-dark)]/35' : 'text-white/35'}`}>
      {text}
    </p>
  );

  return (
    <div
      className="relative w-full h-[120px]"
      style={{ perspective: '1200px' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        className="relative w-full h-full transition-all duration-700 ease-out rounded-xl"
        style={{ transformStyle: 'preserve-3d', transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
      >

        {/* ── Front face ── */}
        <div
          className={`absolute inset-0 rounded-xl border backdrop-blur-sm px-4 py-3 flex flex-col justify-between transition-all ${
            loading ? 'animate-pulse' : ''
          } ${isDark
            ? 'hover:brightness-95'
            : 'border-white/35 bg-white/30 hover:bg-white/35 hover:border-white/45'
          }`}
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            ...(isDark ? {
              backgroundColor: `color-mix(in srgb, ${accent} 15%, transparent)`,
              borderColor: `color-mix(in srgb, ${accent} 30%, transparent)`,
            } : {}),
          }}
        >
          {/* Row 1: label + help button */}
          <div className="flex items-center justify-between gap-2">
            <p
              className={`text-[10px] font-bold uppercase tracking-widest leading-none truncate ${isDark ? '' : 'text-white/55'}`}
              style={isDark ? { color: `color-mix(in srgb, ${accent} 75%, black)` } : {}}
            >
              {label}
            </p>
            {hasHelp && (
              <button
                onClick={(e) => { e.stopPropagation(); setFlipped(true); }}
                className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-all ${
                  isDark
                    ? 'hover:bg-black/5 text-[var(--blue-dark)]/30 hover:text-[var(--blue-dark)]/60'
                    : 'bg-white/10 hover:bg-white/20 text-white/40 hover:text-white/75'
                }`}
                aria-label="Mostrar información"
              >
                <HelpCircle className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Row 2: value left (big) · sublabel/unit right */}
          <div className="flex items-end justify-between gap-3">
            <div className="flex-shrink-0">
              <p className={`text-[32px] font-black leading-none tracking-tight ${textPrimary}`}>
                {unit ? fmtNumber(value) : value}
              </p>
              {unit && (
                <p className={`text-[10px] font-semibold leading-tight mt-0.5 ${textMuted}`}>
                  {unit}
                </p>
              )}
            </div>
            {sublabel && (
              <p className={`text-[10px] font-medium leading-tight text-right min-w-0 ${textMuted}`}>
                {sublabel}
              </p>
            )}
          </div>
        </div>

        {/* ── Back face ── */}
        <div
          className={`absolute inset-0 rounded-xl border backdrop-blur-md flex flex-col ${
            isDark ? '' : 'border-white/55 bg-white/50'
          }`}
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            ...(isDark ? {
              backgroundColor: `color-mix(in srgb, ${accent} 12%, var(--cream, white))`,
              borderColor: `color-mix(in srgb, ${accent} 25%, transparent)`,
            } : {}),
          }}
        >
          {/* Back header */}
          <div className="flex justify-between items-center px-3 pt-2.5 pb-1.5 flex-shrink-0 border-b border-black/5">
            <span className={`text-[9px] font-black uppercase tracking-widest ${textMuted}`}>
              {label}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); clearTimer(); setFlipped(false); }}
              className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-all ${
                isDark
                  ? 'hover:bg-black/5 text-[var(--blue-dark)]/30 hover:text-[var(--blue-dark)]/60'
                  : 'bg-white/10 hover:bg-white/20 text-white/40 hover:text-white/75'
              }`}
              aria-label="Cerrar información"
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          {/* Scrollable content */}
          <div className="relative flex-1 min-h-0">
            <div
              ref={scrollRef}
              className="h-full overflow-y-auto px-3 py-2 flex flex-col gap-2"
              style={{ scrollbarWidth: 'none' }}
            >
              {resolvedQueVes && (
                <div>
                  {sectionHead('Qué estás viendo')}
                  <p className={`text-[10.5px] leading-relaxed ${textBody}`}>{resolvedQueVes}</p>
                </div>
              )}
              {helpComoSeRecogieron && (
                <div>
                  {sectionHead('Cómo se recogieron')}
                  <p className={`text-[10.5px] leading-relaxed ${textBody}`}>{helpComoSeRecogieron}</p>
                </div>
              )}
              {helpPorQueEsUtil && (
                <div>
                  {sectionHead('Por qué es útil')}
                  <p className={`text-[10.5px] leading-relaxed ${textBody}`}>{helpPorQueEsUtil}</p>
                </div>
              )}
              {/* Legacy ReactNode fallback */}
              {!resolvedQueVes && helpContent && (
                <div className={`text-[10.5px] leading-relaxed ${textBody}`}>{helpContent}</div>
              )}
            </div>

            {/* Scroll hint */}
            {showScrollHint && (
              <div
                className="absolute bottom-0 left-0 right-0 h-7 flex items-end justify-center pb-1 pointer-events-none"
                style={{
                  background: isDark
                    ? `linear-gradient(to bottom, transparent, color-mix(in srgb, ${accent} 20%, var(--cream, white)))`
                    : 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.55))',
                }}
              >
                <span className={`text-[9px] font-black tracking-widest ${textMuted}`}>↓ más</span>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default MetricPill;
