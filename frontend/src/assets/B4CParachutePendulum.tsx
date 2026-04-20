import React, { useRef, useEffect, useCallback, useState } from 'react';

// ─── Pendulum physics constants ───────────────────────────────────────────────
const GRAVITY = 9;
const ARM1_LENGTH = 110;   // pivot → parachute center
const ARM2_LENGTH = 80;    // attachment → bicycle center
const MAX_BIKE_REL_ANGLE = Math.PI / 2; // bicycle clamped to ±90° from parachute arm
const DAMPING = 0.9995;
const SUBSTEPS = 10;
const TRAIL_MAX = 200;

// ─── SVG viewBox of the original B4C logo ─────────────────────────────────────
const LOGO_VIEWBOX_W = 210;
const LOGO_VIEWBOX_H = 297;

// ─── Parachute geometry (paths/arcs in top region of the SVG) ─────────────────
// The parachute canopy occupies roughly y=0–80 in the 210×297 viewBox.
// We use the existing rim arcs and radial lines as-is, rendered via an inline
// <svg> that is CSS-transformed to rotate around the logo's own centre.
//
// Canopy elements (from the TSX):
//   • Two large rim arcs  (strokeWidth 10.2759) tracing the dome
//   • Four smaller arcs   (strokeWidth 10.2759) forming canopy gores
//   • Three thin diagonal lines (strokeWidth 6.42242) = suspension lines / rigging
//
// Bicycle elements:
//   • Two <circle>        = wheels (cx/cy given in viewBox coords)
//   • Five <path> strokes = frame, chain-stay, seat-stay, down-tube, top-tube
//   • One <path> fill     = saddle

// ─── Wheel spin: both wheels share the same angle driven by v2 ────────────────
// Rotation origin for each wheel is its cx/cy in viewBox space.
// We animate via a CSS custom property injected on the <svg> element.

// ─── Bicycle wheel centres (in 210×297 viewBox space) ────────────────────────
const WHEEL_REAR  = { cx: 51.57188,  cy: 239.64207, r: 31.599552 };
const WHEEL_FRONT = { cx: 156.01056, cy: 186.93922, r: 31.599552 };

// ─── Parachute pivot in viewBox space (geometric centre of the canopy) ────────
// The canopy spans x ≈ 39–165, y ≈ 15–70 → centre ≈ (102, 42)
const PARA_PIVOT_VB = { x: 102, y: 42 };

// ─── Bicycle attachment in viewBox space ─────────────────────────────────────
// The parachute's suspension lines converge at the top of the frame,
// which in the SVG is around (102, 136) — the handlebar junction.
const ATTACH_VB = { x: 102, y: 136 };

// ─── Canvas scale: we render the logo at this pixel size ─────────────────────
const LOGO_SCALE = 0.55; // logo pixel height relative to ARM1_LENGTH

// ─── Types ────────────────────────────────────────────────────────────────────
interface PendulumState {
  a1: number; v1: number;  // parachute angle & angular velocity
  a2: number; v2: number;  // bicycle angle & angular velocity
}

interface TrailPoint { x: number; y: number; }

// ─── Physics step ─────────────────────────────────────────────────────────────
function physicsStep(
  s: PendulumState,
  dt: number,
  g: number,
  L1: number,
  L2: number
): PendulumState {
  let { a1, v1, a2, v2 } = s;
  const sdt = dt / SUBSTEPS;

  for (let i = 0; i < SUBSTEPS; i++) {
    const av1 = -(g / L1) * Math.sin(a1);
    const av2 = -(g / L2) * Math.sin(a2);
    v1 = (v1 + av1 * sdt) * DAMPING;
    v2 = (v2 + av2 * sdt) * DAMPING;
    a1 += v1 * sdt;
    a2 += v2 * sdt;
    // Clamp bicycle relative angle to ±90°
    const rel = a2 - a1;
    if (rel > MAX_BIKE_REL_ANGLE)  { a2 = a1 + MAX_BIKE_REL_ANGLE;  if (v2 > v1) v2 = v1 * 0.5; }
    if (rel < -MAX_BIKE_REL_ANGLE) { a2 = a1 - MAX_BIKE_REL_ANGLE;  if (v2 < v1) v2 = v1 * 0.5; }
  }
  return { a1, v1, a2, v2 };
}

