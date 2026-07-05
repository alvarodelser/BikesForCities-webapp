import { describe, it, expect } from 'vitest';
import { initialMomentumVelocity, MOMENTUM_DECAY } from './momentum';

// Total cards travelled by a decaying momentum loop that starts at `v0` and
// multiplies by MOMENTUM_DECAY each frame before applying:
//   sum_{n>=1} v0 * decay^n = v0 * decay / (1 - decay)
const travelCards = (v0: number) => (v0 * MOMENTUM_DECAY) / (1 - MOMENTUM_DECAY);

describe('carousel momentum', () => {
  it('scroll direction is opposite to the swipe direction', () => {
    // Swiping left (negative touch velocity) scrolls toward later cards (positive).
    expect(initialMomentumVelocity(-2)).toBeGreaterThan(0);
    expect(initialMomentumVelocity(2)).toBeLessThan(0);
  });

  it('a normal flick glides only a fraction of a card past the drag', () => {
    // ~2 px/ms is a brisk swipe.
    expect(Math.abs(travelCards(initialMomentumVelocity(2)))).toBeLessThanOrEqual(1);
  });

  it('even an extreme flick never flings across the list', () => {
    // 10 px/ms is a violent flick — must still stay within a handful of cards,
    // not race off to a far-away city (the bug this guards against).
    expect(Math.abs(travelCards(initialMomentumVelocity(10)))).toBeLessThanOrEqual(5);
  });
});
