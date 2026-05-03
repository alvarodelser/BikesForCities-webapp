import React, { useState, type ComponentType, type ReactNode } from 'react';
import { HelpCircle, X } from 'lucide-react';

export interface MetricPillProps {
  value: string;
  label: string;
  sublabel?: string;
  icon?: ComponentType<{ className?: string }>;
  helpContent?: ReactNode;
  accent?: string;
}

const MetricPill: React.FC<MetricPillProps> = ({
  value,
  label,
  sublabel,
  icon: Icon,
  helpContent,
  accent = '#3b82f6',
}) => {
  const [flipped, setFlipped] = useState(false);

  return (
    <div
      className="relative w-full h-[110px] group"
      style={{ perspective: '1200px' }}
    >
      {/* Card container — flips on Y axis */}
      <div
        className="relative w-full h-full transition-all duration-700 ease-out shadow-sm hover:shadow-md rounded-2xl"
        style={{
          transformStyle: 'preserve-3d',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
      >
        {/* ── Front face ── */}
        <div
          className="absolute inset-0 rounded-2xl border border-black/5 bg-white/90 backdrop-blur-md overflow-hidden p-4 flex flex-col justify-between"
          style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
        >
          {/* Top row: Icon + Title + Help Button */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div 
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${accent}15` }}
              >
                {Icon && <Icon className="w-5 h-5" style={{ color: accent }} />}
              </div>
              <div className="flex flex-col min-w-0">
                 <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest truncate">
                  {label}
                </p>
                {sublabel && (
                  <h3 className="text-xs font-semibold text-gray-600 leading-tight truncate">
                    {sublabel}
                  </h3>
                )}
              </div>
            </div>
            {helpContent && (
              <button
                onClick={(e) => { e.stopPropagation(); setFlipped(true); }}
                className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 bg-gray-100/80 hover:bg-gray-200/80 text-gray-400 hover:text-gray-600 transition-all"
                aria-label="Show help"
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Bottom row: Value */}
          <div className="mt-auto">
            <p className="text-2xl font-black text-gray-900 tracking-tight">{value}</p>
          </div>
        </div>

        {/* ── Back face (help content) ── */}
        <div
          className="absolute inset-0 rounded-2xl border border-black/5 bg-white/95 backdrop-blur-xl overflow-hidden p-4 flex flex-col"
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
          }}
        >
          <div className="flex justify-between items-center mb-3">
             <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Información</span>
             <button
               onClick={(e) => { e.stopPropagation(); setFlipped(false); }}
               className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 bg-gray-100/80 hover:bg-gray-200/80 text-gray-400 hover:text-gray-600 transition-all"
               aria-label="Close help"
             >
               <X className="w-3.5 h-3.5" />
             </button>
          </div>
          <div className="flex-1 overflow-y-auto text-gray-600 text-[11px] leading-relaxed font-medium" style={{ scrollbarWidth: 'none' }}>
            {helpContent}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MetricPill;


export default MetricPill;