// ─── Component ────────────────────────────────────────────────────────────────
interface B4CParachutePendulumProps {
  /** Override initial parachute angle in radians (default 0.55) */
  initialA1?: number;
  /** Override initial bicycle angle in radians (default 0.4) */
  initialA2?: number;
  /** Canvas CSS width (default '100%') */
  width?: string | number;
  /** Canvas CSS height (default 500) */
  height?: number;
  /** Stroke / fill colour for the logo (default 'currentColor') */
  color?: string;
  /** Trail colour (default derived from color) */
  trailColor?: string;
  className?: string;
}

const B4CParachutePendulum: React.FC<B4CParachutePendulumProps> = ({
  initialA1 = 0.55,
  initialA2 = 0.4,
  width = '100%',
  height = 500,
  color = 'currentColor',
  trailColor,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef  = useRef<PendulumState>({ a1: initialA1, v1: 0.3, a2: initialA2, v2: -0.2 });
  const wheelAngleRef = useRef(0);
  const trailRef  = useRef<TrailPoint[]>([]);
  const lastTsRef = useRef<number | null>(null);
  const rafRef    = useRef<number>(0);
  const pausedRef = useRef(false);
  const [paused, setPaused] = useState(false);

  const resolvedTrail = trailColor ?? (color === 'currentColor' ? 'rgba(120,60,200,0.3)' : color);

  // ── Draw one frame ──────────────────────────────────────────────────────────
  const drawFrame = useCallback((
    ctx: CanvasRenderingContext2D,
    W: number,
    H: number,
    s: PendulumState,
    wheelAngle: number,
    trail: TrailPoint[],
    g: number,
    L1: number,
    L2: number,
  ) => {
    ctx.clearRect(0, 0, W, H);

    // ── World-space pivot (fixed ceiling point) ─────────────────────────────
    const pivot = { x: W / 2, y: H * 0.15 };

    // ── Parachute centre (arm1 endpoint) ───────────────────────────────────
    const paraCx = pivot.x + L1 * Math.sin(s.a1);
    const paraCy = pivot.y + L1 * Math.cos(s.a1);

    // ── Logo pixel dimensions ───────────────────────────────────────────────
    const logoH = L1 * LOGO_SCALE * 2;
    const logoW = logoH * (LOGO_VIEWBOX_W / LOGO_VIEWBOX_H);
    const scaleX = logoW / LOGO_VIEWBOX_W;  // viewBox → canvas pixels
    const scaleY = logoH / LOGO_VIEWBOX_H;

    // ── Attachment point in canvas space ────────────────────────────────────
    // ATTACH_VB is (102, 136) in viewBox; the logo is rotated around PARA_PIVOT_VB (102, 42).
    // Offset of attachment from pivot in viewBox units:
    const dvx = ATTACH_VB.x - PARA_PIVOT_VB.x;  // 0
    const dvy = ATTACH_VB.y - PARA_PIVOT_VB.y;  // 94
    // Rotate by a1 then scale:
    const attachX = paraCx + (dvx * Math.cos(s.a1) - dvy * Math.sin(s.a1)) * scaleX;
    // For pendulum: arm swings in the vertical plane — rotate offset by a1
    // Using standard 2-D rotation: (dx,dy) rotated by angle around y-down axis
    // Here the pendulum angle a1 is measured from vertical (y-down).
    // Attachment world pos = paraCentre + R(a1) * localOffset (scaled)
    const attachY = paraCy + (dvx * Math.sin(s.a1) + dvy * Math.cos(s.a1)) * scaleY;

    // ── Bicycle centre (arm2 endpoint) ─────────────────────────────────────
    const bikeCx = attachX + L2 * Math.sin(s.a2);
    const bikeCy = attachY + L2 * Math.cos(s.a2);

    // ── Trail ───────────────────────────────────────────────────────────────
    for (let i = 1; i < trail.length; i++) {
      const t = i / trail.length;
      ctx.beginPath();
      ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
      ctx.lineTo(trail[i].x, trail[i].y);
      ctx.strokeStyle = resolvedTrail.startsWith('rgba')
        ? resolvedTrail.replace(/[\d.]+\)$/, `${(t * 0.45).toFixed(2)})`)
        : `rgba(120,60,200,${(t * 0.4).toFixed(2)})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // ── Arm 1: pivot → parachute centre ────────────────────────────────────
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(150,150,150,0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(pivot.x, pivot.y);
    ctx.lineTo(paraCx, paraCy);
    ctx.stroke();
    ctx.setLineDash([]);

    // ── Pivot dot ───────────────────────────────────────────────────────────
    ctx.beginPath();
    ctx.arc(pivot.x, pivot.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = color === 'currentColor' ? '#555' : color;
    ctx.fill();

    // ── Arm 2: attachment → bicycle centre ─────────────────────────────────
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = 'rgba(150,150,150,0.35)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(attachX, attachY);
    ctx.lineTo(bikeCx, bikeCy);
    ctx.stroke();
    ctx.setLineDash([]);

    // ── Draw logo: parachute half rotated around paraCentre ─────────────────
    drawParachuteSVG(ctx, paraCx, paraCy, logoW, logoH, s.a1, color);

    // ── Draw logo: bicycle half rotated around attachPoint ──────────────────
    drawBicycleSVG(ctx, paraCx, paraCy, logoW, logoH, s.a1, s.a2, attachX, attachY, wheelAngle, color, scaleX, scaleY);
  }, [color, resolvedTrail]);

  // ── Parachute renderer (top portion of B4C SVG) ────────────────────────────
  // Draws only the canopy paths, rotated around the logo's own PARA_PIVOT_VB centre.
  function drawParachuteSVG(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number,
    logoW: number, logoH: number,
    angle: number,
    strokeColor: string,
  ) {
    const sx = logoW / LOGO_VIEWBOX_W;
    const sy = logoH / LOGO_VIEWBOX_H;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    // Centre the viewBox so PARA_PIVOT_VB maps to (0,0)
    ctx.translate(-PARA_PIVOT_VB.x * sx, -PARA_PIVOT_VB.y * sy);
    ctx.scale(sx, sy);

    ctx.strokeStyle = strokeColor === 'currentColor' ? '#000' : strokeColor;
    ctx.fillStyle   = strokeColor === 'currentColor' ? '#000' : strokeColor;
    ctx.lineCap  = 'round';
    ctx.lineJoin = 'round';

    // ── Rim arc left (large canopy arc) ──────────────────────────────────
    ctx.lineWidth = 10.2759;
    drawSVGPath(ctx, 'm 39.181097,59.74112 c 0,0 7.029138,-43.88701 62.661403,-44.607939');
    // ── Rim arc right ─────────────────────────────────────────────────────
    drawSVGPath(ctx, 'm 164.56397,59.74112 c 0,0 -7.02912,-43.88701 -62.66139,-44.607939');
    // ── Gore arc: left outer ──────────────────────────────────────────────
    drawSVGPath(ctx, 'm 40.191901,59.994455 c 0,0 18.09574,9.19745 34.051648,0.252468');
    // ── Gore arc: right outer ─────────────────────────────────────────────
    drawSVGPath(ctx, 'm 164.05066,59.975718 c 0,0 -18.09574,9.197451 -34.05165,0.252468');
    // ── Gore arc: left inner ──────────────────────────────────────────────
    drawSVGPath(ctx, 'm 74.243549,60.246923 c 0,0 10.451862,7.913889 28.850221,7.446337');
    // ── Gore arc: right inner ─────────────────────────────────────────────
    drawSVGPath(ctx, 'm 129.99901,60.228186 c 0,0 -9.89623,7.952301 -28.29457,7.484755');

    // ── Suspension line: left ─────────────────────────────────────────────
    ctx.lineWidth = 6.42242;
    drawSVGPath(ctx, 'M 40.191901,59.994455 101.34225,137.33773 74.243549,60.246923');
    // ── Suspension line: right ────────────────────────────────────────────
    drawSVGPath(ctx, 'M 129.99901,60.228186 102.79279,135.88719');
    // ── Suspension line: far right ────────────────────────────────────────
    drawSVGPath(ctx, 'm 164.56397,59.74112 -61.5942,77.35629');

    // ── Canopy left risers ────────────────────────────────────────────────
    drawSVGPath(ctx, 'm 74.243549,60.246923 c 0,0 1.422686,-31.062096 27.340451,-45.237861');
    drawSVGPath(ctx, 'm 129.99901,60.228186 c 0,0 -1.67437,-32.886906 -27.83793,-45.219124');

    ctx.restore();
  }

  // ── Bicycle renderer (bottom portion of B4C SVG) ───────────────────────────
  // Drawn relative to the attachment point; the whole bicycle group rotates by a2.
  function drawBicycleSVG(
    ctx: CanvasRenderingContext2D,
    paraCx: number, paraCy: number,
    logoW: number, logoH: number,
    paraAngle: number,
    bikeAngle: number,
    attachX: number, attachY: number,
    wheelAngle: number,
    strokeColor: string,
    sx: number, sy: number,
  ) {
    const sc = strokeColor === 'currentColor' ? '#000' : strokeColor;

    ctx.save();
    // Pivot around attachment point
    ctx.translate(attachX, attachY);
    ctx.rotate(bikeAngle);
    // Re-express: we need logo origin such that ATTACH_VB maps to (0,0) after scaling
    ctx.translate(-ATTACH_VB.x * sx, -ATTACH_VB.y * sy);
    ctx.scale(sx, sy);

    ctx.strokeStyle = sc;
    ctx.fillStyle   = sc;
    ctx.lineCap  = 'round';
    ctx.lineJoin = 'round';

    // ── Frame paths ───────────────────────────────────────────────────────
    ctx.lineWidth = 10.2759;
    // Chain stay + seat stay + top tube composite
    drawSVGPath(ctx, 'm 50.846601,236.49926 13.054839,-53.18638 50.28529,-26.10967 14.02187,14.98889 c 0,0 12.57132,13.05484 27.56021,12.57132');
    // Down tube + seat tube
    drawSVGPath(ctx, 'm 57.615774,177.02723 43.999646,44.48314 16.92292,-61.40608');
    // Bottom bracket connector
    drawSVGPath(ctx, 'M 50.363097,237.46628 101.1319,221.99388');
    // Seat post top stub
    drawSVGPath(ctx, 'm 104.03298,146.80769 11.6043,11.84606');
    // Saddle
    drawSVGPath(ctx, 'm 83.725453,143.66485 15.472397,-7.49444 c 0,0 9.42849,-0.96702 5.80215,12.32959');

    // ── Filled saddle shape ───────────────────────────────────────────────
    ctx.lineWidth = 0;
    const saddlePath = new Path2D('m 54.19147,180.87018 c -2.010069,-1.91387 -6.180102,-0.55439 -7.793595,-0.15447 0,0 -10.706602,-0.38971 -5.502575,-6.06523 14.806373,-16.14787 28.224485,-14.54298 24.4,-10.49742 -5.722553,6.05332 -3.886711,9.40213 -3.886711,9.40213 z');
    ctx.fill(saddlePath);

    // ── Wheels with spin rotation ─────────────────────────────────────────
    for (const w of [WHEEL_REAR, WHEEL_FRONT]) {
      ctx.save();
      ctx.translate(w.cx, w.cy);
      ctx.rotate(wheelAngle);

      // Tyre
      ctx.lineWidth = w.r * 0.33;
      ctx.strokeStyle = sc;
      ctx.beginPath();
      ctx.arc(0, 0, w.r, 0, Math.PI * 2);
      ctx.stroke();

      // Dashed inner rim (gives the "dashed circle" wheel look from the original)
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.strokeStyle = sc;
      ctx.beginPath();
      ctx.arc(0, 0, w.r * 0.7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Spokes
      ctx.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        const a = (Math.PI * 2 / 8) * i;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * w.r * 0.7, Math.sin(a) * w.r * 0.7);
        ctx.stroke();
      }

      // Hub dot
      ctx.beginPath();
      ctx.arc(0, 0, w.r * 0.1, 0, Math.PI * 2);
      ctx.fillStyle = sc;
      ctx.fill();

      ctx.restore();
    }

    ctx.restore();
  }

  // ── SVG path mini-parser (handles M, m, L, l, C, c, Z, z) ─────────────────
  function drawSVGPath(ctx: CanvasRenderingContext2D, d: string) {
    const path = new Path2D(d);
    ctx.stroke(path);
  }

  // ── Animation loop ──────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    function loop(ts: number) {
      const dt = lastTsRef.current ? Math.min((ts - lastTsRef.current) / 1000, 0.03) : 0.016;
      lastTsRef.current = ts;

      if (!pausedRef.current) {
        stateRef.current = physicsStep(stateRef.current, dt, GRAVITY, ARM1_LENGTH, ARM2_LENGTH);
        wheelAngleRef.current += stateRef.current.v2 * 2;

        const p = getWorldPositions(stateRef.current, canvas.width, canvas.height);
        trailRef.current.push({ x: p.bikeCx, y: p.bikeCy });
        if (trailRef.current.length > TRAIL_MAX) trailRef.current.shift();
      }

      drawFrame(ctx, canvas.width, canvas.height, stateRef.current, wheelAngleRef.current, trailRef.current, GRAVITY, ARM1_LENGTH, ARM2_LENGTH);
      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [drawFrame]);

  // ── Resize observer ────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      trailRef.current = [];
    });
    ro.observe(canvas);
    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    return () => ro.disconnect();
  }, []);

  // ── Helpers ────────────────────────────────────────────────────────────────
  function getWorldPositions(s: PendulumState, W: number, H: number) {
    const pivot = { x: W / 2, y: H * 0.15 };
    const logoH = ARM1_LENGTH * LOGO_SCALE * 2;
    const logoW = logoH * (LOGO_VIEWBOX_W / LOGO_VIEWBOX_H);
    const sx = logoW / LOGO_VIEWBOX_W;
    const sy = logoH / LOGO_VIEWBOX_H;
    const paraCx = pivot.x + ARM1_LENGTH * Math.sin(s.a1);
    const paraCy = pivot.y + ARM1_LENGTH * Math.cos(s.a1);
    const dvx = ATTACH_VB.x - PARA_PIVOT_VB.x;
    const dvy = ATTACH_VB.y - PARA_PIVOT_VB.y;
    const attachX = paraCx + (dvx * Math.cos(s.a1) - dvy * Math.sin(s.a1)) * sx;
    const attachY = paraCy + (dvx * Math.sin(s.a1) + dvy * Math.cos(s.a1)) * sy;
    const bikeCx = attachX + ARM2_LENGTH * Math.sin(s.a2);
    const bikeCy = attachY + ARM2_LENGTH * Math.cos(s.a2);
    return { paraCx, paraCy, attachX, attachY, bikeCx, bikeCy };
  }

  function handleReset() {
    stateRef.current = {
      a1: (Math.random() - 0.5) * 1.2,
      v1: (Math.random() - 0.5) * 0.8,
      a2: (Math.random() - 0.5) * 0.8,
      v2: (Math.random() - 0.5) * 0.5,
    };
    trailRef.current = [];
  }

  function handlePause() {
    pausedRef.current = !pausedRef.current;
    setPaused(p => !p);
    if (pausedRef.current) lastTsRef.current = null;
  }

  return (
    <div className={`relative flex flex-col ${className}`} style={{ width }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height }}
        className="block"
      />
      <div className="flex gap-3 px-3 py-2 text-sm border-t border-gray-200 text-gray-500">
        <button
          onClick={handleReset}
          className="px-3 py-1 rounded border border-gray-300 hover:bg-gray-100 text-xs"
        >
          New angle
        </button>
        <button
          onClick={handlePause}
          className="px-3 py-1 rounded border border-gray-300 hover:bg-gray-100 text-xs"
        >
          {paused ? 'Resume' : 'Pause'}
        </button>
      </div>
    </div>
  );
};

export default B4CParachutePendulum;

/**
 * Usage example:
 *
 *   import B4CParachutePendulum from './B4CParachutePendulum';
 *
 *   // Default – black strokes, current-color aware
 *   <B4CParachutePendulum height={500} />
 *
 *   // Coloured version
 *   <B4CParachutePendulum color="#7c4dff" trailColor="rgba(124,77,255,0.3)" height={400} />
 *
 *   // Custom initial chaos
 *   <B4CParachutePendulum initialA1={0.9} initialA2={-0.3} />
 */
