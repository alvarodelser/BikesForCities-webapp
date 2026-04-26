import { useRef, useEffect } from 'react';

// ─── Animation constants ───────────────────────────────────────────────────────
const GRAVITY = 200;   // canvas-px / s² — scaled for visible swing
const ARM2_LEN = 30;    // bicycle pendulum arm length (canvas px)
const DAMPING = 0.99;
const SUBSTEPS = 20;
const WHEEL_SPEED = 3.2;   // constant wheel spin (rad/s), independent of physics

// Parachute driven oscillation
const PARA_AMP = Math.PI / 6;  // 30° peak
const PARA_SPEED = 2.4;           // rad/s — full swing ≈ 2.6 s

// ─── SVG → canvas geometry ────────────────────────────────────────────────────
const VBW = 210, VBH = 297;
const LOGO_H = 70;
const LOGO_W = LOGO_H * (VBW / VBH);
const SX = LOGO_W / VBW;   // ≈ 0.235 (uniform with SY)
const SY = LOGO_H / VBH;


const APEX_VB = { x: 102, y: 15 };
const ATTACH_VB = { x: 102, y: 136 };

// Apex → attachment vector in canvas pixels (straight down at rest)
const ATT_PX = {
  x: (ATTACH_VB.x - APEX_VB.x) * SX,  // ≈ 0
  y: (ATTACH_VB.y - APEX_VB.y) * SY,  // ≈ 89.7   (= R, parachute arm radius)
};

// ─── Wheel geometry (viewBox units; applied after ctx.scale) ─────────────────
const WHEEL_R = 31.599552;
const W_CIRC = 2 * Math.PI * WHEEL_R;  // ≈ 198.6
const W_DASH = 0.4 * W_CIRC;            // large dash
const W_GAP = 0.1 * W_CIRC;            // small gap → 2 dashes + 2 gaps tile exactly
const WHEEL_REAR = { cx: 51.57188, cy: 239.64207 };
const WHEEL_FRONT = { cx: 156.01056, cy: 186.93922 };

// ─── Driven parachute angle + analytic derivatives ────────────────────────────
// a1(t) = −A·sin(ω·t)  → starts at 0, first moves left, eases at ±45°
const getA1 = (t: number) => -PARA_AMP * Math.sin(PARA_SPEED * t);
const getDA1 = (t: number) => -PARA_AMP * PARA_SPEED * Math.cos(PARA_SPEED * t);
const getD2A1 = (t: number) => PARA_AMP * PARA_SPEED * PARA_SPEED * Math.sin(PARA_SPEED * t);

// ─── Bicycle pendulum with MOVING PIVOT ───────────────────────────────────────
//
// For a pendulum hanging from an accelerating pivot (y-axis pointing DOWN):
//   L·α₂ = −g·sin(a2) − ẍ_pivot·cos(a2) + ÿ_pivot·sin(a2)
//
// Our pivot (attachment point):
//   px = apx − R·sin(a1)  →  ẍ = −R·(ä1·cos(a1) − ȧ1²·sin(a1))
//   py = apy + R·cos(a1)  →  ÿ =  R·(−ä1·sin(a1) − ȧ1²·cos(a1))
//
// Substituting and simplifying:
//   L·α₂ = −g·sin(a2) + R·ä1·cos(a1+a2) − R·ȧ1²·sin(a1+a2)
//
function stepBike(
  a2: number, v2: number,
  a1: number, da1: number, d2a1: number,
  dt: number,
): [number, number] {
  const R = ATT_PX.y;
  const L = ARM2_LEN;
  const sub = dt / SUBSTEPS;

  for (let i = 0; i < SUBSTEPS; i++) {
    const alpha =
      -(GRAVITY / L) * Math.sin(a2)
      + (R / L) * d2a1 * Math.cos(a1 + a2)
      - (R / L) * da1 * da1 * Math.sin(a1 + a2);

    v2 = (v2 + alpha * sub) * DAMPING;
    a2 += v2 * sub;
  }
  return [a2, v2];
}

// ─── SVG path stroke shorthand ────────────────────────────────────────────────
function sp(ctx: CanvasRenderingContext2D, d: string) {
  ctx.stroke(new Path2D(d));
}

// ─── Parachute renderer ───────────────────────────────────────────────────────
function drawParachute(
  ctx: CanvasRenderingContext2D,
  apx: number, apy: number,
  a1: number,
  c: string,
) {
  ctx.save();
  ctx.translate(apx, apy);
  ctx.rotate(a1);
  ctx.translate(-APEX_VB.x * SX, -APEX_VB.y * SY);
  ctx.scale(SX, SY);
  ctx.strokeStyle = c;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.lineWidth = 10.2759;
  sp(ctx, 'm 39.181097,59.74112 c 0,0 7.029138,-43.88701 62.661403,-44.607939');
  sp(ctx, 'm 164.56397,59.74112 c 0,0 -7.02912,-43.88701 -62.66139,-44.607939');
  sp(ctx, 'm 40.191901,59.994455 c 0,0 18.09574,9.19745 34.051648,0.252468');
  sp(ctx, 'm 164.05066,59.975718 c 0,0 -18.09574,9.197451 -34.05165,0.252468');
  sp(ctx, 'm 74.243549,60.246923 c 0,0 10.451862,7.913889 28.850221,7.446337');
  sp(ctx, 'm 129.99901,60.228186 c 0,0 -9.89623,7.952301 -28.29457,7.484755');

  ctx.lineWidth = 6.42242;
  sp(ctx, 'M 40.191901,59.994455 101.34225,137.33773 74.243549,60.246923');
  sp(ctx, 'M 129.99901,60.228186 102.79279,135.88719');
  sp(ctx, 'm 164.56397,59.74112 -61.5942,77.35629');
  sp(ctx, 'm 74.243549,60.246923 c 0,0 1.422686,-31.062096 27.340451,-45.237861');
  sp(ctx, 'm 129.99901,60.228186 c 0,0 -1.67437,-32.886906 -27.83793,-45.219124');

  ctx.restore();
}

