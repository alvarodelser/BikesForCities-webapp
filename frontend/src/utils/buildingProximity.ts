export interface SvgRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SvgPoint {
  x: number;
  y: number;
}

/**
 * Helper function to clamp a value between min and max.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Calculate the Euclidean distance from a point to the nearest point on a rect.
 * If the point is inside the rect, the distance is 0.
 *
 * @param point - The point (px, py)
 * @param rect - The rectangle (x, y, width, height)
 * @returns The distance from the point to the nearest point on the rect
 */
function distancePointToRect(point: SvgPoint, rect: SvgRect): number {
  const nearestX = clamp(point.x, rect.x, rect.x + rect.width);
  const nearestY = clamp(point.y, rect.y, rect.y + rect.height);

  const dx = point.x - nearestX;
  const dy = point.y - nearestY;

  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Given a list of sample points along a trajectory and a map of building
 * bounding boxes, returns the IDs of buildings whose bbox is within
 * `threshold` pixels of any of the sample points.
 *
 * Distance from a point to a rect = Euclidean distance from the point to the
 * nearest point on (or inside) the rect.
 * If the point is inside the rect, distance is 0.
 *
 * @param points - Sample points along the trajectory (SVG pixel coordinates)
 * @param buildings - Map of building ID → bounding box (SVG pixel coordinates)
 * @param threshold - Maximum pixel distance to count as "near"
 * @returns Array of building IDs within threshold distance of any point
 */
export function findBuildingsNearPoints(
  points: SvgPoint[],
  buildings: Map<string, SvgRect>,
  threshold: number
): string[] {
  const nearBuildingIds = new Set<string>();

  // For each point, check all buildings
  for (const point of points) {
    for (const [buildingId, rect] of buildings.entries()) {
      const distance = distancePointToRect(point, rect);
      if (distance <= threshold) {
        nearBuildingIds.add(buildingId);
      }
    }
  }

  // Return as array (no duplicates because Set handles that)
  return Array.from(nearBuildingIds);
}
