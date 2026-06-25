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
  cityName: string;
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

// Canary Islands province codes (Las Palmas, Santa Cruz de Tenerife)
const CANARY_PROV_CODES = ["35", "38"];

// Real geographic bounding box of the Canary archipelago, used both to fit the
// inset projection and to detect Canary cities. Corners: [west, north] / [east, south].
const CANARY_GEO_BOUNDS = {
  type: 'MultiPoint' as const,
  coordinates: [
    [-18.25, 29.5],
    [-13.3, 27.5],
  ],
};

// A city belongs to the Canary inset when it falls inside the archipelago bbox.
const isCanaryCity = (lon: number, lat: number): boolean => lon < -12 && lat < 30;

// Cache for the GeoJSON data to avoid redundant fetches
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedGeoJSON: any = null;

// Load Spain provinces GeoJSON data once — geometry is no longer mutated per viewport
const loadSpainGeoJSON = async () => {
  try {
    if (!cachedGeoJSON) {
      const response = await fetch(spainGeoJSON);
      if (!response.ok) {
        throw new Error(`Error al cargar la geometría: ${response.status}`);
      }
      cachedGeoJSON = await response.json();
    }
    return cachedGeoJSON;
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

  // Cream border color
  const strokeColor = '#FBF6EF';

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

  // Canary inset projection: the SAME projection as the mainland (identical scale),
  // only translated so the archipelago lands at the bottom-left corner. Because the
  // shared scale tracks the map size, the islands scale exactly like the peninsula
  // and always stay on screen regardless of viewport.
  const canaryProjection = useMemo(() => {
    if (!projection) return null;
    const { height } = size;
    const margin = 16;
    const [[west, north], [east, south]] = CANARY_GEO_BOUNDS.coordinates;
    // Project the archipelago bbox with the main projection to read its pixel footprint
    const nw = projection([west, north]);
    const se = projection([east, south]);
    if (!nw || !se) return null;
    const bboxLeft = Math.min(nw[0], se[0]);
    const bboxBottom = Math.max(nw[1], se[1]);
    // Pure pixel shift placing that footprint at the bottom-left corner
    const dx = margin - bboxLeft;
    const dy = height - margin - bboxBottom;
    const [tx, ty] = projection.translate();
    return d3.geoMercator()
      .center([-3.5, 40])
      .scale(projection.scale())
      .translate([tx + dx, ty + dy]);
  }, [projection, size]);

  // Unified screen position: Canary cities use the inset projection, the rest the main one.
  const cityScreenPos = useCallback((lon: number, lat: number): [number, number] | null => {
    const proj = isCanaryCity(lon, lat) ? canaryProjection : projection;
    if (!proj) return null;
    return proj([lon, lat]);
  }, [projection, canaryProjection]);

  // Load GeoJSON data
  useEffect(() => {
    loadSpainGeoJSON()
      .then(data => {
        setGeoData(data);
        setError(null);
      })
      .catch(err => {
        setError(err.message || 'Error al cargar los datos del mapa');
      });
  }, []);

  // Draw base map shape via D3, scoped to g.map-base to avoid wiping React pins
  useEffect(() => {
    if (!svgRef.current || !geoData || !projection || !canaryProjection) return;

    const svg = d3.select(svgRef.current);

    // Select the existing group (defined in JSX) and clear its content
    const g = svg.select('g.map-base');
    g.selectAll('*').remove();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buildMultiPolygon = (features: any[]) => ({
      type: 'MultiPolygon',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      coordinates: features.flatMap((f: any) =>
        f.geometry.type === 'MultiPolygon'
          ? f.geometry.coordinates
          : [f.geometry.coordinates],
      ),
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const isCanary = (f: any) => CANARY_PROV_CODES.includes(f.properties?.cod_prov);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const canaryFeatures = geoData.features.filter((f: any) => isCanary(f));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mainlandFeatures = geoData.features.filter((f: any) => !isCanary(f));

    const mainPath = d3.geoPath().projection(projection);
    const canaryPath = d3.geoPath().projection(canaryProjection);

    // Peninsula + Balearics — keeps the .spain-shape class used for land/sea hit-testing
    g.append('path')
      .attr('class', 'spain-shape')
      .datum(buildMultiPolygon(mainlandFeatures))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .attr('d', mainPath as any)
      .style('fill', 'url(#map-gradient)')
      .style('stroke', 'none')
      .style('opacity', 1.0);

    // Canary Islands inset — separate projection fitted to a fixed bottom-left box
    g.append('path')
      .attr('class', 'canary-shape')
      .datum(buildMultiPolygon(canaryFeatures))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .attr('d', canaryPath as any)
      .style('fill', 'url(#map-gradient)')
      .style('stroke', 'none')
      .style('opacity', 1.0);
  }, [geoData, projection, canaryProjection]);

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
      const p = cityScreenPos(city.geoCoords.longitude, city.geoCoords.latitude);
      if (!p) continue;
      const [px, py] = p;

      const pinW = isMobile ? 12 : 14;
      const pinH = isMobile ? 10 : 12;

      // Canary inset cities: label directly below the pin (no land/sea placement search)
      if (isCanaryCity(city.geoCoords.longitude, city.geoCoords.latitude)) {
        result[city.name] = {
          anchorX: px,
          anchorY: py + pinH / 2 + 17,
          fill: '#003849',
          textShadow: '0 0 2px rgba(255,255,255,0.8)',
          hidden: true,
        };
        continue;
      }

      const textWidth = city.name.length * 7;
      const candidates = computeLabelCandidates(px, py, pinW, pinH, textWidth);

      let chosen: ReturnType<typeof computeLabelCandidates>[0] | null = null;
      let chosenIsLand = false;

      const edgeMargin = 10;
      for (const candidate of candidates) {
        const { rect } = candidate;

        // Reject labels that would render outside the SVG viewport
        if (
          rect.x < edgeMargin ||
          rect.y < edgeMargin ||
          rect.x + rect.width > size.width - edgeMargin ||
          rect.y + rect.height > size.height - edgeMargin
        ) continue;

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

        // Add 3px padding around placed rect to prevent labels from touching
        const padded = { x: rect.x - 3, y: rect.y - 3, width: rect.width + 6, height: rect.height + 6 };
        if ((allLand || allSea) && !placedRects.some(r => rectsOverlap(r, padded))) {
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
  }, [geoData, projection, size, cities, isMobile, cityScreenPos]);

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

    const p = cityScreenPos(
      selectedCityData.geoCoords.longitude,
      selectedCityData.geoCoords.latitude,
    );
    if (!p) { setCardLayout(null); return; }
    const [px, py] = p;

    const cardW = 270;
    const cardH = 310;
    const gap = 40;
    const margin = 16;

    // Half-extents + margin: the minimum distance from an SVG edge to the card's centre
    const mx = cardW / 2 + margin;  // 151 px
    const my = cardH / 2 + margin;  // 171 px
    const W = size.width;
    const H = size.height;
    // py clamped so sea-edge candidates always stay within the viewport
    const safePy = Math.max(my, Math.min(H - my, py));

    const candidateCards = [
      // Pin-relative first (fast wins for coastal / peripheral cities)
      { cardX: px + gap + cardW / 2, cardY: py },
      { cardX: px - gap - cardW / 2, cardY: py },
      { cardX: px + gap + cardW / 2, cardY: py - cardH / 2 },
      { cardX: px - gap - cardW / 2, cardY: py - cardH / 2 },
      { cardX: px + gap + cardW / 2, cardY: py + cardH / 2 },
      { cardX: px - gap - cardW / 2, cardY: py + cardH / 2 },
      // Sea-edge positions — pre-clamped so they always pass the OOB check.
      // Tried when all pin-relative candidates land on Spain (e.g. inland cities).
      { cardX: W - mx, cardY: safePy },  // right sea edge (Mediterranean)
      { cardX: mx,     cardY: safePy },  // left sea edge (Atlantic)
      { cardX: W - mx, cardY: my },      // top-right
      { cardX: mx,     cardY: my },      // top-left
      { cardX: W - mx, cardY: H - my },  // bottom-right
      { cardX: mx,     cardY: H - my },  // bottom-left
    ];

    let chosen: { cardX: number; cardY: number } | null = null;
    let minLandCorners = Infinity;

    for (const candidate of candidateCards) {
      const { cardX, cardY } = candidate;
      const left = cardX - cardW / 2;
      const top = cardY - cardH / 2;
      const right = cardX + cardW / 2;
      const bottom = cardY + cardH / 2;

      if (left < margin || top < margin || right > W - margin || bottom > H - margin) {
        continue;
      }

      // Sample 9 points (corners + edge midpoints + center) for thorough overlap detection
      const samplePoints: [number, number][] = [
        [left, top], [right, top], [left, bottom], [right, bottom],
        [(left + right) / 2, top], [(left + right) / 2, bottom],
        [left, (top + bottom) / 2], [right, (top + bottom) / 2],
        [(left + right) / 2, (top + bottom) / 2],
      ];
      const landPoints = samplePoints.filter(([x, y]) =>
        spainEl.isPointInFill(new DOMPoint(x, y)),
      ).length;

      if (landPoints === 0) {
        chosen = candidate;
        break;
      }
      if (landPoints < minLandCorners) {
        minLandCorners = landPoints;
        chosen = candidate;
      }
    }

    // Fallback: right sea edge (never null because sea-edge candidates are pre-clamped)
    if (!chosen) {
      chosen = { cardX: W - mx, cardY: safePy };
    }

    const { cardX, cardY } = chosen;
    const cardLeft = cardX - cardW / 2;
    const cardRight = cardX + cardW / 2;
    const cardTop = cardY - cardH / 2;
    const cardBottom = cardY + cardH / 2;

    // Connector terminates at the nearest point on the card's border
    const clampedY = Math.max(cardTop, Math.min(cardBottom, py));
    const clampedX = Math.max(cardLeft, Math.min(cardRight, px));
    let edgeX: number, edgeY: number;
    if (px < cardLeft)       { edgeX = cardLeft;  edgeY = clampedY; }
    else if (px > cardRight) { edgeX = cardRight; edgeY = clampedY; }
    else if (py < cardTop)   { edgeX = clampedX;  edgeY = cardTop;  }
    else                     { edgeX = clampedX;  edgeY = cardBottom; }

    setCardLayout({
      cityName: selectedCityData.name,
      px, py, cardX, cardY, cardW, cardH,
      connectorPath: `M ${px} ${py} L ${edgeX} ${edgeY}`,
    });
  }, [selectedCityData, projection, isMobile, size, geoData, cityScreenPos]);

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

        {/* Connector Line — only renders when layout matches current city to ensure animation fires at the correct position */}
        {cardLayout && cardLayout.cityName === selectedCity && (
          <path
            key={`connector-${selectedCity}`}
            d={cardLayout.connectorPath}
            pathLength={1}
            fill="none"
            stroke="white"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              strokeDasharray: 1,
              strokeDashoffset: 1,
              animation: 'draw-connector 0.4s ease-out forwards',
              filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.7))',
            }}
          />
        )}

        {/* City Pins — inside SVG, sibling to g.map-base, not affected by D3 cleanup */}
        {projection &&
          getCityCoordinates(cities).map(city => {
            const p = cityScreenPos(city.coordinates[0], city.coordinates[1]);
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

      {/* Floating City Card for Desktop — only renders when layout matches current city */}
      {!isMobile && selectedCityData && cardLayout && cardLayout.cityName === selectedCity && (
        <div
          key={`card-${selectedCity}`}
          className="absolute z-50"
          style={{
            left: cardLayout.cardX - cardLayout.cardW / 2,
            top: cardLayout.cardY - cardLayout.cardH / 2,
            width: cardLayout.cardW,
            height: cardLayout.cardH,
            pointerEvents: 'auto',
            animation: 'card-appear 0.3s ease-out 0.4s both',
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
