import React, { useState, useRef, useEffect, type ComponentType, type ReactNode } from 'react';
import { HelpCircle, X } from 'lucide-react';

export interface MetricPillProps {
  value: string;
  label: string;
  sublabel?: string;
  icon?: ComponentType<{ className?: string; style?: React.CSSProperties }>;
  helpContent?: ReactNode;
  accent?: string;
  loading?: boolean;
}

const MetricPill: React.FC<MetricPillProps> = ({
  value,
  label,
  sublabel,
  icon: Icon,
  helpContent,
  accent = '#ffffff',
  loading = false,
}) => {
  const [flipped, setFlipped] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  };

  useEffect(() => () => clearTimer(), []);

  const handleMouseLeave = () => {
    if (flipped) {
      timerRef.current = setTimeout(() => setFlipped(false), 5000);
    }
  };

  const handleMouseEnter = () => clearTimer();

  return (
    <div
      className="relative w-full h-[110px] group"
      style={{ perspective: '1200px' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        className="relative w-full h-full transition-all duration-700 ease-out rounded-xl"
        style={{
          transformStyle: 'preserve-3d',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
      >
        {/* ── Front face ── */}
        <div
          className={`absolute inset-0 rounded-xl border border-white/35 bg-white/30 backdrop-blur-sm overflow-hidden p-3 flex flex-col justify-between transition-all ${loading ? 'animate-pulse' : 'hover:bg-white/35 hover:border-white/45'}`}
          style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {Icon && (
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-white/15">
                  <Icon className="w-4 h-4 text-white" />
                </div>
              )}
              <div className="flex flex-col min-w-0">
                <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest truncate">
                  {label}
                </p>
                {sublabel && (
                  <p className="text-[10px] font-semibold text-white/50 leading-tight truncate">
                    {sublabel}
                  </p>
                )}
              </div>
            </div>
            {helpContent && (
              <button
                onClick={(e) => { e.stopPropagation(); setFlipped(true); }}
                className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 bg-white/10 hover:bg-white/20 text-white/50 hover:text-white/80 transition-all"
                aria-label="Show help"
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="mt-auto">
            <p className="text-2xl font-black text-white leading-tight tracking-tight">{value}</p>
          </div>
        </div>

        {/* ── Back face ── */}
        <div
          className="absolute inset-0 rounded-xl border border-white/55 bg-white/50 backdrop-blur-md overflow-hidden p-3 flex flex-col"
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
          }}
        >
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">Información</span>
            <button
              onClick={(e) => { e.stopPropagation(); clearTimer(); setFlipped(false); }}
              className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 bg-white/10 hover:bg-white/20 text-white/50 hover:text-white/80 transition-all"
              aria-label="Close help"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto text-white/80 text-[11px] leading-relaxed font-medium" style={{ scrollbarWidth: 'none' }}>
            {helpContent}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MetricPill;
