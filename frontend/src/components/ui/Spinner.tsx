import React from 'react';
import B4CSpinner from './B4CSpinner'; // Import the auto-generated SVG component

interface SpinnerProps {
  className?: string;
  style?: React.CSSProperties;
}

const Spinner: React.FC<SpinnerProps> = ({ className, style }) => {
  // Use the provided className or fallback to the default size & var(--green)
  const finalClassName = className !== undefined
    ? className
    : `w-16 h-16 text-[var(--green)]`;

  return (
    <div className={finalClassName} style={style}>
      {/* The SVG component spreads {...props}, meaning it will receive 
        this className and fill the parent wrapper perfectly.
        Because we injected 'currentColor' via python, it will instantly 
        adopt the text color of the wrapper.
      */}
      <B4CSpinner className="w-full h-full" />
    </div>
  );
};

export default Spinner;