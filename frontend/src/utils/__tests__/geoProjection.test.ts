import { describe, it, expect } from 'vitest';
import {
  SVG_W,
  SVG_H,
  computeGeoBbox,
  projectGeoCoords,
  type GeoBbox,
} from '../geoProjection';

describe('geoProjection', () => {
  describe('computeGeoBbox', () => {
    it('computes correct bbox for 3 points', () => {
      const coords: [number, number][] = [
        [-1, 0],
        [0, 1],
        [1, -1],
      ];
      const bbox = computeGeoBbox(coords);
      expect(bbox).toEqual({
        minLon: -1,
        maxLon: 1,
        minLat: -1,
        maxLat: 1,
      });
    });

    it('computes correct bbox for 4 points', () => {
      const coords: [number, number][] = [
        [-2, -3],
        [2, -1],
        [1, 3],
        [-1, 1],
      ];
      const bbox = computeGeoBbox(coords);
      expect(bbox).toEqual({
        minLon: -2,
        maxLon: 2,
        minLat: -3,
        maxLat: 3,
      });
    });

    it('returns identical min/max for single point', () => {
      const coords: [number, number][] = [[5, 7]];
      const bbox = computeGeoBbox(coords);
      expect(bbox).toEqual({
        minLon: 5,
        maxLon: 5,
        minLat: 7,
        maxLat: 7,
      });
    });
  });

  describe('projectGeoCoords', () => {
    const bbox: GeoBbox = { minLon: -1, maxLon: 1, minLat: -1, maxLat: 1 };
    const svgWidth = SVG_W;
    const svgHeight = SVG_H;

    it('maps top-left corner to (0, 0)', () => {
      const result = projectGeoCoords(-1, 1, bbox, svgWidth, svgHeight);
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
    });

    it('maps bottom-right corner to (svgWidth, svgHeight)', () => {
      const result = projectGeoCoords(1, -1, bbox, svgWidth, svgHeight);
      expect(result.x).toBe(svgWidth);
      expect(result.y).toBe(svgHeight);
    });

    it('maps center of bbox to approximately (svgWidth/2, svgHeight/2)', () => {
      const result = projectGeoCoords(0, 0, bbox, svgWidth, svgHeight);
      expect(result.x).toBeCloseTo(svgWidth / 2, 0);
      expect(result.y).toBeCloseTo(svgHeight / 2, 0);
    });

    it('inverts latitude (northernmost point maps to y=0)', () => {
      const northPoint = projectGeoCoords(0, 1, bbox, svgWidth, svgHeight);
      const southPoint = projectGeoCoords(0, -1, bbox, svgWidth, svgHeight);
      expect(northPoint.y).toBeLessThan(southPoint.y);
      expect(northPoint.y).toBe(0);
      expect(southPoint.y).toBe(svgHeight);
    });

    it('projects arbitrary point correctly', () => {
      // Point at (0.5, 0.5) in geo space should be at (0.75 * svgWidth, 0.25 * svgHeight)
      // lon 0.5 is 1.5/2 = 0.75 of the way across
      // lat 0.5 is inverted, so it's 0.5/2 = 0.25 of the way down
      const result = projectGeoCoords(0.5, 0.5, bbox, svgWidth, svgHeight);
      expect(result.x).toBeCloseTo((0.75 * svgWidth), 0);
      expect(result.y).toBeCloseTo((0.25 * svgHeight), 0);
    });

    it('throws when bbox has zero longitude range', () => {
      const bbox: GeoBbox = { minLon: 0, maxLon: 0, minLat: -1, maxLat: 1 };
      expect(() => projectGeoCoords(0, 0, bbox, 1000, 700)).toThrow();
    });

    it('throws when bbox has zero latitude range', () => {
      const bbox: GeoBbox = { minLon: -1, maxLon: 1, minLat: 0, maxLat: 0 };
      expect(() => projectGeoCoords(0, 0, bbox, 1000, 700)).toThrow();
    });
  });
});