// ─── Bicycle renderer ─────────────────────────────────────────────────────────
function drawBicycle(
  ctx: CanvasRenderingContext2D,
  attX: number, attY: number,
  a2: number,
  wa: number,
  c: string,
) {
  ctx.save();
  ctx.translate(attX, attY);
  ctx.rotate(a2);
  ctx.translate(-ATTACH_VB.x * SX, -ATTACH_VB.y * SY);
  ctx.scale(SX, SY);
  ctx.strokeStyle = c;
  ctx.fillStyle = c;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Frame
  ctx.lineWidth = 10.2759;
  sp(ctx, 'm 50.846601,236.49926 13.054839,-53.18638 50.28529,-26.10967 14.02187,14.98889 c 0,0 12.57132,13.05484 27.56021,12.57132');
  sp(ctx, 'm 57.615774,177.02723 43.999646,44.48314 16.92292,-61.40608');
  sp(ctx, 'M 50.363097,237.46628 101.1319,221.99388');
  sp(ctx, 'm 104.03298,146.80769 11.6043,11.84606');
  sp(ctx, 'm 83.725453,143.66485 15.472397,-7.49444 c 0,0 9.42849,-0.96702 5.80215,12.32959');

  // Saddle (filled, strokeless)
  ctx.lineWidth = 0;
  ctx.fill(new Path2D(
    'm 54.19147,180.87018 c -2.010069,-1.91387 -6.180102,-0.55439 -7.793595,-0.15447 ' +
    '0,0 -10.706602,-0.38971 -5.502575,-6.06523 14.806373,-16.14787 28.224485,-14.54298 ' +
    '24.4,-10.49742 -5.722553,6.05332 -3.886711,9.40213 -3.886711,9.40213 z',
  ));

  // Wheels: 2 dashes + 2 small gaps — constant spin via wa
  ctx.lineWidth = 10.2759;
  ctx.setLineDash([W_DASH, W_GAP]);

  for (const w of [WHEEL_REAR, WHEEL_FRONT]) {
    ctx.save();
    ctx.translate(w.cx, w.cy);
    ctx.rotate(wa);
    ctx.beginPath();
    ctx.arc(0, 0, WHEEL_R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  ctx.setLineDash([]);
  ctx.restore();
}

interface SpinnerSVGProps {
  /** Any CSS color string */
  color?: string;
  className?: string;
}

/**
 * SpinnerSVG component: A high-engagement, physics-driven animation 
 * of a bicycle hanging from a parachute.
 */
export default function SpinnerSVG({
  color = '#FBF6EF', // Default to var(--cream)
  className = '',
}: SpinnerSVGProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const a2Ref = useRef(0);      // bicycle pendulum angle
  const v2Ref = useRef(-0.2);   // initial leftward velocity
  const waRef = useRef(0);      // wheel spin accumulator
  const tRef = useRef(0);      // elapsed time (drives a1 sine)
  const lastTs = useRef<number | null>(null);
  const rafRef = useRef<number>(0);

  // ── Animation loop ─────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    function loop(ts: number) {
      const dt = lastTs.current
        ? Math.min((ts - lastTs.current) / 1000, 0.033)
        : 0.016;
      lastTs.current = ts;

      tRef.current += dt;
      const t = tRef.current;

      // Driven parachute angle and its derivatives
      const a1 = getA1(t);
      const da1 = getDA1(t);
      const d2a1 = getD2A1(t);

      // Bicycle responds to moving attachment point
      const [na2, nv2] = stepBike(a2Ref.current, v2Ref.current, a1, da1, d2a1, dt);
      a2Ref.current = na2;
      v2Ref.current = nv2;

      // Wheels spin at fixed rate regardless of physics
      waRef.current += WHEEL_SPEED * dt;

      const W = canvas?.width || 0;
      const H = canvas?.height || 0;
      if (W === 0 || H === 0) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      const apx = W / 2;
      const apy = H * 0.08;

      // Attachment = apex rotated by a1
      const attX = apx + ATT_PX.x * Math.cos(a1) - ATT_PX.y * Math.sin(a1);
      const attY = apy + ATT_PX.x * Math.sin(a1) + ATT_PX.y * Math.cos(a1);

      ctx.clearRect(0, 0, W, H);

      // Ceiling anchor dot
      ctx.beginPath();
      ctx.arc(apx, apy, 2, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      drawParachute(ctx, apx, apy, a1, color);
      drawBicycle(ctx, attX, attY, na2, waRef.current, color);

      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [color]);

  // ── Resize observer ────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => {
      if (canvas.offsetWidth && canvas.offsetHeight) {
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
      }
    });
    ro.observe(canvas);
    if (canvas.offsetWidth && canvas.offsetHeight) {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    }
    return () => ro.disconnect();
  }, []);

  return (
    <div className={`relative w-full h-full ${className}`}>
      <canvas
        ref={canvasRef}
        className="block w-full h-full"
      />
    </div>
  );
}