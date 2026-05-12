import { describe, it, expect } from 'vitest';
import {
  findBuildingsNearPoints,
  type SvgPoint,
  type SvgRect,
} from '../buildingProximity';

describe('buildingProximity', () => {
  describe('findBuildingsNearPoints', () => {
    it('returns point inside a building (distance 0)', () => {
      const points: SvgPoint[] = [{ x: 50, y: 50 }];
      const buildings = new Map<string, SvgRect>([
        ['building1', { x: 0, y: 0, width: 100, height: 100 }],
      ]);
      const result = findBuildingsNearPoints(points, buildings, 0);
      expect(result).toEqual(['building1']);
    });

    it('returns point exactly at threshold distance from rect edge', () => {
      const points: SvgPoint[] = [{ x: 10, y: 50 }];
      const buildings = new Map<string, SvgRect>([
        ['building1', { x: 20, y: 0, width: 100, height: 100 }],
      ]);
      // Distance from (10, 50) to rect at x: [20, 120], y: [0, 100]
      // Nearest point on rect is (20, 50)
      // Distance = sqrt((10-20)^2 + (50-50)^2) = 10
      const result = findBuildingsNearPoints(points, buildings, 10);
      expect(result).toEqual(['building1']);
    });

    it('excludes point beyond threshold distance from rect', () => {
      const points: SvgPoint[] = [{ x: 10, y: 50 }];
      const buildings = new Map<string, SvgRect>([
        ['building1', { x: 20, y: 0, width: 100, height: 100 }],
      ]);
      // Distance from (10, 50) to rect = 10
      const result = findBuildingsNearPoints(points, buildings, 9);
      expect(result).toEqual([]);
    });

    it('returns building near multiple points only once', () => {
      const points: SvgPoint[] = [
        { x: 10, y: 50 },
        { x: 15, y: 50 },
      ];
      const buildings = new Map<string, SvgRect>([
        ['building1', { x: 20, y: 0, width: 100, height: 100 }],
      ]);
      const result = findBuildingsNearPoints(points, buildings, 10);
      expect(result).toEqual(['building1']);
      expect(result).toHaveLength(1);
    });

    it('returns empty array for empty points', () => {
      const points: SvgPoint[] = [];
      const buildings = new Map<string, SvgRect>([
        ['building1', { x: 0, y: 0, width: 100, height: 100 }],
      ]);
      const result = findBuildingsNearPoints(points, buildings, 50);
      expect(result).toEqual([]);
    });

    it('returns empty array for empty buildings map', () => {
      const points: SvgPoint[] = [{ x: 50, y: 50 }];
      const buildings = new Map<string, SvgRect>();
      const result = findBuildingsNearPoints(points, buildings, 50);
      expect(result).toEqual([]);
    });

    it('returns only nearby buildings from multiple buildings', () => {
      const points: SvgPoint[] = [{ x: 50, y: 50 }];
      const buildings = new Map<string, SvgRect>([
        ['building1', { x: 0, y: 0, width: 100, height: 100 }], // Inside point
        ['building2', { x: 200, y: 200, width: 100, height: 100 }], // Far away
        ['building3', { x: 60, y: 60, width: 100, height: 100 }], // Near
      ]);
      const result = findBuildingsNearPoints(points, buildings, 50);
      expect(result).toContain('building1');
      expect(result).toContain('building3');
      expect(result).not.toContain('building2');
      expect(result).toHaveLength(2);
    });

    it('handles diagonal distance correctly', () => {
      const points: SvgPoint[] = [{ x: 0, y: 0 }];
      const buildings = new Map<string, SvgRect>([
        ['building1', { x: 3, y: 4, width: 10, height: 10 }],
      ]);
      // Distance from (0, 0) to nearest point on rect (3, 4) = sqrt(9 + 16) = 5
      const result = findBuildingsNearPoints(points, buildings, 5);
      expect(result).toEqual(['building1']);
    });

    it('excludes building at diagonal distance beyond threshold', () => {
      const points: SvgPoint[] = [{ x: 0, y: 0 }];
      const buildings = new Map<string, SvgRect>([
        ['building1', { x: 3, y: 4, width: 10, height: 10 }],
      ]);
      const result = findBuildingsNearPoints(points, buildings, 4.9);
      expect(result).toEqual([]);
    });

    it('deduplicates buildings near multiple points', () => {
      const points: SvgPoint[] = [
        { x: 10, y: 50 },
        { x: 15, y: 50 },
        { x: 20, y: 50 },
      ];
      const buildings = new Map<string, SvgRect>([
        ['building1', { x: 0, y: 0, width: 100, height: 100 }],
      ]);
      const result = findBuildingsNearPoints(points, buildings, 100);
      // Result should have no duplicates
      expect(new Set(result).size).toBe(result.length);
      expect(result).toEqual(['building1']);
    });
  });
});
