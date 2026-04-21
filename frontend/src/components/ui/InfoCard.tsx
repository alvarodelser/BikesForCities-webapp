import React from 'react';
import { GlassCard } from './GlassCard';
import { Database, FileText, Landmark, BookOpen, type LucideIcon } from 'lucide-react';

export interface InfoItem {
  id: string;
  title: string;
  subtitle?: string;
  description: string;
  icon1?: LucideIcon; // Keep for flexibility, but variant will override
  icon2?: LucideIcon;
  tag?: string | number;
  link?: {
    label: string;
    url: string;
  };
  variant?: 'yellow' | 'blue' | 'green' | 'red';
}

interface InfoCardProps {
  item: InfoItem;
}

// ─── Variant config maps ─────────────────────────────────────────────────────

const VARIANT_CONFIG = {
  yellow: {
    icon: Database,
    tint: 'rgba(244, 162, 76, 0.12)',
    iconBase: 'bg-[var(--yellow)]/20 border-[var(--yellow)]/30',
    iconText: 'text-[var(--yellow)]',
    tagBg: 'text-[var(--orange)] bg-[var(--yellow)]/20',
    subtitleColor: 'text-[var(--orange)]',
    linkColor: 'text-[var(--orange)]',
    linkHoverColor: 'hover:text-[var(--yellow)]',
  },
  blue: {
    icon: FileText,
    tint: 'rgba(58, 108, 127, 0.15)',
    iconBase: 'bg-[var(--blue)]/20 border-[var(--blue)]/30',
    iconText: 'text-[var(--blue-dark)]',
    tagBg: 'text-[var(--blue-dark)]/80 bg-[var(--blue-light)]/30',
    subtitleColor: 'text-[var(--blue-dark)]',
    linkColor: 'text-[var(--blue)]',
    linkHoverColor: 'hover:text-[var(--blue-dark)]',
  },
  green: {
    icon: Landmark,
    tint: 'rgba(46, 125, 50, 0.12)',
    iconBase: 'bg-[var(--green)]/20 border-[var(--green)]/30',
    iconText: 'text-[var(--green-dark)]',
    tagBg: 'text-[var(--green-dark)]/80 bg-[var(--green-light)]/30',
    subtitleColor: 'text-[var(--green-dark)]',
    linkColor: 'text-[var(--green-dark)]',
    linkHoverColor: 'hover:text-[var(--green)]',
  },
  red: {
    icon: BookOpen,
    tint: 'rgba(183, 28, 28, 0.10)',
    iconBase: 'bg-red-500/15 border-red-500/25',
    iconText: 'text-red-700',
    tagBg: 'text-red-700/80 bg-red-100/40',
    subtitleColor: 'text-red-700',
    linkColor: 'text-red-700',
    linkHoverColor: 'hover:text-red-500',
  },
} as const;

const InfoCard: React.FC<InfoCardProps> = ({ item }) => {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const v = item.variant ?? 'yellow';
  const cfg = VARIANT_CONFIG[v];
  const MainIcon = cfg.icon;

  return (
    <div className="flex-shrink-0 w-[280px]">
      <GlassCard
        surface="glass"
        size="md"
        tint={cfg.tint}
        blurStrength="md"
        shadow="sm"
        className={`w-full transition-all duration-300 flex flex-col relative group cursor-pointer ${isExpanded ? 'min-h-[220px] h-auto z-40' : 'h-[220px]'}`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Header Row: Big Icon + Title/Subtitle + Tag in flow */}
        <div className="flex justify-between items-start gap-3 mb-4">
          <div className="flex gap-4 items-start min-w-0">
            {/* Big Icon */}
            <div className={`flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-2xl border ${cfg.iconBase} shadow-md`}>
              <MainIcon className={`w-7 h-7 ${cfg.iconText}`} />
            </div>

            {/* Title and Subtitle */}
            <div className="flex flex-col min-w-0 pt-0.5">
              <h3 className={`font-bold text-[var(--black)] text-sm leading-snug ${isExpanded ? '' : 'line-clamp-3'}`} title={item.title}>
                {item.title}
              </h3>
              {item.subtitle && (
                <p className={`${cfg.subtitleColor} text-[10px] font-bold italic mt-1 leading-tight ${isExpanded ? '' : 'truncate'}`} title={item.subtitle}>
                  {item.subtitle}
                </p>
              )}
            </div>
          </div>

          {/* Tag - Now in flow for better collision handling */}
          {item.tag && (
            <span className={`flex-shrink-0 text-[8px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full shadow-sm border border-white/20 transition-transform duration-300 group-hover:scale-105 ${cfg.tagBg}`}>
              {item.tag}
            </span>
          )}
        </div>


        {/* Description */}
        <p className={`text-[var(--black)]/70 text-[11px] leading-relaxed relative z-10 flex-1 ${isExpanded ? '' : 'line-clamp-4'}`}>
          {item.description}
        </p>

        {item.link && (
          <div className="mt-2 pt-2 border-t border-black/5">
            <a
              href={item.link.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className={`text-[10px] ${cfg.linkColor} ${cfg.linkHoverColor} transition-colors font-bold relative z-10 truncate block`}
            >
              {item.link.label}
            </a>
          </div>
        )}
      </GlassCard>
    </div>
  );
};


export default InfoCard;

