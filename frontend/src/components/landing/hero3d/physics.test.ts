import { describe, it, expect } from 'vitest';
import { createDescent, stepDescent, RESTITUTION } from './physics';

const GROUND = 0;

describe('descent physics', () => {
  it('falls: velocity goes negative and height drops', () => {
    const s0 = createDescent(20);
    const s1 = stepDescent(s0, 0.1, GROUND);
    expect(s1.vy).toBeLessThan(0);
    expect(s1.y).toBeLessThan(s0.y);
    expect(s1.done).toBe(false);
  });

  it('bounces on ground contact with reduced speed', () => {
    const falling = { y: 0.1, vy: -20, bounces: 0, done: false };
    const s = stepDescent(falling, 0.05, GROUND);
    expect(s.y).toBe(GROUND);
    expect(s.vy).toBeGreaterThan(0);          // moving up again
    expect(s.vy).toBeLessThan(20 * RESTITUTION * 1.1); // energy lost
    expect(s.bounces).toBe(1);
  });

  it('settles instead of bouncing when impact is slow', () => {
    const slow = { y: 0.01, vy: -1, bounces: 2, done: false };
    const s = stepDescent(slow, 0.05, GROUND);
    expect(s.done).toBe(true);
    expect(s.y).toBe(GROUND);
    expect(s.vy).toBe(0);
  });

  it('a full drop from height comes to rest within 10 simulated seconds', () => {
    let s = createDescent(20);
    let t = 0;
    while (!s.done && t < 10) {
      s = stepDescent(s, 1 / 60, GROUND);
      t += 1 / 60;
    }
    expect(s.done).toBe(true);
    expect(s.y).toBe(GROUND);
    expect(s.bounces).toBeGreaterThanOrEqual(1);
  });

  it('is inert after done', () => {
    const rest = { y: GROUND, vy: 0, bounces: 3, done: true };
    expect(stepDescent(rest, 0.5, GROUND)).toEqual(rest);
  });
});
