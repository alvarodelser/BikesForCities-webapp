import React from 'react';
import { GlassCard } from './GlassCard';
import { Database, FileText, type LucideIcon } from 'lucide-react';

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
  variant?: 'yellow' | 'blue';
}

interface InfoCardProps {
  item: InfoItem;
}

const InfoCard: React.FC<InfoCardProps> = ({ item }) => {
  const isBlue = item.variant === 'blue';
  
  // Use standardized icons based on variant
  const MainIcon = isBlue ? FileText : Database;

  const tint = isBlue 
    ? "rgba(58, 108, 127, 0.15)" 
    : "rgba(244, 162, 76, 0.12)"; // Yellow tint using --yellow
  
  const iconBaseClass = isBlue 
    ? "bg-[var(--blue)]/20 border-[var(--blue)]/30" 
    : "bg-[var(--yellow)]/20 border-[var(--yellow)]/30";
    
  const iconTextClass = isBlue 
    ? "text-[var(--blue-dark)]" 
    : "text-[var(--yellow)]"; // High contrast yellow-ish or orange-dark
    
  const tagBgClass = isBlue 
    ? "text-[var(--blue-dark)]/80 bg-[var(--blue-light)]/30" 
    : "text-[var(--orange)] bg-[var(--yellow)]/20"; // Brighter tag for yellow mode

  return (
    <div className="flex-shrink-0 w-[280px]">
      <GlassCard
        surface="glass"
        size="md"
        tint={tint}
        blurStrength="md"
        shadow="sm"
        className="w-full h-[220px] flex flex-col relative group"
      >
        {/* Tag - Pushed higher and more right */}
        {item.tag && (
          <span className={`absolute -top-1 -right-1 text-[9px] uppercase tracking-widest font-bold px-2.5 py-1 rounded-full z-20 shadow-sm border border-white/20 transition-transform duration-300 group-hover:scale-110 ${tagBgClass}`}>
            {item.tag}
          </span>
        )}

        {/* Header Row: Big Icon + Title/Subtitle */}
        <div className="flex gap-4 mb-4 items-start pr-10">
          {/* Big Icon */}
          <div className={`flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-2xl border ${iconBaseClass} shadow-md`}>
            <MainIcon className={`w-7 h-7 ${iconTextClass}`} />
          </div>

          {/* Title and Subtitle */}
          <div className="flex flex-col min-w-0 pt-0.5">
            <h3 className="font-bold text-[var(--black)] text-sm leading-snug line-clamp-2">
              {item.title}
            </h3>
            {item.subtitle && (
              <p className={`${isBlue ? 'text-[var(--blue-dark)]' : 'text-[var(--orange)]'} text-[10px] font-bold italic mt-1 leading-tight truncate`}>
                {item.subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Description */}
        <p className="text-[var(--black)]/70 text-[11px] leading-relaxed relative z-10 flex-1 line-clamp-4">
          {item.description}
        </p>

        {item.link && (
          <div className="mt-2 pt-2 border-t border-black/5">
            <a
              href={item.link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-[var(--blue)] hover:text-[var(--blue-dark)] transition-colors font-bold relative z-10 truncate block"
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
