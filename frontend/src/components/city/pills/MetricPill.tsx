import React, { useState, type ComponentType, type ReactNode } from 'react';
import { HelpCircle, X } from 'lucide-react';

export interface MetricPillProps {
  value: string;
  label: string;
  sublabel?: string;
  icon?: ComponentType<{ className?: string }>;
  helpContent?: ReactNode;
}

const MetricPill: React.FC<MetricPillProps> = ({
  value,
  label,
  sublabel,
  icon: Icon,
  helpContent,
}) => {
  const [flipped, setFlipped] = useState(false);

  return (
    <div
      className="relative w-full h-[104px]"
      style={{ perspective: '800px' }}
    >
      {/* Card container — flips on Y axis */}
      <div
        className="relative w-full h-full transition-transform duration-500"
        style={{
          transformStyle: 'preserve-3d',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
      >
        {/* ── Front face ── */}
        <div
          className="absolute inset-0 rounded-xl border border-white/20 bg-white/10 backdrop-blur-sm overflow-hidden transition-all hover:bg-white/15 hover:border-white/30 p-3 group flex flex-col justify-between"
          style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
        >
          {/* Top row: Icon + Title + Help Button */}
          <div className="flex items-start justify-between mb-2 gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-white/15">
                {Icon && <Icon className="w-4 h-4 text-white" />}
              </div>
              <div className="flex flex-col min-w-0 justify-center">
                {sublabel && (
                  <h3 className="text-xs font-semibold text-white/90 leading-tight truncate">
                    {sublabel}
                  </h3>
                )}
                <p className="text-[9px] font-medium text-white/50 uppercase tracking-wider truncate mt-0.5">
                  {label}
                </p>
              </div>
            </div>
            {helpContent && (
              <button
                onClick={() => setFlipped(true)}
                className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors"
                aria-label="Show help"
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Bottom row: Value */}
          <div className="mt-1">
            <p className="text-xl font-bold text-white leading-none">{value}</p>
          </div>
        </div>

        {/* ── Back face (help content) ── */}
        <div
          className="absolute inset-0 rounded-xl border border-white/20 bg-white/10 backdrop-blur-sm overflow-hidden p-3 flex flex-col"
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
          }}
        >
          <div className="flex justify-between items-center mb-2 gap-2">
             <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider truncate">Info</span>
             <button
               onClick={() => setFlipped(false)}
               className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors"
               aria-label="Close help"
             >
               <X className="w-3.5 h-3.5" />
             </button>
          </div>
          <div className="flex-1 overflow-y-auto text-white/80 text-xs leading-relaxed pr-1" style={{ scrollbarWidth: 'none' }}>
            {helpContent}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MetricPill;
