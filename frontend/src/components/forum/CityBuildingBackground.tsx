import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { fetchBuildingFootprints, type BuildingFeature } from '../../services/api';
import { SVG_W, SVG_H, computeGeoBbox, projectGeoCoords, type GeoBbox } from '../../utils/geoProjection';

// ---- Types ----

export interface CityBuildingBackgroundHandle {
  triggerPop: (polygonIds: string[]) => void;
  svgElement: SVGSVGElement | null;
}

interface CityBuildingBackgroundProps {
  cityId: number;
}

// ---- Helpers ----

interface ProjectedPolygon {
  id: string;
  points: string;
}

function extractOuterRings(features: BuildingFeature[]): [number, number][][] {
  const rings: [number, number][][] = [];
  for (const feature of features) {
    if (feature.geometry.type === 'Polygon') {
      const coords = feature.geometry.coordinates as number[][][];
      if (coords[0] && coords[0].length > 0) {
        rings.push(coords[0] as [number, number][]);
      }
    } else if (feature.geometry.type === 'MultiPolygon') {
      const coords = feature.geometry.coordinates as number[][][][];
      for (const polygon of coords) {
        if (polygon[0] && polygon[0].length > 0) {
          rings.push(polygon[0] as [number, number][]);
        }
      }
    }
  }
  return rings;
}

function computeCenterZone(bbox: GeoBbox): GeoBbox {
  // Extract center 40% of the bbox (30% padding on each side for more zoom)
  const lonWidth = bbox.maxLon - bbox.minLon;
  const latHeight = bbox.maxLat - bbox.minLat;
  const lonPadding = lonWidth * 0.3; // 30% on each side
  const latPadding = latHeight * 0.3;

  return {
    minLon: bbox.minLon + lonPadding,
    maxLon: bbox.maxLon - lonPadding,
    minLat: bbox.minLat + latPadding,
    maxLat: bbox.maxLat - latPadding,
  };
}

function projectPolygons(rings: [number, number][][], bbox: GeoBbox): ProjectedPolygon[] {
  return rings.map((ring, index) => {
    const pointStr = ring
      .map(([lon, lat]) => {
        const { x, y } = projectGeoCoords(lon, lat, bbox, SVG_W, SVG_H);
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(' ');
    return { id: `bldg-${index}`, points: pointStr };
  });
}

// ---- Component ----

const CityBuildingBackground = forwardRef<CityBuildingBackgroundHandle, CityBuildingBackgroundProps>(
  ({ cityId }, ref) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const [polygons, setPolygons] = useState<ProjectedPolygon[]>([]);
    const [poppedIds, setPoppedIds] = useState<Set<string>>(new Set());
    const popTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Fetch and project on mount
    useEffect(() => {
      let cancelled = false;

      fetchBuildingFootprints(cityId)
        .then((geojson) => {
          if (cancelled) return;

          const features = geojson.features;
          if (features.length === 0) return;

          const rings = extractOuterRings(features);
          if (rings.length === 0) return;

          // Collect all coordinate pairs to compute overall bbox
          const allCoords: [number, number][] = rings.flat();
          if (allCoords.length === 0) return;

          const fullBbox = computeGeoBbox(allCoords);
          // Focus on center zone (40% of bbox for aggressive zoom)
          const centerZone = computeCenterZone(fullBbox);

          // Filter rings to only those within center zone
          const centerRings = rings.filter((ring) => {
            // Check if any point in the ring falls within center zone
            return ring.some(
              ([lon, lat]) =>
                lon >= centerZone.minLon &&
                lon <= centerZone.maxLon &&
                lat >= centerZone.minLat &&
                lat <= centerZone.maxLat
            );
          });

          if (centerRings.length === 0) {
            // Fallback: if center zone has no buildings, expand to 60% of bbox
            const expandedZone: GeoBbox = {
              minLon: fullBbox.minLon + (fullBbox.maxLon - fullBbox.minLon) * 0.2,
              maxLon: fullBbox.maxLon - (fullBbox.maxLon - fullBbox.minLon) * 0.2,
              minLat: fullBbox.minLat + (fullBbox.maxLat - fullBbox.minLat) * 0.2,
              maxLat: fullBbox.maxLat - (fullBbox.maxLat - fullBbox.minLat) * 0.2,
            };
            const expandedRings = rings.filter((ring) =>
              ring.some(
                ([lon, lat]) =>
                  lon >= expandedZone.minLon &&
                  lon <= expandedZone.maxLon &&
                  lat >= expandedZone.minLat &&
                  lat <= expandedZone.maxLat
              )
            );
            const projected = projectPolygons(
              expandedRings.length > 0 ? expandedRings : rings,
              expandedRings.length > 0 ? expandedZone : fullBbox
            );
            setPolygons(projected);
            return;
          }

          const projected = projectPolygons(centerRings, centerZone);
          setPolygons(projected);
        })
        .catch(() => {
          // Silent fail — render nothing
        });

      return () => {
        cancelled = true;
      };
    }, [cityId]);

    // Expose handle
    useImperativeHandle(ref, () => ({
      triggerPop(ids: string[]) {
        setPoppedIds((prev) => {
          const next = new Set(prev);
          ids.forEach((id) => next.add(id));
          return next;
        });

        // Clear previous timeout if any
        if (popTimeoutRef.current !== null) {
          clearTimeout(popTimeoutRef.current);
        }

        popTimeoutRef.current = setTimeout(() => {
          setPoppedIds(new Set());
          popTimeoutRef.current = null;
        }, 2500);
      },
      get svgElement() {
        return svgRef.current;
      },
    }));

    // Cleanup timeout on unmount
    useEffect(() => {
      return () => {
        if (popTimeoutRef.current !== null) {
          clearTimeout(popTimeoutRef.current);
        }
      };
    }, []);

    if (polygons.length === 0) return null;

    return (
      <>
        <style>{`
          .bldg-poly {
            fill: rgba(220, 200, 170, 0.18);
            stroke: rgba(180, 160, 130, 0.35);
            stroke-width: 0.8;
            transition: fill 300ms, stroke 300ms, filter 300ms;
            filter: drop-shadow(0 0 1px rgba(255, 255, 255, 0.3));
            opacity: 0.85;
          }
          .bldg-poly--popped {
            fill: var(--forum-building-fill-pop);
            stroke: var(--forum-building-stroke-pop);
            animation: bldg-pop 500ms ease-in-out;
            filter: drop-shadow(0 0 3px rgba(2, 122, 118, 0.5));
          }
          @keyframes bldg-pop {
            0%   { transform: scale(1); }
            50%  { transform: scale(1.015); }
            100% { transform: scale(1); }
          }
        `}</style>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          preserveAspectRatio="xMidYMid slice"
          style={{
            position: 'fixed',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 1,
          }}
        >
          {polygons.map((poly) => (
            <polygon
              key={poly.id}
              id={poly.id}
              className={`bldg-poly${poppedIds.has(poly.id) ? ' bldg-poly--popped' : ''}`}
              points={poly.points}
            />
          ))}
        </svg>
      </>
    );
  }
);

CityBuildingBackground.displayName = 'CityBuildingBackground';
export default CityBuildingBackground;
