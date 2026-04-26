import React from 'react';
import SpinnerSVG from './SpinnerSVG';

interface LoadingContainerProps {
  /** Optional tailwind classes for the container */
  className?: string;
  /** Optional inline styles */
  style?: React.CSSProperties;
  /** Color for the animation (defaults to std dark green #027A76) */
  color?: string;
  /** Optional text to display under the spinner */
  text?: string;
}

/**
 * Loading Container component.
 * Wraps the physics-driven SpinnerSVG animation.
 */
const LoadingContainer: React.FC<LoadingContainerProps> = ({ 
  className, 
  style, 
  color = '#FBF6EF',
  text = 'Cargando...'
}) => {
  // Default size w-24 h-24 if no className provided
  const finalClassName = className !== undefined
    ? className
    : `w-24 h-24`;


  return (
    <div className={`flex flex-col items-center justify-center gap-2 ${finalClassName}`} style={style}>
      <div className="w-full h-full relative flex-1">
        <SpinnerSVG color={color} className="absolute inset-0 w-full h-full" />
      </div>
      {text && (
        <span className="text-xs font-medium tracking-wide opacity-80 mt-2" style={{ color }}>
          {text}
        </span>
      )}
    </div>
  );
};

export default LoadingContainer;