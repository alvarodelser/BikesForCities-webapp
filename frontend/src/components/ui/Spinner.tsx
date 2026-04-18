import React from 'react';

interface SpinnerProps {
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Custom Bicycle & Parachute loading spinner.
 * Includes parachute sway, bike sway, and wheel spinning.
 */
const Spinner: React.FC<SpinnerProps> = ({ className, style }) => {
  const finalClassName = className !== undefined
    ? className
    : `w-16 h-16 text-[var(--green)]`;

  return (
    <div className={finalClassName} style={style}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="30 80 150 180"
        shapeRendering="geometricPrecision"
        textRendering="geometricPrecision"
        className="w-full h-full"
      >
        <style>
          {`
            /* 1. Wheel Spin Animation (Using stroke dashes) */
            @keyframes wheel-spin {
              from { stroke-dashoffset: 80; }
              to { stroke-dashoffset: 0; }
            }
            .bike-wheel {
              animation: wheel-spin 1.5s linear infinite;
            }

            /* 2. Parachute Sway Animation */
            @keyframes parachute-sway {
              from { transform: rotate(-6deg); }
              to { transform: rotate(6deg); }
            }
            .bike-parachute {
              transform-origin: 104px 98px; /* Anchor point */
              animation: parachute-sway 2.5s ease-in-out infinite alternate;
            }

            /* 3. Bike Sway Animation (Counter-swing for realism) */
            @keyframes bike-sway {
              from { transform: rotate(3deg); }
              to { transform: rotate(-3deg); }
            }
            .bike-swing-wrapper {
              transform-origin: 104px 98px; /* Swings from the same top anchor */
              animation: bike-sway 2.5s ease-in-out infinite alternate;
            }
          `}
        </style>

        {/* --- BIKE & WHEELS (Wrapped for rotation) --- */}
        <g className="bike-swing-wrapper">
          <g transform="matrix(0.996553 -0.082957 0.082957 0.996553 -12.723291 9.166306)">
            {/* Back Wheel */}
            <circle className="bike-wheel" r="24.600996" transform="translate(64.557037 238.465775)" fill="none" stroke="#2012e9" strokeWidth="4.35695" strokeLinecap="round" strokeDashoffset="20" strokeDasharray="60,20" />
            {/* Front Wheel */}
            <circle className="bike-wheel" r="24.600996" transform="translate(145.865021 197.435364)" fill="none" stroke="#2012e9" strokeWidth="4.35695" strokeLinecap="round" strokeDashoffset="20" strokeDasharray="60,20" />

            {/* Bike Frame */}
            <path d="M63.992394,236.01901l10.163498-41.40685l39.148288-20.32699l10.91635,11.6692c0,0,9.78707,10.1635,21.45627,9.78707" fill="none" stroke="#2012e9" strokeWidth="4.99999" strokeLinecap="round" />
            <path d="M69.262357,189.71863l34.254753,34.63118l13.1749-47.80609" fill="none" stroke="#2012e9" strokeWidth="4.99999" strokeLinejoin="round" />
            <path d="M63.615969,236.77186l39.524711-12.04563" fill="none" stroke="#2012e9" strokeWidth="4.99999" strokeLinecap="round" />
            <path d="M105.39924,166.19201l9.03422,9.22244" fill="none" stroke="#2012e9" strokeWidth="4.99999" />
            <path d="M89.589352,163.74524l12.045618-5.8346c0,0,7.34031-.75285,4.51712,9.59887" fill="none" stroke="#2012e9" strokeWidth="4.99999" strokeLinecap="round" />
            <path d="M67.577205,191.59815c0,0-.802156-.48538-1.61192-.27233-2.356359.61997-3.60956.9261-3.60956.9261s-6.338853,1.48972-1.91585-2.55686s13.15138-9.85765,13.15138-9.85765s4.00102-.73716,1.717443,1.48218c-5.839803,5.67553-4.269645,6.64389-4.269645,6.64389l-3.461848,3.63467Z" fill="#2012e9" strokeWidth="4.99999" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        </g>

        {/* --- PARACHUTE & STRINGS --- */}
        <g className="bike-parachute">
          <path d="M64.909002,103.86124l38.395438,54.95818-17.503802-54.76996" fill="none" stroke="#2012e9" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M104.2455,104.80231l.18822,52.88783" fill="none" stroke="#2012e9" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M55.310144,98.591281c0,0,6.963878,7.904949,19.38593.941065" fill="none" stroke="#2012e9" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M75.424572,99.335247c0,0,6.963878,7.904953,19.38593.941063" fill="none" stroke="#2012e9" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M94.810504,100.27631c0,0,1.912482,4.53735,9.470226,4.30867" fill="none" stroke="#2012e9" strokeWidth="5" strokeLinejoin="round" />
          <path d="M75.0725,98.214856c0,0,5.276706-32.275708,28.4269-34.534262" fill="none" stroke="#2012e9" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M94.270219,99.720558c0,0,2.823194-32.372623,9.222431-36.136882" fill="none" stroke="#2012e9" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M54.910524,98.40864c0,0,5.472344-34.167069,48.783376-34.728335" fill="none" stroke="#2012e9" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M152.12442,98.591281c0,0-6.96388,7.904949-19.38593.941065" fill="none" stroke="#2012e9" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M132.00999,99.335247c0,0-6.96387,7.904953-19.38593.941063" fill="none" stroke="#2012e9" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M112.62406,100.27631c0,0-1.91248,4.53735-9.47022,4.30867" fill="none" stroke="#2012e9" strokeWidth="5" strokeLinejoin="round" />
          <path d="M132.36207,98.214856c0,0-5.27671-32.275708-28.4269-34.534262" transform="translate(0.124871 -0.387345)" fill="none" stroke="#2012e9" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M113.16435,99.720558c0,0-2.8232-32.372623-9.22243-36.136882" fill="none" stroke="#2012e9" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M152.52404,98.40864c0,0-5.47234-34.167069-48.78337-34.728335" fill="none" stroke="#2012e9" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M142.96695,103.67415l-38.39544,54.95818l17.5038-54.76996" fill="none" stroke="#2012e9" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </svg>
    </div>
  );
};

export default Spinner;