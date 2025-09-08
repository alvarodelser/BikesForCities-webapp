import React, { useState, useEffect } from 'react';
import { Building2 } from 'lucide-react';

interface CityPinProps {
  cityName: string;
  isSelected?: boolean;
  isExpanded?: boolean;
  variant?: 'glassmorphic' | 'normal';
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  onNavigate?: () => void;
  className?: string;
}

const CityPin: React.FC<CityPinProps> = ({
  cityName,
  isSelected = false,
  isExpanded: externalExpanded = false,
  variant = 'glassmorphic',
  size = 'md',
  onClick,
  onNavigate,
  className = ''
}) => {
  const [internalExpanded, setInternalExpanded] = useState(false);
  const [showText, setShowText] = useState(false);
  const [displayedText, setDisplayedText] = useState('');

  // Use external expanded state if provided, otherwise use internal state
  const isExpanded = externalExpanded || internalExpanded;

  // Size configurations
  const sizeConfig = {
    sm: {
      diamond: 'w-8 h-8',      // Smaller diamond
      expanded: 'w-auto h-8',   // Hexagon height
      icon: 'w-4 h-4',         // Bigger icon relative to diamond
      text: 'text-xs',
      padding: 'px-2 py-1'
    },
    md: {
      diamond: 'w-10 h-10',      // Smaller diamond
      expanded: 'w-auto h-10',  // Hexagon height
      icon: 'w-6 h-6',         // Bigger icon relative to diamond
      text: 'text-sm',
      padding: 'px-3 py-2'
    },
    lg: {
      diamond: 'w-12 h-12',    // Smaller diamond
      expanded: 'w-auto h-12',  // Hexagon height
      icon: 'w-8 h-8',         // Bigger icon relative to diamond
      text: 'text-base',
      padding: 'px-4 py-2'
    }
  };

  const config = sizeConfig[size];

  // Variant styles
  const variantStyles = {
    glassmorphic: {
      base: 'bg-white/20 backdrop-blur-md border border-white/30 shadow-lg',
      hover: 'hover:bg-white/30 hover:border-white/40',
      expanded: 'bg-blue-500/60 border-2 border-[var(--yellow)] backdrop-blur-md shadow-lg' // Blue tint + yellow outline
    },
    normal: {
      base: 'bg-[var(--green)] border border-white/50 shadow-md',
      hover: 'hover:bg-[var(--green)]/90',
      expanded: 'bg-blue-600/80 border-2 border-[var(--yellow)] shadow-lg' // Blue tint + yellow outline
    }
  };

  const styles = variantStyles[variant];

  // Handle click and expansion
  const handleClick = () => {
    if (!externalExpanded && !internalExpanded) {
      // First click - expand the pin (only if not externally controlled)
      setInternalExpanded(true);
      // Start text animation after icon movement (300ms delay)
      setTimeout(() => {
        setShowText(true);
      }, 300);
      onClick?.();
    } else if (isExpanded) {
      // Second click (already expanded) - navigate to city page
      onNavigate?.();
    } else {
      onClick?.();
    }
  };

  // Letter-by-letter animation
  useEffect(() => {
    if (showText && cityName) {
      setDisplayedText('');
      let currentIndex = 0;
      
      const timer = setInterval(() => {
        if (currentIndex <= cityName.length) {
          setDisplayedText(cityName.slice(0, currentIndex));
          currentIndex++;
        } else {
          clearInterval(timer);
        }
      }, 80); // 80ms per letter

      return () => clearInterval(timer);
    }
  }, [showText, cityName]);

  // Handle external expansion state changes
  useEffect(() => {
    if (externalExpanded && !showText) {
      // External expansion - show text immediately
      setTimeout(() => {
        setShowText(true);
      }, 300);
    } else if (!externalExpanded && !internalExpanded) {
      // Reset when not expanded externally or internally
      setShowText(false);
      setDisplayedText('');
    }
  }, [externalExpanded, internalExpanded, showText]);

  // Reset internal state when not selected
  useEffect(() => {
    if (!isSelected && !externalExpanded) {
      setInternalExpanded(false);
      setShowText(false);
      setDisplayedText('');
    }
  }, [isSelected, externalExpanded]);

  return (
    <div className={`relative inline-block ${className}`}>
      <div
        className={`
          relative cursor-pointer transition-all duration-500 ease-out
          ${isExpanded 
            ? `${config.expanded} ${config.padding} flex items-center gap-3 min-w-max` 
            : `${config.diamond} rotate--45 flex items-center justify-center`
          }
          ${styles.base}
          ${isExpanded ? styles.expanded : styles.hover}
          ${isSelected ? 'ring-2 ring-[var(--yellow)] ring-opacity-70' : ''}
        `}
        style={{
          clipPath: isExpanded 
            ? 'polygon(15% 0%, 85% 0%, 100% 50%, 85% 100%, 15% 100%, 0% 50%)' // Hexagon shape
            : 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)', // Diamond shape
        }}
        onClick={handleClick}
      >
        {/* Icon */}
        <div
          className={`
            flex items-center justify-center transition-all duration-300 ease-out
            ${isExpanded ? 'translate-x-0' : 'translate-x-0'}
          `}
        >
          <Building2 
            className={`
              ${config.icon} 
              ${variant === 'glassmorphic' ? 'text-white' : 'text-white'}
              transition-all duration-300
            `}
          />
        </div>

        {/* Text (appears after expansion) */}
        {isExpanded && (
          <div
            className={`
              ${config.text} font-medium whitespace-nowrap overflow-hidden
              ${variant === 'glassmorphic' ? 'text-white' : 'text-white'}
              transition-all duration-300
            `}
            style={{
              opacity: showText ? 1 : 0,
              transform: showText ? 'translateX(0)' : 'translateX(-10px)'
            }}
          >
            {displayedText}
            {/* Cursor effect while typing */}
            {showText && displayedText.length < cityName.length && (
              <span className="animate-pulse">|</span>
            )}
          </div>
        )}
      </div>

      {/* Hover tooltip for collapsed state */}
      {!isExpanded && (
        <div
          className="absolute -top-8 left-1/2 -translate-x-1/2 
                     bg-black/80 text-white text-xs px-2 py-1 rounded-md
                     opacity-0 group-hover:opacity-100 transition-opacity duration-200
                     pointer-events-none z-10 whitespace-nowrap"
        >
          {cityName}
        </div>
      )}

      {/* Glassmorphic shine effect */}
      {variant === 'glassmorphic' && (
        <div
          className="absolute inset-0 pointer-events-none bg-gradient-to-br from-white/20 via-transparent to-transparent transition-all duration-500"
          style={{
            clipPath: isExpanded 
              ? 'polygon(15% 0%, 85% 0%, 100% 50%, 85% 100%, 15% 100%, 0% 50%)' // Hexagon shape
              : 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)', // Diamond shape
          }}
        />
      )}
    </div>
  );
};

export default CityPin;
