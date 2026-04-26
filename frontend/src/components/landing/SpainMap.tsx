import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import type { CityData } from '../../constants/cities';
import ErrorContainer from '../ui/ErrorContainer';
import spainGeoJSON from '../../assets/spain-provinces.geojson?url';
import { useViewport } from '../../hooks/useViewport';

interface SpainMapProps {
  width?: number;
  height?: number;
  onCityClick?: (cityName: string) => void;
  onCityNavigate?: (cityName: string) => void;
  selectedCity?: string | null;
  expandedCity?: string | null; 
  cities: CityData[];
  className?: string;
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
const CANARY_LON_OFFSET_DESKTOP = 1.5;
const CANARY_LON_OFFSET_MOBILE = 2.5; // Moved right for mobile as requested

/**
 * Transforms coordinates for Canary Islands to move them closer to the mainland.
 */
const transformCanaryCoords = (lon: number, lat: number, isMobile: boolean, codProv?: string): [number, number] => {
  const lonOffset = isMobile ? CANARY_LON_OFFSET_MOBILE : CANARY_LON_OFFSET_DESKTOP;
  if (codProv && CANARY_PROV_CODES.includes(codProv)) {
    return [lon + lonOffset, lat + CANARY_LAT_OFFSET];
  }
  if (!codProv && lat < 30) {
    return [lon + lonOffset, lat + CANARY_LAT_OFFSET];
  }
  return [lon, lat];
};

/**
 * Deeply transforms all coordinates in a GeoJSON geometry.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const transformGeometry = (geometry: any, isMobile: boolean, codProv: string) => {
  if (!geometry || !geometry.coordinates) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const transform = (coords: any) => {
    if (!Array.isArray(coords)) return;
    if (coords.length === 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
      const [shiftedLon, shiftedLat] = transformCanaryCoords(coords[0], coords[1], isMobile, codProv);
      coords[0] = shiftedLon;
      coords[1] = shiftedLat;
    } else {
      coords.forEach(transform);
    }
  };

  transform(geometry.coordinates);
};

// Cache for the raw GeoJSON data to avoid redundant fetches
let cachedRawGeoJSON: any = null;

// Load Spain provinces GeoJSON data
const loadSpainGeoJSON = async (isMobile: boolean) => {
  try {
    if (!cachedRawGeoJSON) {
      const response = await fetch(spainGeoJSON);
      if (!response.ok) {
        throw new Error(`Failed to load GeoJSON: ${response.status}`);
      }
      cachedRawGeoJSON = await response.json();
    }

    // Always work on a fresh clone to apply correct transformation for current viewport
    const data = JSON.parse(JSON.stringify(cachedRawGeoJSON));

    if (data && data.features) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data.features.forEach((feature: any) => {
        const codProv = feature.properties?.cod_prov;
        if (CANARY_PROV_CODES.includes(codProv)) {
          transformGeometry(feature.geometry, isMobile, codProv);
        }
      });
    }
    return data;
  } catch (error) {
    console.error('Error loading Spain GeoJSON:', error);
    throw error;
  }
};

// ─── Pin Component ────────────────────────────────────────────────────────────

interface PinProps {
  cityName: string;
  city: CityData;
  x: number;
  y: number;
  isActive: boolean;
  isHovered: boolean;
  isMobile: boolean;
  onClick: (cityName: string) => void;
  onHover: (cityName: string, hovered: boolean) => void;
}

const Pin = React.memo(function Pin({ cityName, city, x, y, isActive, isHovered, isMobile, onClick, onHover }: PinProps) {
  const scale = isActive ? 1.25 : isHovered ? 1.1 : 1;
  const width = (isMobile ? 24 : 32) * scale;
  const height = (isMobile ? 12 : 16) * scale;
  const rx = height / 2;

  // Colors from theme.css
  const fillColor = isActive ? '#AF4749' : '#027A76'; // --red / --green-dark
  const strokeColor = '#FBF6EF'; // --cream

  return (
    <g
      transform={`translate(${x},${y})`}
      className="cursor-pointer focus:outline-none group"
      role="button"
      tabIndex={0}
      aria-label={city.name}
      onClick={() => onClick(cityName)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(cityName);
        }
      }}
      onMouseEnter={() => onHover(cityName, true)}
      onMouseLeave={() => onHover(cityName, false)}
      onFocus={() => onHover(cityName, true)}
      onBlur={() => onHover(cityName, false)}
    >
      {/* Shadow/Glow effect */}
      <rect
        x={-width / 2}
        y={-height / 2}
        width={width}
        height={height}
        rx={rx}
        fill={fillColor}
        opacity={isActive ? 0.4 : isHovered ? 0.3 : 0}
        filter="blur(4px)"
        className="transition-all duration-300"
      />
      
      {/* Main Pill Shape */}
      <rect
        x={-width / 2}
        y={-height / 2}
        width={width}
        height={height}
        rx={rx}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={isActive ? 2 : 1.5}
        className="transition-all duration-300 shadow-lg"
      />

      {!isMobile && (
        <text
          y={height / 2 + 14}
          textAnchor="middle"
          className="transition-all duration-300 pointer-events-none"
          style={{
            fontSize: isHovered || isActive ? 12 : 11,
            letterSpacing: 0.5,
            textTransform: 'uppercase',
            fill: isActive ? '#fff' : 'rgba(255,255,255,0.9)',
            fontWeight: isActive ? 800 : 600,
            textShadow: '0 1px 4px rgba(0,0,0,0.4)',
          }}
        >
          {city.name}
        </text>
      )}
    </g>
  );
});

