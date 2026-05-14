import type { GeoBbox } from './geoProjection';
import { SVG_W, SVG_H, projectGeoCoords } from './geoProjection';

export interface StreetSegment {
  id: string;
  points: [number, number][];
}

// Extract line segments from street geometry
export function extractStreetSegments(features: any[], bbox: GeoBbox): StreetSegment[] {
  const segments: StreetSegment[] = [];

  features.forEach((feature, fIdx) => {
    if (!feature.geometry) return;

    const { type, coordinates } = feature.geometry;

    if (type === 'LineString') {
      const coords = coordinates as number[][];
      if (coords.length >= 2) {
        segments.push({
          id: `seg-${fIdx}`,
          points: coords as [number, number][],
        });
      }
    } else if (type === 'MultiLineString') {
      const multiCoords = coordinates as number[][][];
      multiCoords.forEach((coords, lineIdx) => {
        if (coords.length >= 2) {
          segments.push({
            id: `seg-${fIdx}-${lineIdx}`,
            points: coords as [number, number][],
          });
        }
      });
    }
  });

  return segments;
}

// Find paths that cross the viewport from margin to margin
export function findMarginCrossingPaths(
  segments: StreetSegment[],
  bbox: GeoBbox
): StreetSegment[] {
  const projectedSegments = segments.map((seg) => {
    const points = seg.points.map(([lon, lat]) => ({
      geo: [lon, lat] as [number, number],
      svg: projectGeoCoords(lon, lat, bbox, SVG_W, SVG_H),
    }));
    return { ...seg, projectedPoints: points };
  });

  const scoredSegments = projectedSegments.map((seg) => {
    const projPts = seg.projectedPoints;
    const minX = Math.min(...projPts.map((p) => p.svg.x));
    const maxX = Math.max(...projPts.map((p) => p.svg.x));
    const minY = Math.min(...projPts.map((p) => p.svg.y));
    const maxY = Math.max(...projPts.map((p) => p.svg.y));

    const horizontalSpan = maxX - minX;
    const verticalSpan = maxY - minY;
    const crossScore = Math.max(horizontalSpan, verticalSpan);

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const centerScore = 1 / (1 + Math.abs(centerX - SVG_W / 2) / 100 + Math.abs(centerY - SVG_H / 2) / 100);

    return { seg, crossScore, centerScore, score: crossScore * centerScore };
  });

  return scoredSegments
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((s) => ({
      ...s.seg,
      points: s.seg.projectedPoints.map((p) => p.geo),
    }));
}

// Extend the first and last points of an SVG point array so they exit the viewport
function extendToEdges(
  pts: { x: number; y: number }[]
): { x: number; y: number }[] {
  if (pts.length < 2) return pts;

  const EXTEND = 250;

  // Extrapolate start backwards along first segment direction
  const dx0 = pts[0].x - pts[1].x;
  const dy0 = pts[0].y - pts[1].y;
  const l0 = Math.sqrt(dx0 * dx0 + dy0 * dy0) || 1;
  const extStart = {
    x: pts[0].x + (dx0 / l0) * EXTEND,
    y: pts[0].y + (dy0 / l0) * EXTEND,
  };

  // Extrapolate end forwards along last segment direction
  const n = pts.length;
  const dx1 = pts[n - 1].x - pts[n - 2].x;
  const dy1 = pts[n - 1].y - pts[n - 2].y;
  const l1 = Math.sqrt(dx1 * dx1 + dy1 * dy1) || 1;
  const extEnd = {
    x: pts[n - 1].x + (dx1 / l1) * EXTEND,
    y: pts[n - 1].y + (dy1 / l1) * EXTEND,
  };

  return [extStart, ...pts, extEnd];
}

// Convert geographic line to SVG path string, extending endpoints beyond screen edges
export function geoLineToSvgPath(line: [number, number][], bbox: GeoBbox): string {
  if (line.length === 0) return '';

  const svgPoints = line.map(([lon, lat]) => projectGeoCoords(lon, lat, bbox, SVG_W, SVG_H));
  const extended = extendToEdges(svgPoints);

  let pathStr = `M ${extended[0].x.toFixed(1)},${extended[0].y.toFixed(1)}`;
  for (let i = 1; i < extended.length; i++) {
    pathStr += ` L ${extended[i].x.toFixed(1)},${extended[i].y.toFixed(1)}`;
  }

  return pathStr;
}
