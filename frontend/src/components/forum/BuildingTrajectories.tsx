import React, { useEffect, useRef, useState } from 'react';
import type { CityBuildingBackgroundHandle } from './CityBuildingBackground';
import { findBuildingsNearPoints } from '../../utils/buildingProximity';
import type { SvgRect, SvgPoint } from '../../utils/buildingProximity';
import { SVG_W, SVG_H } from '../../utils/geoProjection';

// ---- Props ----

interface BuildingTrajectoriesProps {
  bgRef: React.RefObject<CityBuildingBackgroundHandle>;
}

// ---- Constants ----

const PATHS = [
  'M 0,98  Q 250,70 500,154  T 1000,126',  // upper sweep L→R
  'M 0,385 Q 250,350 500,420 T 1000,385',  // mid sweep L→R
  'M 1000,546 Q 750,511 500,574 T 0,546',  // lower sweep R→L
];

const INITIAL_DELAYS = [0, 4000, 8000];

const DRAW_DURATION = 2500;
const POP_AT = 1250;      // ms into draw phase
const HOLD_DURATION = 1000;
const FADE_DURATION = 500;
const IDLE_MIN = 8000;
const IDLE_MAX = 16000;
const SAMPLE_COUNT = 20;
const POP_THRESHOLD = 30;

type PathPhase = 'idle' | 'drawing' | 'holding' | 'fading';

// ---- Component ----

