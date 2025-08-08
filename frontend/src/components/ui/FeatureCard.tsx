import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface FeatureCardProps {
  icon: LucideIcon;
  text: string;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ icon: IconComponent, text }) => {
  return (
    <div 
      className="flex items-center gap-4 bg-transparent p-4 rounded-2xl border border-white/25 shadow-lg hover:shadow-xl hover:border-white/35 hover:scale-[1.02] transition-all duration-300 relative overflow-hidden group cursor-pointer"
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.52)',
        boxShadow: 'inset 1px 1px 4px rgba(0,0,0,0.05), inset -1px -1px 4px rgba(255,255,255,0.15), 0 4px 20px rgba(0,0,0,0.1)'
      }}
    >
      {/* Primary glass reflection effect */}
      <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent rounded-t-2xl pointer-events-none" />
      
      <div className="w-10 h-10 bg-gradient-to-r from-[var(--green)] to-[var(--green-dark)] rounded-full flex items-center justify-center flex-shrink-0 border-2 border-white/35 shadow-lg relative z-10 group-hover:scale-110 transition-transform duration-300">
        <IconComponent className="w-5 h-5 text-white drop-shadow-lg" />
      </div>
      <span className="text-base font-medium text-gray-800 drop-shadow-md relative z-10 group-hover:text-gray-700 transition-colors duration-300">{text}</span>
      
      {/* Bottom glass highlight */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent" />
    </div>
  );
};

export default FeatureCard;