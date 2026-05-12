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
  // Find the 3 most representative paths crossing the viewport
  // by looking for segments that span significant distance horizontally or vertically

  const projectedSegments = segments.map((seg) => {
    const points = seg.points.map(([lon, lat]) => ({
      geo: [lon, lat] as [number, number],
      svg: projectGeoCoords(lon, lat, bbox, SVG_W, SVG_H),
    }));
    return { ...seg, projectedPoints: points };
  });

  // Score segments by how well they cross the viewport
  const scoredSegments = projectedSegments.map((seg) => {
    const projPts = seg.projectedPoints;
    const minX = Math.min(...projPts.map((p) => p.svg.x));
    const maxX = Math.max(...projPts.map((p) => p.svg.x));
    const minY = Math.min(...projPts.map((p) => p.svg.y));
    const maxY = Math.max(...projPts.map((p) => p.svg.y));

    // Prefer segments that span most of the width or height
    const horizontalSpan = maxX - minX;
    const verticalSpan = maxY - minY;
    const crossScore = Math.max(horizontalSpan, verticalSpan);

    // Prefer segments that are roughly in the middle (not too far edges)
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const centerScore = 1 / (1 + Math.abs(centerX - SVG_W / 2) / 100 + Math.abs(centerY - SVG_H / 2) / 100);

    return { seg, crossScore, centerScore, score: crossScore * centerScore };
  });

  // Sort by score and pick top 3
  return scoredSegments
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((s) => ({
      ...s.seg,
      points: s.seg.projectedPoints.map((p) => p.geo),
    }));
}

// Convert geographic line to SVG path string
export function geoLineToSvgPath(line: [number, number][], bbox: GeoBbox): string {
  if (line.length === 0) return '';

  const svgPoints = line.map(([lon, lat]) => projectGeoCoords(lon, lat, bbox, SVG_W, SVG_H));

  // Start with first point
  let pathStr = `M ${svgPoints[0].x.toFixed(1)},${svgPoints[0].y.toFixed(1)}`;

  // Add line segments
  for (let i = 1; i < svgPoints.length; i++) {
    const p = svgPoints[i];
    pathStr += ` L ${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  }

  return pathStr;
}
