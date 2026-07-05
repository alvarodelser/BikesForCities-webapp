export const MOMENTUM_THRESHOLD = 0.1; // px/ms minimum to trigger momentum

export const MOMENTUM_DECAY = 0.92; // velocity multiplier per animation frame

// Convert raw touch velocity (px/ms) to scroll-offset units.
// Negated because dragging right (positive deltaX) should decrease the offset.
export function initialMomentumVelocity(touchVelocity: number): number {
  return -touchVelocity / 250;
}
