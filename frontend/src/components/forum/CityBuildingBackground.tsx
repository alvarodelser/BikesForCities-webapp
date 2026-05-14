import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { fetchBuildingFootprints, type BuildingFeature } from '../../services/api';
import { SVG_W, SVG_H, computeGeoBbox, projectGeoCoords, type GeoBbox } from '../../utils/geoProjection';

// ---- Types ----

export interface CityBuildingBackgroundHandle {
  addLitBuildings: (polygonIds: string[], pathIndex: number) => void;
  clearLit: (pathIndex: number) => void;
  svgElement: SVGSVGElement | null;
}

interface CityBuildingBackgroundProps {
  cityId: number;
  viewBbox?: GeoBbox;
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
  const lonWidth = bbox.maxLon - bbox.minLon;
  const latHeight = bbox.maxLat - bbox.minLat;
  const lonPadding = lonWidth * 0.3;
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
  ({ cityId, viewBbox }, ref) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const [polygons, setPolygons] = useState<ProjectedPolygon[]>([]);
    const [litIds, setLitIds] = useState<Set<string>>(new Set());
    const litIdsByPath = useRef<[Set<string>, Set<string>, Set<string>]>([
      new Set(),
      new Set(),
      new Set(),
    ]);

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

          const allCoords: [number, number][] = rings.flat();
          if (allCoords.length === 0) return;

          // Use provided viewBbox, or compute from building footprints
          let displayBbox: GeoBbox;
          if (viewBbox) {
            displayBbox = viewBbox;
          } else {
            const fullBbox = computeGeoBbox(allCoords);
            displayBbox = computeCenterZone(fullBbox);
          }

          const visibleRings = rings.filter((ring) =>
            ring.some(
              ([lon, lat]) =>
                lon >= displayBbox.minLon &&
                lon <= displayBbox.maxLon &&
                lat >= displayBbox.minLat &&
                lat <= displayBbox.maxLat
            )
          );

          const projected = projectPolygons(
            visibleRings.length > 0 ? visibleRings : rings,
            displayBbox
          );
          setPolygons(projected);
        })
        .catch(() => {
          // Silent fail
        });

      return () => {
        cancelled = true;
      };
    }, [cityId, viewBbox]);

    // Expose handle
    useImperativeHandle(ref, () => ({
      addLitBuildings(ids: string[], pathIndex: number) {
        const sets = litIdsByPath.current;
        ids.forEach((id) => sets[pathIndex].add(id));
        setLitIds(new Set([...sets[0], ...sets[1], ...sets[2]]));
      },
      clearLit(pathIndex: number) {
        litIdsByPath.current[pathIndex].clear();
        const sets = litIdsByPath.current;
        setLitIds(new Set([...sets[0], ...sets[1], ...sets[2]]));
      },
      get svgElement() {
        return svgRef.current;
      },
    }));

    if (polygons.length === 0) return null;

    return (
      <>
        <style>{`
          .bldg-poly {
            fill: var(--forum-building-fill);
            stroke: var(--forum-building-stroke);
            stroke-width: 0.6;
            opacity: 0.8;
          }
          .bldg-poly--lit {
            fill: var(--forum-building-fill-pop);
            stroke: var(--forum-building-stroke-pop);
            transition: fill 700ms ease-in-out, stroke 700ms ease-in-out, filter 700ms ease-in-out;
            filter: drop-shadow(0 0 4px rgba(58, 124, 181, 0.35));
          }
          .bldg-poly:not(.bldg-poly--lit) {
            transition: fill 900ms ease-in-out, stroke 900ms ease-in-out, filter 900ms ease-in-out;
            filter: none;
          }
        `}</style>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          preserveAspectRatio="xMidYMid slice"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            pointerEvents: 'none',
            zIndex: 1,
          }}
        >
          {polygons.map((poly) => (
            <polygon
              key={poly.id}
              id={poly.id}
              className={`bldg-poly${litIds.has(poly.id) ? ' bldg-poly--lit' : ''}`}
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
