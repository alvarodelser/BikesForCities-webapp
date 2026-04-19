import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import type { CityData } from '../../constants/cities';
import ErrorState from '../ui/ErrorState';
import spainGeoJSON from '../../assets/spain-provinces.geojson?url';
import { useViewport } from '../../hooks/useViewport';

interface SpainMapProps {
  width?: number;
  height?: number;
  onCityClick?: (cityName: string) => void;
  onCityNavigate?: (cityName: string) => void;
  selectedCity?: string | null;
  expandedCity?: string | null; // kept for backward compat, not used in new pin rendering
  cities: CityData[];
  className?: string;
  registerPinRef?: (cityName: string, el: SVGGElement | null) => void;
}

interface CityCoordinates {
  name: string;
  coordinates: [number, number]; // [longitude, latitude]
  cityData: CityData;
}

// Convert city data to coordinate format for D3
const getCityCoordinates = (cities: CityData[]): CityCoordinates[] => {
  return cities.map(city => ({
    name: city.name,
    coordinates: [city.geoCoords.longitude, city.geoCoords.latitude],
    cityData: city,
  }));
};

// Constants for Canary Islands transformation
const CANARY_PROV_CODES = ["35", "38"];
const CANARY_LAT_OFFSET = 7.5;
const CANARY_LON_OFFSET = 0;

/**
 * Transforms coordinates for Canary Islands to move them closer to the mainland.
 */
const transformCanaryCoords = (lon: number, lat: number, codProv?: string): [number, number] => {
  if (codProv && CANARY_PROV_CODES.includes(codProv)) {
    return [lon + CANARY_LON_OFFSET, lat + CANARY_LAT_OFFSET];
  }
  if (!codProv && lat < 30) {
    return [lon + CANARY_LON_OFFSET, lat + CANARY_LAT_OFFSET];
  }
  return [lon, lat];
};

