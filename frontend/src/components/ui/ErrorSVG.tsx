import React from 'react';

/**
 * ErrorSVG – inline SVG version of ErrorIcon.svg.
 * Uses `currentColor` for all strokes and fills so CSS `color` controls the tint.
 * 
 * @example
 *   <ErrorSVG className="h-12 w-12 text-[var(--red)]" />
 */
interface ErrorSVGProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
}

const ErrorSVG: React.FC<ErrorSVGProps> = ({ className = '', ...props }) => (
  <svg
    viewBox="0 0 210 297"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    fill="none"
    stroke="currentColor"
    {...props}
  >
    <g>
      {/* Wheel circles */}
      <circle
        cx="97.251419"
        cy="-243.50136"
        r="24.600996"
        transform="rotate(122.5595)"
        strokeWidth="4.35695"
        strokeDasharray="108.924 45.65"
      />

      <circle
        cx="-179.19919"
        cy="-42.492512"
        r="24.600996"
        transform="rotate(-125.85447)"
        strokeWidth="4.357"
      />
      
      {/* Frame paths */}
      <path
        strokeWidth="4.99999"
        strokeLinecap="round"
        d="m 149.74905,213.89016 -39.51361,16.01558 -39.405441,-19.82387 3.063955,-15.68277 c 0,0 2.505025,-13.88554 -4.635057,-23.12303"
      />
      <path
        strokeWidth="4.99999"
        strokeLinejoin="round"
        d="m 109.13548,236.73826 8.00484,-48.0482 -46.464098,17.32304"
      />
      <path
        strokeWidth="4.99999"
        strokeLinecap="round"
        d="M 150.57972,213.75428 117.6659,188.77468"
      />
      <path
        strokeWidth="4.99999"
        d="m 68.900583,221.22926 2.183255,-12.72414"
      />
      <path
        strokeWidth="4.99999"
        strokeLinecap="round"
        d="m 76.17776,235.47644 -11.784448,-6.34557 c 0,0 -4.909619,-5.50841 5.134148,-9.28349"
      />
      
      {/* Saddle / Detail */}
      <path
        fill="currentColor"
        stroke="none"
        d="m 111.64589,237.0032 c 0,0 0.0764,0.93445 0.72342,1.46598 1.88268,1.54672 2.86483,2.38314 2.86483,2.38314 0,0 4.92028,4.26511 -0.95018,3.05044 -5.87047,-1.21468 -15.692837,-4.88538 -15.692837,-4.88538 0,0 -2.940985,-2.81109 0.195362,-2.26017 8.020595,1.4089 7.885775,-0.43092 7.885775,-0.43092 z"
      />
      
      {/* Exclamation Mark - Bar */}
      <path
        fill="currentColor"
        strokeWidth="4.99999"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m 120.73827,158.0493 -1.89684,-21.00784 3.41674,-0.0338 z"
      />
      
      {/* Exclamation Mark - Dot */}
      <circle
        fill="currentColor"
        stroke="none"
        cx="120.77196"
        cy="166.7486"
        r="3.5543115"
      />
    </g>
  </svg>
);

export default ErrorSVG;
