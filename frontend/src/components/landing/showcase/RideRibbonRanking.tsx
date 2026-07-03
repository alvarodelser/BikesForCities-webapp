import React, { useMemo } from 'react';
import type { CityData } from '../../../constants/cities';
import { formatPercentage } from '../../../utils/formatters';
import {
  GRADIENT_Y0,
  GRADIENT_Y1,
  PALETTE,
  colorAtY,
  curtainSteps,
  darkenColor,
  mainPathD,
  pointAtY,
  polyD,
  resolveLabelPositions,
  samplePath,
  yForScore,
} from './rideRibbon';

const VIEW_W = 720;
const VIEW_H = 900;
const RIGHT_EDGE = 700; // labels and header right-align flush to this x
const LEADER_END_X = RIGHT_EDGE - 150; // approx left edge of a name+score row
const HEADER_Y = 78;
const LABEL_TOP_Y = 120;
const LABEL_BOTTOM_Y = 780;
const ROW_MIN_GAP = 32; // vertical room one name + score line needs
const RIPPLE_S = 3.2;
const STAGGER_MS = 24;
const MARKER_R = 4.5;
const LEADER_START_X_OFFSET = MARKER_R + 4.5;
// Keeps extreme scores off the path's very tips (under the rounded caps).
const SCORE_Y_MARGIN = 40;

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
    // Sorted best-first, which also means ascending y (best coverage sits
    // highest on the path) — the order resolveLabelPositions expects.
    const sorted = [...withCoverage].sort(
      (a, b) => (b.coverage as number) - (a.coverage as number),
    );
    const targets = sorted.map(city =>
      pointAtY(pts, yForScore(city.coverage as number, min, max, SCORE_Y_MARGIN)),
    );
    // Labels sit at their point's own height whenever rows don't collide;
    // only clustered scores get nudged apart.
    const labelYs = resolveLabelPositions(
      targets.map(t => t.y),
      ROW_MIN_GAP,
      LABEL_TOP_Y,
      LABEL_BOTTOM_Y,
    );
    return sorted.map((city, i) => ({ city, target: targets[i], labelY: labelYs[i] }));
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
            strokes shift through the palette as they fall. colorAtY() in
            rideRibbon.ts must track y1/y2 here to color scores to match. */}
        <linearGradient
          id="rr-altitude"
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1={GRADIENT_Y0}
          x2="0"
          y2={GRADIENT_Y1}
        >
          {PALETTE.map(([offset, color]) => (
            <stop key={offset} offset={offset} stopColor={color} />
          ))}
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

      <rect width={VIEW_W} height={VIEW_H} fill="var(--cream)" />

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

      {/* Column header, shared across the ranking overlay below. */}
      {ranked.length > 0 && (
        <text
          x={RIGHT_EDGE}
          y={HEADER_Y}
          textAnchor="end"
          fontSize="10"
          letterSpacing="0.04em"
          fontFamily="EB Garamond, Georgia, serif"
          fontWeight="700"
          fill="var(--blue)"
          opacity="0.6"
        >
          COBERTURA DE INFRAESTRUCTURA
        </text>
      )}

      {/* Ranking overlay: marker on the path, leader line, name + score
          (color-matched to the path at that height). Each row sits at its
          point's own height unless that would collide with a neighbor. */}
      {ranked.map(({ city, target, labelY }) => (
        <g key={city.slug}>
          <line
            x1={target.x + LEADER_START_X_OFFSET}
            y1={target.y}
            x2={LEADER_END_X}
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
            r={MARKER_R}
            fill={darkenColor(colorAtY(target.y), 0.32)}
            stroke="var(--cream)"
            strokeWidth="1.4"
          />
          <text x={RIGHT_EDGE} y={labelY + 5} textAnchor="end" fontFamily="EB Garamond, Georgia, serif">
            <tspan fontSize="14" fill="var(--blue-dark)" opacity="0.75">
              {city.name}
            </tspan>
            <tspan dx="8" fontSize="19" fontWeight="700" fill={colorAtY(target.y)}>
              {formatPercentage(city.coverage as number)}
            </tspan>
          </text>
        </g>
      ))}
    </svg>
  );
};

export default RideRibbonRanking;
