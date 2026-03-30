import React from 'react';

/**
 * B4CLogo – inline SVG version of B4CThick.svg.
 * Uses `currentColor` for all strokes and fills so CSS `color` controls the tint.
 * Default: black. Wrap in a span with a hover class to animate.
 *
 * @example
 *   <span className="logo-link"><B4CLogo className="h-8" /></span>
 */
interface B4CLogoProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
}

const B4CLogo: React.FC<B4CLogoProps> = ({ className = '', ...props }) => (
  <svg
    viewBox="0 0 210 297"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    fill="none"
    stroke="currentColor"
    {...props}
  >
    {/* Wheel circles */}
    <circle
      cx="51.57188" cy="239.64207" r="31.599552"
      strokeWidth="10.2759"
    />
    <circle
      cx="156.01056" cy="186.93922" r="31.599552"
      strokeWidth="10.2759"
    />

    {/* Frame / spokes */}
    <path
      d="m 50.846601,236.49926 13.054839,-53.18638 50.28529,-26.10967 14.02187,14.98889 c 0,0 12.57132,13.05484 27.56021,12.57132"
      strokeWidth="10.2759" strokeLinecap="round"
    />
    <path
      d="m 57.615774,177.02723 43.999646,44.48314 16.92292,-61.40608"
      strokeWidth="10.2759" strokeLinejoin="round"
    />
    <path
      d="M 50.363097,237.46628 101.1319,221.99388"
      strokeWidth="10.2759" strokeLinecap="round"
    />
    <path
      d="m 104.03298,146.80769 11.6043,11.84606"
      strokeWidth="10.2759"
    />
    <path
      d="m 83.725453,143.66485 15.472397,-7.49444 c 0,0 9.42849,-0.96702 5.80215,12.32959"
      strokeWidth="10.2759" strokeLinecap="round"
    />

    {/* Handle-bar / fork top (thinner strokes) */}
    <path
      d="M 40.191901,59.994455 101.34225,137.33773 74.243549,60.246923"
      strokeWidth="6.42242" strokeLinecap="round" strokeLinejoin="round"
    />
    <path
      d="M 129.99901,60.228186 102.79279,135.88719"
      strokeWidth="6.42242" strokeLinecap="round" strokeLinejoin="round"
    />
    <path
      d="m 74.243549,60.246923 c 0,0 1.422686,-31.062096 27.340451,-45.237861"
      strokeWidth="6.42242" strokeLinecap="round" strokeLinejoin="round"
    />
    <path
      d="m 129.99901,60.228186 c 0,0 -1.67437,-32.886906 -27.83793,-45.219124"
      strokeWidth="6.42242" strokeLinecap="round" strokeLinejoin="round"
    />
    <path
      d="m 164.56397,59.74112 -61.5942,77.35629"
      strokeWidth="6.42242" strokeLinecap="round" strokeLinejoin="round"
    />

    {/* Filled saddle/seat shape – uses fill:currentColor */}
    <path
      fill="currentColor"
      stroke="none"
      d="m 54.19147,180.87018 c -2.010069,-1.91387 -6.180102,-0.55439 -7.793595,-0.15447 0,0 -10.706602,-0.38971 -5.502575,-6.06523 14.806373,-16.14787 28.224485,-14.54298 24.4,-10.49742 -5.722553,6.05332 -3.886711,9.40213 -3.886711,9.40213 z"
    />

    {/* Rim arcs */}
    <path
      d="m 39.181097,59.74112 c 0,0 7.029138,-43.88701 62.661403,-44.607939"
      strokeWidth="10.2759" strokeLinecap="round" strokeLinejoin="round"
    />
    <path
      d="m 164.05066,59.975718 c 0,0 -18.09574,9.197451 -34.05165,0.252468"
      strokeWidth="10.2759" strokeLinecap="round" strokeLinejoin="round"
    />
    <path
      d="m 129.99901,60.228186 c 0,0 -9.89623,7.952301 -28.29457,7.484755"
      strokeWidth="10.2759" strokeLinejoin="round"
    />
    <path
      d="m 164.56397,59.74112 c 0,0 -7.02912,-43.88701 -62.66139,-44.607939"
      strokeWidth="10.2759" strokeLinecap="round" strokeLinejoin="round"
    />
    <path
      d="m 40.191901,59.994455 c 0,0 18.09574,9.19745 34.051648,0.252468"
      strokeWidth="10.2759" strokeLinecap="round" strokeLinejoin="round"
    />
    <path
      d="m 74.243549,60.246923 c 0,0 10.451862,7.913889 28.850221,7.446337"
      strokeWidth="10.2759" strokeLinejoin="round"
    />
  </svg>
);

export default B4CLogo;
