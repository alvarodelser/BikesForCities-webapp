import React, { useEffect, useRef, useState } from 'react';
import type { CityBuildingBackgroundHandle } from './CityBuildingBackground';
import { findBuildingsNearPoints } from '../../utils/buildingProximity';
import type { SvgRect, SvgPoint } from '../../utils/buildingProximity';
import { SVG_W, SVG_H } from '../../utils/geoProjection';

// ---- Props ----

interface BuildingTrajectoriesProps {
  bgRef: React.RefObject<CityBuildingBackgroundHandle>;
  trajectoryPaths: string[];
}

// ---- Constants ----

const DEFAULT_PATHS = [
  'M -60,98  L 150,70  L 500,154  L 750,120  L 1060,126',
  'M -60,385 L 200,350 L 500,420 L 800,370 L 1060,385',
  'M 1060,546 L 800,511 L 500,574 L 200,530 L -60,546',
];

const INITIAL_DELAYS = [0, 4500, 9000];

const DRAW_DURATION = 3200;
const HOLD_DURATION = 800;
const FADE_DURATION = 700;
const IDLE_MIN = 10000;
const IDLE_MAX = 18000;
const SAMPLE_STEP = 28;   // px of path per progressive sample
const POP_THRESHOLD = 32;
const PATH_COUNT = 3;

type PathPhase = 'idle' | 'drawing' | 'holding' | 'fading';

// ---- Component ----

