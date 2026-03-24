import React from 'react';

interface SpinnerProps {
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Common loading spinner component.
 * By default, uses w-16 h-16 and var(--green) border color.
 */
const Spinner: React.FC<SpinnerProps> = ({ className, style }) => {
  const finalClassName = className !== undefined 
    ? `rounded-full border-4 border-t-transparent animate-spin ${className}`
    : `w-16 h-16 rounded-full border-4 border-t-transparent animate-spin border-[var(--green)]`;

  return (
    <div
      className={finalClassName}
      style={style}
    />
  );
};

export default Spinner;
