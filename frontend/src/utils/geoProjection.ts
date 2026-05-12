export const SVG_W = 1000;
export const SVG_H = 700;

export interface GeoBbox {
  minLon: number;
  maxLon: number;
  minLat: number;
  maxLat: number;
}

/**
 * Computes the bounding box across an array of [lon, lat] coordinate pairs.
 * Returns { minLon, maxLon, minLat, maxLat }.
 */
export function computeGeoBbox(coords: [number, number][]): GeoBbox {
  if (coords.length === 0) {
    throw new Error('coords array cannot be empty');
  }

  const lons = coords.map((c) => c[0]);
  const lats = coords.map((c) => c[1]);

  return {
    minLon: Math.min(...lons),
    maxLon: Math.max(...lons),
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
  };
}

/**
 * Projects a single [lon, lat] point to SVG pixel coordinates
 * given a bounding box and SVG dimensions.
 * Latitude is inverted (SVG y=0 is top; geo y=maxLat is north).
 *
 * svgX = (lon - minLon) / (maxLon - minLon) * svgWidth
 * svgY = (maxLat - lat) / (maxLat - minLat) * svgHeight
 *
 * Returns { x, y } in SVG pixel space.
 */
export function projectGeoCoords(
  lon: number,
  lat: number,
  bbox: GeoBbox,
  svgWidth: number,
  svgHeight: number
): { x: number; y: number } {
  const lonRange = bbox.maxLon - bbox.minLon;
  const latRange = bbox.maxLat - bbox.minLat;

  if (lonRange === 0 || latRange === 0) {
    throw new Error('Bounding box must have non-zero width and height');
  }

  const x = ((lon - bbox.minLon) / lonRange) * svgWidth;
  const y = ((bbox.maxLat - lat) / latRange) * svgHeight;

  return { x, y };
}
