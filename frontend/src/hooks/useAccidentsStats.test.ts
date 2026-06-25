import { describe, it, expect } from 'vitest';
import { COLLISION_VEHICLE_KEYS } from './useAccidentsStats';

describe('COLLISION_VEHICLE_KEYS', () => {
  it('includes scooter', () => {
    expect(COLLISION_VEHICLE_KEYS).toContain('scooter');
  });

  it('still includes bike_vmu', () => {
    expect(COLLISION_VEHICLE_KEYS).toContain('bike_vmu');
  });

  it('has 7 entries', () => {
    expect(COLLISION_VEHICLE_KEYS).toHaveLength(7);
  });
});