/**
 * Deeply transforms all coordinates in a GeoJSON geometry.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const transformGeometry = (geometry: any, codProv: string) => {
  if (!geometry || !geometry.coordinates) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const transform = (coords: any) => {
    if (!Array.isArray(coords)) return;
    if (coords.length === 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
      const [shiftedLon, shiftedLat] = transformCanaryCoords(coords[0], coords[1], codProv);
      coords[0] = shiftedLon;
      coords[1] = shiftedLat;
    } else {
      coords.forEach(transform);
    }
  };

  transform(geometry.coordinates);
};

// Load Spain provinces GeoJSON data
const loadSpainGeoJSON = async () => {
  try {
    const response = await fetch(spainGeoJSON);
    if (response.ok) {
      const data = await response.json();
      if (data && data.features) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data.features.forEach((feature: any) => {
          const codProv = feature.properties?.cod_prov;
          if (CANARY_PROV_CODES.includes(codProv)) {
            transformGeometry(feature.geometry, codProv);
          }
        });
      }
      return data;
    } else {
      throw new Error(`Failed to load GeoJSON: ${response.status}`);
    }
  } catch (error) {
    console.error('Error loading Spain GeoJSON:', error);
    throw error;
  }
};

// ─── Pin Component ────────────────────────────────────────────────────────────

interface PinProps {
  city: CityData;
  x: number;
  y: number;
  isActive: boolean;
  isHovered: boolean;
  isMobile: boolean;
  onClick: () => void;
  onHover: (hovered: boolean) => void;
  pinRef?: (el: SVGGElement | null) => void;
}

function Pin({ city, x, y, isActive, isHovered, isMobile, onClick, onHover, pinRef }: PinProps) {
  const haloR = isMobile ? 10 : 12;
  const ringR = isMobile ? 5 : 6;
  const coreR = isMobile ? 2.5 : 3;
  const scale = isActive ? 1.25 : 1;

  return (
    <g
      ref={pinRef}
      transform={`translate(${x},${y})`}
      className="cursor-pointer"
      onClick={onClick}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    >
      <circle
        r={haloR * scale}
        fill="#F4A24C"
        opacity={isActive ? 0.3 : isHovered ? 0.25 : 0.15}
        className="transition-all"
      />
      <circle r={ringR * scale} fill="none" stroke="#F4A24C" strokeWidth={1.5} />
      <circle
        r={coreR * scale}
        fill={isActive ? '#F4A24C' : '#fff'}
        stroke="#F4A24C"
        strokeWidth={1.5}
      />
      {!isMobile && (
        <text
          y={haloR * scale + 12}
          textAnchor="middle"
          style={{
            fontSize: isHovered ? 11 : 10,
            letterSpacing: 0.5,
            textTransform: 'uppercase',
            fill: isActive ? '#fff' : 'rgba(255,255,255,0.85)',
            fontWeight: isActive ? 700 : 500,
            transition: 'font-size 160ms',
          }}
        >
          {city.name}
        </text>
      )}
    </g>
  );
}

// ─── SpainMap Component ───────────────────────────────────────────────────────

const SpainMap: React.FC<SpainMapProps> = (props) => {
  const {
    width: widthProp,
    height: heightProp,
    onCityClick,
    selectedCity,
    cities,
    className,
    registerPinRef,
    // onCityNavigate and expandedCity kept for backward compat; not used in new SVG pin rendering
  } = props;
  const rootRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [geoData, setGeoData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [hoveredCity, setHoveredCity] = useState<string | null>(null);

  // Size: driven by ResizeObserver on root div; fallback to props if provided
  const [size, setSize] = useState({
    width: widthProp ?? 900,
    height: heightProp ?? 700,
  });

  const { isMobile } = useViewport();

  // ResizeObserver to track actual rendered size
  useEffect(() => {
    if (!rootRef.current) return;
    const el = rootRef.current;
    const ro = new ResizeObserver(() => {
      setSize({ width: el.clientWidth, height: el.clientHeight });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Responsive projection: preserve calibration (2800 scale at 900x700)
  // scale = min(width, height) * 4 → at 700px tall: 700 * 4 = 2800 ✓
  const projection = useMemo(() => {
    const { width, height } = size;
    if (!width || !height) return null;
    const scale = Math.min(width, height) * 4;
    return d3.geoMercator()
      .center([-3.5, 40])
      .scale(scale)
      .translate([width / 2, height / 2]);
  }, [size]);

  // Load GeoJSON data
  useEffect(() => {
    loadSpainGeoJSON()
      .then(data => {
        setGeoData(data);
        setError(null);
      })
      .catch(err => {
        setError(err.message || 'Failed to load map data');
      });
  }, []);

  // Draw base map shape via D3, scoped to g.map-base to avoid wiping React pins
  useEffect(() => {
    if (!svgRef.current || !geoData) return;

    const svg = d3.select(svgRef.current);

    // Scope cleanup to map-base group only — leaves sibling React-rendered pins untouched
    svg.select('g.map-base').remove();

    const path = d3.geoPath().projection(projection);

    // Add defs (gradient) — append fresh each time
    svg.selectAll('defs').remove();
    const defs = svg.append('defs');

    const gradient = defs
      .append('linearGradient')
      .attr('id', 'map-gradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '100%')
      .attr('y2', '100%');

    gradient
      .append('stop')
      .attr('offset', '0%')
      .style('stop-color', '#BFDDCE');

    gradient
      .append('stop')
      .attr('offset', '100%')
      .style('stop-color', '#FBF6EF');

    // Base map group — all D3-drawn content lives here
    const g = svg.append('g').attr('class', 'map-base');

    const mergedGeometry = {
      type: 'MultiPolygon',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      coordinates: geoData.features.flatMap((f: any) =>
        f.geometry.type === 'MultiPolygon'
          ? f.geometry.coordinates
          : [f.geometry.coordinates],
      ),
    };

    g.append('path')
      .attr('class', 'spain-shape')
      .datum(mergedGeometry)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .attr('d', path as any)
      .style('fill', 'url(#map-gradient)')
      .style('stroke', 'none')
      .style('opacity', 1.0);
  }, [geoData, projection]);

  // Root div sizing: if legacy props provided use them as inline style; otherwise fill parent
  const rootStyle: React.CSSProperties =
    widthProp != null && heightProp != null
      ? { width: widthProp, height: heightProp }
      : {};

  const rootClassName = `relative ${className ?? (widthProp != null ? '' : 'w-full h-full')}`;

  if (error) {
    return (
      <div ref={rootRef} className={rootClassName} style={rootStyle}>
        <ErrorState
          title="Map Unavailable"
          message={error}
          showRetry={true}
        />
      </div>
    );
  }

  return (
    <div ref={rootRef} className={rootClassName} style={rootStyle}>
      {/* SVG Map — base shape drawn by D3 inside g.map-base; pins rendered as React siblings */}
      <svg
        ref={svgRef}
        width={size.width}
        height={size.height}
        viewBox={`0 0 ${size.width} ${size.height}`}
        style={{ overflow: 'visible' }}
      >
        {/* g.map-base is managed by D3 (see useEffect above) */}

        {/* City Pins — inside SVG, sibling to g.map-base, not affected by D3 cleanup */}
        {projection &&
          getCityCoordinates(cities).map(city => {
            const [shiftedLon, shiftedLat] = transformCanaryCoords(
              city.coordinates[0],
              city.coordinates[1],
            );
            const p = projection([shiftedLon, shiftedLat]);
            if (!p) return null;
            const isActive = selectedCity === city.name;
            const isHovered = hoveredCity === city.name;

            return (
              <Pin
                key={city.name}
                city={city.cityData}
                x={p[0]}
                y={p[1]}
                isActive={isActive}
                isHovered={isHovered}
                isMobile={isMobile}
                onClick={() => onCityClick?.(city.name)}
                onHover={hovered => setHoveredCity(hovered ? city.name : null)}
                pinRef={registerPinRef ? el => registerPinRef(city.name, el) : undefined}
              />
            );
          })}
      </svg>
    </div>
  );
};

export default SpainMap;
