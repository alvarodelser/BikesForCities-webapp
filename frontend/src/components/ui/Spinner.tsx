import React from 'react';
import B4CSpinner from './B4CSpinner';

interface SpinnerProps {
  /** Optional tailwind classes for the container */
  className?: string;
  /** Optional inline styles */
  style?: React.CSSProperties;
  /** Color for the animation (defaults to std dark green #027A76) */
  color?: string;
}

/**
 * Standard B4C Spinner component.
 * Wraps the physics-driven B4CSpinner animation.
 */
const Spinner: React.FC<SpinnerProps> = ({ 
  className, 
  style, 
  color = '#027A76' 
}) => {
  // Default size w-16 h-16 if no className provided
  const finalClassName = className !== undefined
    ? className
    : `w-16 h-16`;

  return (
    <div className={finalClassName} style={style}>
      <B4CSpinner color={color} className="w-full h-full" />
    </div>
  );
};

export default Spinner;