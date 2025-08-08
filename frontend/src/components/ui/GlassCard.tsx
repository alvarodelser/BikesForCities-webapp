import React from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  variant?: 'default' | 'button' | 'compact';
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  selected?: boolean;
  hover?: boolean;
  textColor?: 'dark' | 'light';
}

const GlassCard: React.FC<GlassCardProps> = ({
  children,
  variant = 'default',
  className = '',
  onClick,
  disabled = false,
  selected = false,
  hover = false,
  textColor = 'dark'
}) => {
  // Base classes for all variants
  const baseClasses = "relative overflow-hidden transition-all duration-300";
  
  // Variant-specific classes
  const variantClasses = {
    default: "bg-white/80 backdrop-blur-md border border-[var(--green)]/30 rounded-2xl p-6 shadow-lg",
    button: "border-2 rounded-2xl p-4 cursor-pointer",
    compact: "border border-white/20 rounded-2xl p-4 transition-all duration-300"
  };

  // State-based classes
  const stateClasses = {
    // Hover effects
    hover: variant === 'default' 
      ? "hover:shadow-xl hover:border-[var(--green)]/50 hover:scale-[1.02]"
      : variant === 'button'
      ? "hover:scale-102"
      : "",
    
    // Selected state (mainly for buttons)
    selected: variant === 'button' && selected
      ? "border-[var(--green)] bg-white/90 shadow-lg scale-105"
      : "",
    
    // Default button state
    buttonDefault: variant === 'button' && !selected
      ? "border-[var(--green)]/20 bg-white/60 hover:border-[var(--green)]/40 hover:bg-white/80"
      : "",
    
    // Disabled state
    disabled: disabled ? "opacity-50 cursor-not-allowed" : "",
    
    // Compact variant specific styling
    compactStyle: variant === 'compact' ? "" : "",
    
    // Group hover for nested elements
    group: "group"
  };

  // Combine all classes
  const combinedClasses = [
    baseClasses,
    variantClasses[variant],
    hover ? stateClasses.hover : "",
    stateClasses.selected,
    stateClasses.buttonDefault,
    stateClasses.disabled,
    stateClasses.group,
    className
  ].filter(Boolean).join(' ');

  // Apply inline styles for complex effects
  const inlineStyles = variant === 'compact' ? {
    boxShadow: 'inset 1px 1px 4px rgba(0,0,0,0.2), inset -1px -1px 4px rgba(255,255,255,0.05)'
  } : variant === 'default' ? {
    boxShadow: 'inset 1px 1px 4px rgba(0,0,0,0.05), inset -1px -1px 4px rgba(255,255,255,0.15), 0 4px 20px rgba(0,0,0,0.1)'
  } : {};

  return (
    <div 
      className={combinedClasses}
      style={inlineStyles}
      onClick={!disabled ? onClick : undefined}
    >
      {/* Glass reflection effect - only for default and button variants */}
      {(variant === 'default' || variant === 'button') && (
        <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent rounded-t-2xl pointer-events-none" />
      )}
      
      {/* Content with proper z-index */}
      <div className="relative z-10">
        {children}
      </div>
      
      {/* Bottom glass highlight - only for default and selected button variants */}
      {(variant === 'default' || (variant === 'button' && selected)) && (
        <div className={`absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[var(--green)]/30 to-transparent ${
          variant === 'button' && selected ? 'opacity-100' : ''
        }`} />
      )}
    </div>
  );
};

export default GlassCard;