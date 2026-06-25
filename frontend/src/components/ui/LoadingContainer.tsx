import React from 'react';
import SpinnerSVG from './SpinnerSVG';
import AnimatedProgressBar from './AnimatedProgressBar';

interface LoadingContainerProps {
  className?: string;
  style?: React.CSSProperties;
  color?: string;
  text?: string;
}

const LoadingContainer: React.FC<LoadingContainerProps> = ({
  className,
  style,
  color = '#FBF6EF',
  text = 'Cargando...'
}) => {
  const finalClassName = className !== undefined ? className : 'w-24';

  return (
    <div className={`flex flex-col items-center gap-0.5 ${finalClassName}`} style={style}>
      <div className="w-full relative" style={{ height: '80px' }}>
        <SpinnerSVG color={color} className="absolute inset-0 w-full h-full" />
      </div>
      {text && (
        <span className="text-xs font-medium tracking-wide opacity-80" style={{ color }}>
          {text}
        </span>
      )}
      <AnimatedProgressBar color={color} />
    </div>
  );
};

export default LoadingContainer;
