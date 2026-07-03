import React, { useMemo } from 'react';
import type { CityData } from '../../../constants/cities';
import { formatPercentage } from '../../../utils/formatters';
import {
  PALETTE,
  curtainSteps,
  mainPathD,
  pointAtY,
  polyD,
  samplePath,
  yForScore,
} from './rideRibbon';

const VIEW_W = 720;
const VIEW_H = 900;
const LABEL_X = 575; // left edge of the label column
const LABEL_TOP_Y = 120;
const LABEL_BOTTOM_Y = 780;
const RIPPLE_S = 3.2;
const STAGGER_MS = 24;

interface Props {
  /** Cities to place on the ribbon, already sampled; needs coverage set. */
  cities: CityData[];
}

/**
 * The glassy ride-ribbon with the city coverage ranking overlaid: each city
 * sits on the main path at the height of its infrastructure coverage (best on
 * top), with a leader line out to an evenly spaced label column on the right.
 */
const RideRibbonRanking: React.FC<Props> = ({ cities }) => {
  const { pts, steps, pathD } = useMemo(() => {
    const sampled = samplePath();
    return { pts: sampled, steps: curtainSteps(sampled), pathD: mainPathD() };
  }, []);

  const ranked = useMemo(() => {
    const withCoverage = cities.filter(c => c.coverage != null);
    if (withCoverage.length === 0) return [];
    const scores = withCoverage.map(c => c.coverage as number);
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const sorted = [...withCoverage].sort(
      (a, b) => (b.coverage as number) - (a.coverage as number),
    );
    const rowGap =
      sorted.length > 1 ? (LABEL_BOTTOM_Y - LABEL_TOP_Y) / (sorted.length - 1) : 0;
    return sorted.map((city, i) => {
      const target = pointAtY(pts, yForScore(city.coverage as number, min, max));
      return {
        city,
        target,
        labelY: sorted.length > 1 ? LABEL_TOP_Y + i * rowGap : (LABEL_TOP_Y + LABEL_BOTTOM_Y) / 2,
      };
    });
  }, [cities, pts]);

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      width="100%"
      role="img"
      aria-label="Ranking de ciudades por cobertura de infraestructura ciclista"
    >
      <defs>
        {/* Color encodes ranking altitude: fixed in canvas space so curtain
            strokes shift through the palette as they fall. */}
        <linearGradient id="rr-altitude" gradientUnits="userSpaceOnUse" x1="0" y1="80" x2="0" y2="820">
          {PALETTE.map(([offset, color]) => (
            <stop key={offset} offset={offset} stopColor={color} />
          ))}
        </linearGradient>
        {/* Diagonal sheen for the glass volume. */}
        <linearGradient id="rr-sheen" gradientUnits="userSpaceOnUse" x1="120" y1="150" x2="450" y2="700">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.35" />
          <stop offset="0.4" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        {/* Elliptical bottom boundary: the curtain ends in a drum-like base. */}
        <clipPath id="rr-drum">
          <path
            d="M -20 -20 H 570 V 720
               C 500 750, 420 845, 270 850
               C 160 853, 45 800, -20 750 Z"
          />
        </clipPath>
        <filter id="rr-soften" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>

      <style>{`
        .rr-pl {
          stroke-opacity: 0.45;
          stroke-width: 1.8;
          animation: rr-ripple ${RIPPLE_S}s linear infinite;
        }
        @keyframes rr-ripple {
          0%   { stroke-opacity: 0.45; stroke-width: 1.8; }
          3%   { stroke-opacity: 1;    stroke-width: 2.6; }
          9%   { stroke-opacity: 0.45; stroke-width: 1.8; }
          100% { stroke-opacity: 0.45; stroke-width: 1.8; }
        }
        @media (prefers-reduced-motion: reduce) {
          .rr-pl { animation: none; }
        }
      `}</style>

      {/* Curtain: occlusion-culled parallels; one group per parallel so the
          ripple can sweep downward. */}
      <g clipPath="url(#rr-drum)" fill="none" stroke="url(#rr-altitude)" strokeLinecap="round">
        {steps.map(({ dy, runs }, i) => (
          <g key={dy} className="rr-pl" style={{ animationDelay: `${i * STAGGER_MS}ms` }}>
            {runs.map((run, ri) => (
              <path key={ri} d={polyD(run)} />
            ))}
          </g>
        ))}
      </g>

      {/* Glass sheen across the volume. */}
      <g clipPath="url(#rr-drum)">
        <rect width={VIEW_W} height={VIEW_H} fill="url(#rr-sheen)" />
      </g>

      {/* Main line: soft shadow under a translucent glass body. */}
      <path
        d={pathD}
        fill="none"
        stroke="#171655"
        strokeOpacity="0.22"
        strokeWidth="13"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#rr-soften)"
        transform="translate(0 8)"
      />
      <path
        d={pathD}
        fill="none"
        stroke="url(#rr-altitude)"
        strokeWidth="12"
        strokeOpacity="0.92"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Ranking overlay: marker on the path, leader line, label row. */}
      {ranked.map(({ city, target, labelY }) => (
        <g key={city.slug}>
          <line
            x1={target.x + 9}
            y1={target.y}
            x2={LABEL_X - 8}
            y2={labelY}
            stroke="var(--blue-dark)"
            strokeOpacity="0.45"
            strokeWidth="1"
            strokeDasharray="1 4"
            strokeLinecap="round"
          />
          <circle
            cx={target.x}
            cy={target.y}
            r="4.5"
            fill="var(--cream)"
            stroke="var(--blue-dark)"
            strokeWidth="1.6"
          />
          <text
            x={LABEL_X}
            y={labelY + 4.5}
            fontSize="15"
            fontFamily="EB Garamond, Georgia, serif"
            fill="var(--blue-dark)"
          >
            {city.name}
            <tspan dx="6" fontSize="12" opacity="0.6">
              {formatPercentage(city.coverage as number)}%
            </tspan>
          </text>
        </g>
      ))}
    </svg>
  );
};

export default RideRibbonRanking;
