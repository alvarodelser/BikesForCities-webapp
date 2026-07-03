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
  pathHitAtY,
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

// B4C bike mark geometry, in its original artwork's own coordinate space
// (ported from src/assets/B4CThickBike.svg). Used to compute a rigid
// transform per marker: scale to the render size, rotate to the path's
// local tangent, then move the wheel-contact point onto the path.
const BIKE_WHEEL_REAR = { x: 51.57188, y: 239.64207, r: 31.599552 };
const BIKE_WHEEL_FRONT = { x: 156.01056, y: 186.93922, r: 31.599552 };
// Midpoint between the wheels' ground-contact points (center + r straight
// down, in the artwork's own upright frame) — the point that should land
// exactly on the path.
const BIKE_ANCHOR = {
  x: (BIKE_WHEEL_REAR.x + BIKE_WHEEL_FRONT.x) / 2,
  y: (BIKE_WHEEL_REAR.y + BIKE_WHEEL_REAR.r + BIKE_WHEEL_FRONT.y + BIKE_WHEEL_FRONT.r) / 2,
};
// The artwork's own "forward" direction (rear wheel -> front wheel), so we
// know how much extra rotation to add on top of the path's tangent angle.
const BIKE_FORWARD_ANGLE0 =
  (Math.atan2(BIKE_WHEEL_FRONT.y - BIKE_WHEEL_REAR.y, BIKE_WHEEL_FRONT.x - BIKE_WHEEL_REAR.x) * 180) /
  Math.PI;
const BIKE_RAW_SPAN = Math.hypot(
  BIKE_WHEEL_FRONT.x - BIKE_WHEEL_REAR.x,
  BIKE_WHEEL_FRONT.y - BIKE_WHEEL_REAR.y,
);
const CITY_ICON_SPAN = 30; // rendered wheel-to-wheel distance
const CITY_ICON_SCALE = CITY_ICON_SPAN / BIKE_RAW_SPAN;
// How far above the path centerline the wheel-contact point sits, so the
// tires touch the ribbon's top edge instead of straddling its centerline.
const CITY_WHEEL_OFFSET = 7; // half the main path's stroke width, plus a hair
const CITY_MUTE_R = 18;
const CITY_LEADER_OFFSET = CITY_ICON_SPAN / 2 + 6;

/** The two directions perpendicular to a tangent; "up" is whichever points
    more toward negative y (away from the curtain, which always hangs below
    the path) — robust even where the path runs right-to-left locally. */
function topNormal(angleDeg: number): { nx: number; ny: number } {
  const rad = (angleDeg * Math.PI) / 180;
  const tx = Math.cos(rad);
  const ty = Math.sin(rad);
  const a = { nx: -ty, ny: tx };
  const b = { nx: ty, ny: -tx };
  return a.ny < b.ny ? a : b;
}

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
    const hits = sorted.map(city =>
      pathHitAtY(pts, yForScore(city.coverage as number, min, max)),
    );
    // Labels sit at their point's own height whenever rows don't collide;
    // only clustered scores get nudged apart.
    const labelYs = resolveLabelPositions(
      hits.map(h => h.point.y),
      ROW_MIN_GAP,
      LABEL_TOP_Y,
      LABEL_BOTTOM_Y,
    );
    return sorted.map((city, i) => {
      const { point: target, angleDeg } = hits[i];
      const normal = topNormal(angleDeg);
      const anchor = {
        x: target.x + normal.nx * CITY_WHEEL_OFFSET,
        y: target.y + normal.ny * CITY_WHEEL_OFFSET,
      };
      const bikeRotation = angleDeg - BIKE_FORWARD_ANGLE0;
      const bikeTransform =
        `translate(${anchor.x} ${anchor.y}) ` +
        `rotate(${bikeRotation}) ` +
        `scale(${CITY_ICON_SCALE}) ` +
        `translate(${-BIKE_ANCHOR.x} ${-BIKE_ANCHOR.y})`;
      return { city, target, labelY: labelYs[i], bikeTransform };
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
        {/* B4C bike mark, recolored via currentColor and left in its raw
            artwork coordinates — used as each city's marker on the path,
            positioned/rotated per marker via the <use> transform below.
            Ported from src/assets/B4CThickBike.svg. */}
        <g id="rr-citybike" fill="none">
          <circle cx="51.57188" cy="239.64207" r="31.599552" fill="none" stroke="currentColor" strokeWidth="10.2759" />
          <circle cx="156.01056" cy="186.93922" r="31.599552" fill="none" stroke="currentColor" strokeWidth="10.2759" />
          <path
            d="m 50.846601,236.49926 13.054839,-53.18638 50.28529,-26.10967 14.02187,14.98889 c 0,0 12.57132,13.05484 27.56021,12.57132"
            fill="none"
            stroke="currentColor"
            strokeWidth="10.2759"
            strokeLinecap="round"
          />
          <path
            d="m 57.615774,177.02723 43.999646,44.48314 16.92292,-61.40608"
            fill="none"
            stroke="currentColor"
            strokeWidth="10.2759"
            strokeLinecap="butt"
            strokeLinejoin="round"
          />
          <path
            d="M 50.363097,237.46628 101.1319,221.99388"
            fill="none"
            stroke="currentColor"
            strokeWidth="10.2759"
            strokeLinecap="round"
          />
          <path d="m 104.03298,146.80769 11.6043,11.84606" fill="none" stroke="currentColor" strokeWidth="10.2759" />
          <path
            d="m 83.725453,143.66485 15.472397,-7.49444 c 0,0 9.42849,-0.96702 5.80215,12.32959"
            fill="none"
            stroke="currentColor"
            strokeWidth="10.2759"
            strokeLinecap="round"
          />
          <path
            d="m 54.19147,180.87018 c -2.010069,-1.91387 -6.180102,-0.55439 -7.793595,-0.15447 0,0 -10.706602,-0.38971 -5.502575,-6.06523 14.806373,-16.14787 28.224485,-14.54298 24.4,-10.49742 -5.722553,6.05332 -3.886711,9.40213 -3.886711,9.40213 z"
            fill="currentColor"
            stroke="none"
          />
        </g>
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
      {ranked.map(({ city, target, labelY, bikeTransform }) => (
        <g key={city.slug}>
          <line
            x1={target.x + CITY_LEADER_OFFSET}
            y1={target.y}
            x2={LEADER_END_X}
            y2={labelY}
            stroke="var(--blue-dark)"
            strokeOpacity="0.45"
            strokeWidth="1"
            strokeDasharray="1 4"
            strokeLinecap="round"
          />
          {/* Cream halo mutes the curtain behind the marker before the
              bike icon, colored a shade darker than the path so it reads
              as a highlighted point, sits on top. */}
          <circle cx={target.x} cy={target.y} r={CITY_MUTE_R} fill="var(--cream)" fillOpacity="0.6" />
          <use href="#rr-citybike" transform={bikeTransform} color={darkenColor(colorAtY(target.y), 0.32)} />
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
