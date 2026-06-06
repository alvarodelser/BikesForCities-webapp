import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import type { CityData } from '../../constants/cities';
import CityCard from '../ui/CityCard';
import ErrorContainer from '../ui/ErrorContainer';

import spainGeoJSON from '../../assets/spain-provinces.geojson?url';
import { useViewport } from '../../hooks/useViewport';
import { computeLabelCandidates, rectsOverlap } from './spainMapLabels';
import type { LabelRect } from './spainMapLabels';

interface SpainMapProps {
  width?: number;
  height?: number;
  onCityClick?: (cityName: string) => void;
  onCityNavigate?: (cityName: string) => void;
  selectedCity?: string | null;
  cities: CityData[];
  className?: string;
}

interface CityCoordinates {
  name: string;
  coordinates: [number, number]; // [longitude, latitude]
  cityData: CityData;
}

interface CardLayout {
  px: number;
  py: number;
  cardX: number;
  cardY: number;
  cardW: number;
  cardH: number;
  connectorPath: string;
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
        throw new Error(`Error al cargar la geometría: ${response.status}`);
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

interface LabelConfig {
  anchorX: number;
  anchorY: number;
  fill: string;
  textShadow: string;
  hidden: boolean;
}

interface PinProps {
  cityName: string;
  city: CityData;
  x: number;
  y: number;
  isActive: boolean;
  isHovered: boolean;
  isMobile: boolean;
  labelConfig?: LabelConfig;
  onClick: (cityName: string) => void;
  onHover: (cityName: string, hovered: boolean) => void;
}

const Pin = React.memo(function Pin({ cityName, city, x, y, isActive, isHovered, isMobile, labelConfig, onClick, onHover }: PinProps) {
  const width = isMobile ? 12 : 14;
  const height = isMobile ? 10 : 12;
  const rx = 5; // Fixed small radius for pill shape

  // Navy blue border color
  const strokeColor = '#003849';

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
      {/* Glow effect - animates to red when selected or hovered */}
      <rect
        x={-width / 2}
        y={-height / 2}
        width={width}
        height={height}
        rx={rx}
        fill={isActive ? '#AF4749' : isHovered ? '#04c7c1' : '#027A76'}
        opacity={isActive ? 0.4 : isHovered ? 0.25 : 0}
        filter="blur(5px)"
        className="transition-all duration-500"
      />
      
      {/* Main Pill Shape with Navy Blue border and Gradient Fill */}
      <rect
        x={-width / 2}
        y={-height / 2}
        width={width}
        height={height}
        rx={rx}
        fill={isActive ? 'url(#pin-gradient-selected)' : isHovered ? 'url(#pin-gradient-hover)' : 'url(#pin-gradient-default)'}
        stroke={strokeColor}
        strokeWidth={isActive ? 2 : 1.5}
        className="transition-all duration-500 shadow-sm"
      />

      {!isMobile && labelConfig && !labelConfig.hidden && (
        <text
          x={labelConfig.anchorX - x}
          y={labelConfig.anchorY - y}
          textAnchor="middle"
          className="transition-all duration-300 pointer-events-none"
          style={{
            fontSize: 11,
            letterSpacing: 0.5,
            textTransform: 'uppercase' as const,
            fill: labelConfig.fill,
            fontWeight: 700,
            filter: `drop-shadow(${labelConfig.textShadow})`,
          }}
        >
          {city.name}
        </text>
      )}
      {!isMobile && labelConfig?.hidden && (isActive || isHovered) && (
        <text
          y={12 / 2 + 14}
          textAnchor="middle"
          className="transition-all duration-300 pointer-events-none"
          style={{
            fontSize: 11,
            letterSpacing: 0.5,
            textTransform: 'uppercase' as const,
            fill: '#003849',
            fontWeight: 700,
            filter: 'drop-shadow(0 0 2px rgba(255,255,255,0.8))',
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
    onCityNavigate,
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
  const { isMobile } = useViewport();

  // Size: driven by ResizeObserver on root div; fallback to props if provided
  const [size, setSize] = useState({
    width: widthProp ?? 900,
    height: heightProp ?? 700,
  });
  const [labelConfigs, setLabelConfigs] = useState<Record<string, LabelConfig>>({});

  const [cardLayout, setCardLayout] = useState<CardLayout | null>(null);

  const selectedCityData = useMemo(() => {
    if (!selectedCity) return null;
    return cities.find(c => c.name === selectedCity);
  }, [selectedCity, cities]);

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
        setError(err.message || 'Error al cargar los datos del mapa');
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

  // Label placement: run after D3 has drawn .spain-shape so isPointInFill works
  useEffect(() => {
    if (!svgRef.current || !geoData || !projection) return;
    const svgEl = svgRef.current;
    const spainEl = svgEl.querySelector<SVGGeometryElement>('.spain-shape');
    if (!spainEl) return;

    // Sort cities by population descending — higher priority gets label first
    const sorted = [...cities].sort((a, b) => (b.population ?? 0) - (a.population ?? 0));

    const placedRects: LabelRect[] = [];
    const result: Record<string, LabelConfig> = {};

    for (const city of sorted) {
      const [lon, lat] = transformCanaryCoords(
        city.geoCoords.longitude,
        city.geoCoords.latitude,
        isMobile,
      );
      const p = projection([lon, lat]);
      if (!p) continue;
      const [px, py] = p;

      const pinW = isMobile ? 12 : 14;
      const pinH = isMobile ? 10 : 12;
      const textWidth = city.name.length * 7;
      const candidates = computeLabelCandidates(px, py, pinW, pinH, textWidth);

      let chosen: ReturnType<typeof computeLabelCandidates>[0] | null = null;
      let chosenIsLand = false;

      for (const candidate of candidates) {
        const { rect } = candidate;
        const samplePoints: [number, number][] = [
          [rect.x, rect.y],
          [rect.x + rect.width, rect.y],
          [rect.x, rect.y + rect.height],
          [rect.x + rect.width, rect.y + rect.height],
          [rect.x + rect.width / 2, rect.y + rect.height / 2],
        ];

        const onLand = samplePoints.map(([x, y]) =>
          spainEl.isPointInFill(new DOMPoint(x, y)),
        );
        const allLand = onLand.every(Boolean);
        const allSea = onLand.every(v => !v);

        if ((allLand || allSea) && !placedRects.some(r => rectsOverlap(r, rect))) {
          chosen = candidate;
          chosenIsLand = allLand;
          break;
        }
      }

      if (chosen) {
        placedRects.push(chosen.rect);
        result[city.name] = {
          anchorX: chosen.anchorX,
          anchorY: chosen.anchorY,
          fill: chosenIsLand ? '#1a2a1a' : 'rgba(255,255,255,0.9)',
          textShadow: chosenIsLand
            ? '0 0 4px rgba(255,255,255,0.6)'
            : '0 1px 3px rgba(0,0,0,0.8)',
          hidden: false,
        };
      } else {
        result[city.name] = {
          anchorX: px,
          anchorY: py + pinH / 2 + 17,
          fill: '#003849',
          textShadow: '0 0 2px rgba(255,255,255,0.8)',
          hidden: true,
        };
      }
    }

    setLabelConfigs(result);
  }, [geoData, projection, size, cities, isMobile]);

  // Calculate connector layout for desktop using smart card placement
  useEffect(() => {
    if (!selectedCityData || !projection || isMobile || !svgRef.current) {
      setCardLayout(null);
      return;
    }
    const svgEl = svgRef.current;
    const spainEl = svgEl.querySelector<SVGGeometryElement>('.spain-shape');
    if (!spainEl) {
      setCardLayout(null);
      return;
    }

    const [lon, lat] = transformCanaryCoords(
      selectedCityData.geoCoords.longitude,
      selectedCityData.geoCoords.latitude,
      isMobile,
    );
    const p = projection([lon, lat]);
    if (!p) { setCardLayout(null); return; }
    const [px, py] = p;

    const cardW = 270;
    const cardH = 310;
    const gap = 40;
    const margin = 16;

    const candidateCards = [
      { cardX: px + gap + cardW / 2, cardY: py },
      { cardX: px - gap - cardW / 2, cardY: py },
      { cardX: px + gap + cardW / 2, cardY: py - cardH / 2 },
      { cardX: px - gap - cardW / 2, cardY: py - cardH / 2 },
      { cardX: px + gap + cardW / 2, cardY: py + cardH / 2 },
      { cardX: px - gap - cardW / 2, cardY: py + cardH / 2 },
      { cardX: size.width * 0.82, cardY: size.height * 0.28 },
      { cardX: size.width * 0.18, cardY: size.height * 0.28 },
      { cardX: size.width * 0.82, cardY: size.height * 0.72 },
      { cardX: size.width * 0.18, cardY: size.height * 0.72 },
    ];

    let chosen: { cardX: number; cardY: number } | null = null;
    let minLandCorners = Infinity;

    for (const candidate of candidateCards) {
      const { cardX, cardY } = candidate;
      const left = cardX - cardW / 2;
      const top = cardY - cardH / 2;
      const right = cardX + cardW / 2;
      const bottom = cardY + cardH / 2;

      if (left < margin || top < margin || right > size.width - margin || bottom > size.height - margin) {
        continue;
      }

      const corners: [number, number][] = [
        [left, top], [right, top], [left, bottom], [right, bottom],
      ];
      const landCorners = corners.filter(([x, y]) =>
        spainEl.isPointInFill(new DOMPoint(x, y)),
      ).length;

      if (landCorners === 0) {
        chosen = candidate;
        break;
      }
      if (landCorners < minLandCorners) {
        minLandCorners = landCorners;
        chosen = candidate;
      }
    }

    // Fallback: use bottom-right sea corner if all candidates were OOB
    if (!chosen) {
      chosen = { cardX: size.width * 0.82, cardY: size.height * 0.72 };
    }

    const { cardX, cardY } = chosen;
    const toRight = cardX > px;
    const diagSize = 30;
    const p2x = toRight ? px + diagSize : px - diagSize;
    const p2y = cardY <= py ? py - diagSize : py + diagSize;
    const p3x = toRight ? cardX - cardW / 2 : cardX + cardW / 2;
    const p3y = p2y;
    const p4x = p3x;
    const p4y = cardY <= py ? cardY + cardH / 2 : cardY - cardH / 2;

    setCardLayout({
      px, py, cardX, cardY, cardW, cardH,
      connectorPath: `M ${px} ${py} L ${p2x} ${p2y} L ${p3x} ${p3y} L ${p4x} ${p4y}`,
    });
  }, [selectedCityData, projection, isMobile, size, geoData]);

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
          title="Mapa no disponible"
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
        {/* Pin Gradients and Map Gradient */}
        <defs>
          <linearGradient id="map-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#BFDDCE" />
            <stop offset="100%" stopColor="#FBF6EF" />
          </linearGradient>

          {/* Default State: Dark Green Gradient */}
          <linearGradient id="pin-gradient-default" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#04c7c1" />
            <stop offset="100%" stopColor="#027A76" />
          </linearGradient>

          {/* Hover State: Vibrant Green-Teal Gradient */}
          <linearGradient id="pin-gradient-hover" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#4dfcf6" />
            <stop offset="100%" stopColor="#039692" />
          </linearGradient>

          {/* Selected State: Deep Red Gradient */}
          <linearGradient id="pin-gradient-selected" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ff7073" />
            <stop offset="100%" stopColor="#AF4749" />
          </linearGradient>
        </defs>

        {/* g.map-base is managed by D3 (see useEffect above) */}
        <g className="map-base" />

        {/* Connector Line */}
        {cardLayout && (
          <path
            key={`connector-${selectedCity}`}
            d={cardLayout.connectorPath}
            fill="none"
            stroke="white"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              strokeDasharray: 1000,
              strokeDashoffset: 1000,
              animation: 'draw-connector 0.4s ease-out forwards',
            }}
          />
        )}

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
                labelConfig={labelConfigs[city.name]}
                onClick={handlePinClick}
                onHover={handlePinHover}
              />
            );
          })}
      </svg>

      {/* Floating City Card for Desktop */}
      {!isMobile && selectedCityData && cardLayout && (
        <div
          key={`card-${selectedCity}`}
          className="absolute z-50"
          style={{
            left: cardLayout.cardX - cardLayout.cardW / 2,
            top: cardLayout.cardY - cardLayout.cardH / 2,
            width: cardLayout.cardW,
            height: cardLayout.cardH,
            pointerEvents: 'auto',
            animation: 'card-appear 0.3s ease-out 0.05s both',
          }}
        >
          <CityCard
            city={selectedCityData}
            position={0}
            panel={true}
            onCityNavigate={onCityNavigate}
          />
        </div>
      )}
    </div>
  );
};

export default SpainMap;