const BuildingTrajectories: React.FC<BuildingTrajectoriesProps> = ({ bgRef, trajectoryPaths }) => {
  const PATHS = trajectoryPaths.length > 0 ? trajectoryPaths : DEFAULT_PATHS;

  const pathRefs = [
    useRef<SVGPathElement>(null),
    useRef<SVGPathElement>(null),
    useRef<SVGPathElement>(null),
  ];

  const [pathLengths, setPathLengths] = useState<number[]>([0, 0, 0]);
  const [phases, setPhases] = useState<PathPhase[]>(['idle', 'idle', 'idle']);
  const [dashOffsets, setDashOffsets] = useState<number[]>([0, 0, 0]);
  const [opacities, setOpacities] = useState<number[]>([1, 1, 1]);

  // Per-path progressive illumination tracking
  const lastSampledRef = useRef<number[]>([0, 0, 0]);
  const litBuildingIdsRef = useRef<[Set<string>, Set<string>, Set<string>]>([
    new Set(),
    new Set(),
    new Set(),
  ]);
  const buildingRectsRef = useRef<Map<string, SvgRect> | null>(null);

  // Measure path lengths after mount
  useEffect(() => {
    const lengths = pathRefs.map((ref) =>
      ref.current ? ref.current.getTotalLength() : 0
    );
    setPathLengths(lengths);
    setDashOffsets(lengths);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lazily build/refresh building rect cache
  function getBuildingRects(): Map<string, SvgRect> {
    if (buildingRectsRef.current) return buildingRectsRef.current;
    const map = new Map<string, SvgRect>();
    const svgEl = bgRef.current?.svgElement;
    if (!svgEl) return map;
    svgEl.querySelectorAll('.bldg-poly').forEach((el) => {
      if (el.id) {
        const bbox = (el as SVGGraphicsElement).getBBox();
        map.set(el.id, { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height });
      }
    });
    buildingRectsRef.current = map;
    return map;
  }

  // State machine for each path
  useEffect(() => {
    if (pathLengths.every((l) => l === 0)) return;

    const timeoutHandles: ReturnType<typeof setTimeout>[] = [];
    const rafHandles: number[] = [0, 0, 0];

    function startRAFLoop(pathIndex: number, startTime: number): void {
      const pathLength = pathLengths[pathIndex];
      const pathEl = pathRefs[pathIndex].current;
      if (!pathEl || pathLength === 0) return;

      function tick(now: number): void {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / DRAW_DURATION, 1);
        const drawnLength = progress * pathLength;

        // Progressive illumination: sample newly-drawn segment
        const lastSampled = lastSampledRef.current[pathIndex];
        if (drawnLength > lastSampled + SAMPLE_STEP) {
          const rects = getBuildingRects();
          const newPoints: SvgPoint[] = [];
          for (let l = lastSampled + SAMPLE_STEP; l <= drawnLength; l += SAMPLE_STEP) {
            const pt = pathEl.getPointAtLength(l);
            newPoints.push({ x: pt.x, y: pt.y });
          }
          lastSampledRef.current[pathIndex] =
            Math.floor(drawnLength / SAMPLE_STEP) * SAMPLE_STEP;

          if (newPoints.length > 0 && bgRef.current) {
            const nearIds = findBuildingsNearPoints(newPoints, rects, POP_THRESHOLD);
            const alreadyLit = litBuildingIdsRef.current[pathIndex];
            const freshIds = nearIds.filter((id) => !alreadyLit.has(id));
            if (freshIds.length > 0) {
              freshIds.forEach((id) => alreadyLit.add(id));
              bgRef.current.addLitBuildings(freshIds, pathIndex);
            }
          }
        }

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
      const idleHandle = setTimeout(() => {
        const pathLength = pathLengths[pathIndex];

        // Reset tracking for this path
        lastSampledRef.current[pathIndex] = 0;
        litBuildingIdsRef.current[pathIndex].clear();
        // Refresh building rect cache on each new cycle
        buildingRectsRef.current = null;

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

        const drawStartHandle = setTimeout(() => {
          setPhases((prev) => {
            const next = [...prev] as PathPhase[];
            next[pathIndex] = 'drawing';
            return next;
          });
          setDashOffsets((prev) => {
            const next = [...prev];
            next[pathIndex] = 0;
            return next;
          });

          startRAFLoop(pathIndex, performance.now());

          const holdHandle = setTimeout(() => {
            stopRAFLoop(pathIndex);
            setPhases((prev) => {
              const next = [...prev] as PathPhase[];
              next[pathIndex] = 'holding';
              return next;
            });

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

              // Clear this path's building illumination
              bgRef.current?.clearLit(pathIndex);

              const idleStartHandle = setTimeout(() => {
                setPhases((prev) => {
                  const next = [...prev] as PathPhase[];
                  next[pathIndex] = 'idle';
                  return next;
                });
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

                const idleWait = IDLE_MIN + Math.random() * (IDLE_MAX - IDLE_MIN);
                runCycle(pathIndex, idleWait);
              }, FADE_DURATION);
              timeoutHandles.push(idleStartHandle);
            }, HOLD_DURATION);
            timeoutHandles.push(fadeHandle);
          }, DRAW_DURATION);
          timeoutHandles.push(holdHandle);
        }, 20);
        timeoutHandles.push(drawStartHandle);
      }, initialDelay);
      timeoutHandles.push(idleHandle);
    }

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

  function getTransitionStyle(pathIndex: number): string {
    const phase = phases[pathIndex];
    if (phase === 'drawing') return `stroke-dashoffset ${DRAW_DURATION}ms linear`;
    if (phase === 'fading') return `opacity ${FADE_DURATION}ms ease-in`;
    return 'none';
  }

  return (
    <svg
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      preserveAspectRatio="xMidYMid slice"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 2,
      }}
    >
      {PATHS.slice(0, PATH_COUNT).map((d, i) => (
        <path
          key={i}
          ref={pathRefs[i]}
          d={d}
          fill="none"
          stroke="var(--forum-traj-stroke)"
          strokeWidth={1.4}
          strokeLinecap="round"
          style={{
            strokeDasharray: pathLengths[i] || 0,
            strokeDashoffset: dashOffsets[i],
            opacity: opacities[i],
            transition: getTransitionStyle(i),
          }}
        />
      ))}
    </svg>
  );
};

export default BuildingTrajectories;