// ─── SpainMap Component ───────────────────────────────────────────────────────

const SpainMap: React.FC<SpainMapProps> = (props) => {
  const {
    width: widthProp,
    height: heightProp,
    onCityClick,
    selectedCity,
    cities,
    className,
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

  // ResizeObserver to track actual rendered size — useLayoutEffect fires before paint to avoid
  // a flash from fallback size → measured size
  useLayoutEffect(() => {
    if (!rootRef.current) return;
    const el = rootRef.current;
    // Fire initial measurement synchronously before paint
    setSize({ width: el.clientWidth, height: el.clientHeight });
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

    // Displace Spain to the right on mobile (approx 10% of width) for better framing
    const xOffset = isMobile ? width * 0.12 : 0;

    return d3.geoMercator()
      .center([-3.5, 40])
      .scale(scale)
      .translate([width / 2 + xOffset, height / 2]);
  }, [size, isMobile]);

  // Load GeoJSON data
  useEffect(() => {
    loadSpainGeoJSON(isMobile)
      .then(data => {
        setGeoData(data);
        setError(null);
      })
      .catch(err => {
        setError(err.message || 'Failed to load map data');
      });
  }, [isMobile]);

  // Draw base map shape via D3, scoped to g.map-base to avoid wiping React pins
  useEffect(() => {
    if (!svgRef.current || !geoData) return;

    const svg = d3.select(svgRef.current);

    // Select the existing group (defined in JSX) and clear its content
    const g = svg.select('g.map-base');
    g.selectAll('*').remove();

    const path = d3.geoPath().projection(projection);

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

  // Stable per-component handlers so React.memo on Pin can bail out for non-hovered pins
  const handlePinClick = useCallback((cityName: string) => {
    onCityClick?.(cityName);
  }, [onCityClick]);

  const handlePinHover = useCallback((cityName: string, hovered: boolean) => {
    setHoveredCity(hovered ? cityName : null);
  }, []);

  // Root div sizing: if legacy props provided use them as inline style; otherwise fill parent
  const hasLegacyDimensions = widthProp != null && heightProp != null;
  const rootStyle: React.CSSProperties = hasLegacyDimensions
    ? { width: widthProp, height: heightProp }
    : {};

  const rootClassName = `relative ${className ?? (hasLegacyDimensions ? '' : 'w-full h-full')}`;

  if (error) {
    return (
      <div ref={rootRef} className={rootClassName} style={rootStyle}>
        <ErrorContainer
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
        {/* Static gradient defs — React-owned, D3 no longer touches defs */}
        <defs>
          <linearGradient id="map-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#BFDDCE" />
            <stop offset="100%" stopColor="#FBF6EF" />
          </linearGradient>
        </defs>

        {/* g.map-base is managed by D3 (see useEffect above) */}
        <g className="map-base" />

        {/* City Pins — inside SVG, sibling to g.map-base, not affected by D3 cleanup */}
        {projection &&
          getCityCoordinates(cities).map(city => {
            const [shiftedLon, shiftedLat] = transformCanaryCoords(
              city.coordinates[0],
              city.coordinates[1],
              isMobile,
            );
            const p = projection([shiftedLon, shiftedLat]);
            if (!p) return null;
            const isActive = selectedCity === city.name;
            const isHovered = hoveredCity === city.name;

            return (
              <Pin
                key={city.name}
                cityName={city.name}
                city={city.cityData}
                x={p[0]}
                y={p[1]}
                isActive={isActive}
                isHovered={isHovered}
                isMobile={isMobile}
                onClick={handlePinClick}
                onHover={handlePinHover}
              />
            );
          })}
      </svg>
    </div>
  );
};

export default SpainMap;