const BuildingTrajectories: React.FC<BuildingTrajectoriesProps> = ({ bgRef }) => {
  const pathRefs = [
    useRef<SVGPathElement>(null),
    useRef<SVGPathElement>(null),
    useRef<SVGPathElement>(null),
  ];

  const [pathLengths, setPathLengths] = useState<number[]>([0, 0, 0]);
  const [phases, setPhases] = useState<PathPhase[]>(['idle', 'idle', 'idle']);
  const [dashOffsets, setDashOffsets] = useState<number[]>([0, 0, 0]);
  const [opacities, setOpacities] = useState<number[]>([1, 1, 1]);
  const [circlePositions, setCirclePositions] = useState<{ x: number; y: number }[]>([
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: 0 },
  ]);

  // Measure path lengths after mount
  useEffect(() => {
    const lengths = pathRefs.map((ref) =>
      ref.current ? ref.current.getTotalLength() : 0
    );
    setPathLengths(lengths);
    // Initialize dashOffsets to pathLengths (hidden)
    setDashOffsets(lengths);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // State machine for each path
  useEffect(() => {
    if (pathLengths.every((l) => l === 0)) return;

    const timeoutHandles: (ReturnType<typeof setTimeout>)[] = [];
    const rafHandles: number[] = [0, 0, 0];

    function triggerPopForPath(pathIndex: number): void {
      if (!bgRef.current) return;
      const pathEl = pathRefs[pathIndex].current;
      if (!pathEl) return;
      const svgEl = bgRef.current.svgElement;
      if (!svgEl) return;

      const pathLength = pathLengths[pathIndex];
      if (pathLength === 0) return;

      // Sample points along the path
      const samplePoints: SvgPoint[] = [];
      for (let i = 0; i < SAMPLE_COUNT; i++) {
        const t = i / (SAMPLE_COUNT - 1);
        const pt = pathEl.getPointAtLength(t * pathLength);
        samplePoints.push({ x: pt.x, y: pt.y });
      }

      // Build building bounding boxes map
      const buildingRects = new Map<string, SvgRect>();
      const bldgPolys = svgEl.querySelectorAll('.bldg-poly');
      bldgPolys.forEach((el) => {
        if (el.id) {
          const bbox = (el as SVGGraphicsElement).getBBox();
          buildingRects.set(el.id, {
            x: bbox.x,
            y: bbox.y,
            width: bbox.width,
            height: bbox.height,
          });
        }
      });

      // Find nearby buildings and trigger pop
      const nearbyIds = findBuildingsNearPoints(samplePoints, buildingRects, POP_THRESHOLD);
      bgRef.current.triggerPop(nearbyIds);
    }

    function startRAFLoop(pathIndex: number, startTime: number): void {
      const pathLength = pathLengths[pathIndex];
      const pathEl = pathRefs[pathIndex].current;
      if (!pathEl || pathLength === 0) return;

      function tick(now: number): void {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / DRAW_DURATION, 1);
        const pt = pathEl!.getPointAtLength(progress * pathLength);
        setCirclePositions((prev) => {
          const next = [...prev];
          next[pathIndex] = { x: pt.x, y: pt.y };
          return next;
        });

        if (progress < 1) {
          rafHandles[pathIndex] = requestAnimationFrame(tick);
        }
      }

      rafHandles[pathIndex] = requestAnimationFrame(tick);
    }

    function stopRAFLoop(pathIndex: number): void {
      if (rafHandles[pathIndex]) {
        cancelAnimationFrame(rafHandles[pathIndex]);
        rafHandles[pathIndex] = 0;
      }
    }

    function runCycle(pathIndex: number, initialDelay: number): void {
      // IDLE → wait initialDelay → DRAWING
      const idleHandle = setTimeout(() => {
        const pathLength = pathLengths[pathIndex];

        // Enter DRAWING: reset dashOffset to pathLength (no transition), set opacity to 1
        setDashOffsets((prev) => {
          const next = [...prev];
          next[pathIndex] = pathLength;
          return next;
        });
        setOpacities((prev) => {
          const next = [...prev];
          next[pathIndex] = 1;
          return next;
        });

        // Small delay to allow the reset to apply before starting the transition
        const drawStartHandle = setTimeout(() => {
          setPhases((prev) => {
            const next = [...prev] as PathPhase[];
            next[pathIndex] = 'drawing';
            return next;
          });

          // Start the stroke animation: set dashOffset to 0 with transition
          setDashOffsets((prev) => {
            const next = [...prev];
            next[pathIndex] = 0;
            return next;
          });

          // Start RAF loop for circle traveller
          startRAFLoop(pathIndex, performance.now());

          // Pop trigger at midpoint
          const popHandle = setTimeout(() => {
            triggerPopForPath(pathIndex);
          }, POP_AT);
          timeoutHandles.push(popHandle);

          // After draw completes → HOLDING
          const holdHandle = setTimeout(() => {
            stopRAFLoop(pathIndex);
            setPhases((prev) => {
              const next = [...prev] as PathPhase[];
              next[pathIndex] = 'holding';
              return next;
            });

            // After hold → FADING
            const fadeHandle = setTimeout(() => {
              setPhases((prev) => {
                const next = [...prev] as PathPhase[];
                next[pathIndex] = 'fading';
                return next;
              });
              setOpacities((prev) => {
                const next = [...prev];
                next[pathIndex] = 0;
                return next;
              });

              // After fade → IDLE + schedule next cycle
              const idleStartHandle = setTimeout(() => {
                setPhases((prev) => {
                  const next = [...prev] as PathPhase[];
                  next[pathIndex] = 'idle';
                  return next;
                });
                // Reset dashOffset (hidden) without transition
                setDashOffsets((prev) => {
                  const next = [...prev];
                  next[pathIndex] = pathLength;
                  return next;
                });
                setOpacities((prev) => {
                  const next = [...prev];
                  next[pathIndex] = 1;
                  return next;
                });

                // Random idle wait before next cycle
                const idleWait =
                  IDLE_MIN + Math.random() * (IDLE_MAX - IDLE_MIN);
                runCycle(pathIndex, idleWait);
              }, FADE_DURATION);
              timeoutHandles.push(idleStartHandle);
            }, HOLD_DURATION);
            timeoutHandles.push(fadeHandle);
          }, DRAW_DURATION);
          timeoutHandles.push(holdHandle);
        }, 20); // small rAF-friendly delay for reset to flush
        timeoutHandles.push(drawStartHandle);
      }, initialDelay);
      timeoutHandles.push(idleHandle);
    }

    // Start each path with its staggered initial delay
    INITIAL_DELAYS.forEach((delay, i) => {
      runCycle(i, delay);
    });

    return () => {
      timeoutHandles.forEach(clearTimeout);
      rafHandles.forEach((h) => {
        if (h) cancelAnimationFrame(h);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathLengths]);

  // Build transition style per path based on phase
  function getTransitionStyle(pathIndex: number): string {
    const phase = phases[pathIndex];
    if (phase === 'drawing') {
      return `stroke-dashoffset ${DRAW_DURATION}ms ease-in-out`;
    }
    if (phase === 'fading') {
      return `opacity ${FADE_DURATION}ms`;
    }
    return 'none';
  }

  return (
    <svg
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      preserveAspectRatio="xMidYMid slice"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 2,
      }}
    >
      {PATHS.map((d, i) => (
        <g key={i}>
          <path
            ref={pathRefs[i]}
            d={d}
            fill="none"
            stroke="var(--green-dark)"
            strokeWidth={1.5}
            strokeLinecap="round"
            style={{
              strokeDasharray: pathLengths[i] || 0,
              strokeDashoffset: dashOffsets[i],
              opacity: opacities[i],
              transition: getTransitionStyle(i),
            }}
          />
          <circle
            cx={circlePositions[i].x}
            cy={circlePositions[i].y}
            r={4}
            fill="var(--green-dark)"
            opacity={phases[i] === 'drawing' || phases[i] === 'holding' ? opacities[i] : 0}
          />
        </g>
      ))}
    </svg>
  );
};

export default BuildingTrajectories;
