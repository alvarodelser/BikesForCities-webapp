// Gravity descent with decaying bounces for the hero bike intro.
// Units: world units and seconds (Three.js scene scale).

export interface DescentState {
  y: number;
  vy: number;
  bounces: number;
  done: boolean;
}

export const GRAVITY = -60;      // world units / s²
export const RESTITUTION = 0.38; // fraction of speed kept per bounce
export const REST_SPEED = 2.0;   // impacts slower than this settle

export function createDescent(startY: number): DescentState {
  return { y: startY, vy: 0, bounces: 0, done: false };
}

export function stepDescent(
  s: DescentState,
  dt: number,
  groundY: number,
): DescentState {
  if (s.done) return s;
  const vyFall = s.vy + GRAVITY * dt;
  const yNext = s.y + vyFall * dt;
  if (yNext > groundY) {
    return { y: yNext, vy: vyFall, bounces: s.bounces, done: false };
  }

  // Contact happens during this step; compute exact contact time and velocity
  // y(t) = s.y + s.vy * t + 0.5 * GRAVITY * t^2 = groundY
  const a = 0.5 * GRAVITY;
  const b = s.vy;
  const c = s.y - groundY;
  const discriminant = b * b - 4 * a * c;
  const t = (-b - Math.sqrt(discriminant)) / (2 * a);
  const vyContact = s.vy + GRAVITY * t;

  if (Math.abs(vyContact) < REST_SPEED) {
    return { y: groundY, vy: 0, bounces: s.bounces, done: true };
  }
  return {
    y: groundY,
    vy: -vyContact * RESTITUTION,
    bounces: s.bounces + 1,
    done: false,
  };
}
