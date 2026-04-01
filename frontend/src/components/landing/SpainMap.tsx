import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import type { CityData } from '../../constants/cities';
import CityPin from '../ui/CityPin';
import ErrorState from '../ui/ErrorState';
import spainGeoJSON from '../../assets/spain-provinces.geojson?url';

interface SpainMapProps {
  width: number;
  height: number;
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
}

// Convert city data to coordinate format for D3
const getCityCoordinates = (cities: CityData[]): CityCoordinates[] => {
  return cities.map(city => ({
    name: city.name,
    coordinates: [city.geoCoords.longitude, city.geoCoords.latitude]
  }));
};

// Constants for Canary Islands transformation
const CANARY_PROV_CODES = ["35", "38"];
const CANARY_LAT_OFFSET = 7.5;
const CANARY_LON_OFFSET = 0;

/**
 * Transforms coordinates for Canary Islands to move them closer to the mainland.
 * @param lon Longitude
 * @param lat Latitude
 * @param codProv Optional province code to force transformation
 */
const transformCanaryCoords = (lon: number, lat: number, codProv?: string): [number, number] => {
  // Canary Islands are approximately below 30N latitude
  // Or we can identify them by province code if available
  if (codProv && CANARY_PROV_CODES.includes(codProv)) {
    return [lon + CANARY_LON_OFFSET, lat + CANARY_LAT_OFFSET];
  }

  // Backup check by latitude range if no province code is provided (e.g. for city pins)
  if (!codProv && lat < 30) {
    return [lon + CANARY_LON_OFFSET, lat + CANARY_LAT_OFFSET];
  }

  return [lon, lat];
};

/**
 * Deeply transforms all coordinates in a GeoJSON geometry.
 */
const transformGeometry = (geometry: any, codProv: string) => {
  if (!geometry || !geometry.coordinates) return;

  let count = 0;
  const transform = (coords: any) => {
    if (!Array.isArray(coords)) return;

    if (coords.length === 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
      // It's a point [lon, lat]
      const [shiftedLon, shiftedLat] = transformCanaryCoords(coords[0], coords[1], codProv);
      coords[0] = shiftedLon;
      coords[1] = shiftedLat;
      count++;
    } else {
      // It's a nested array
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

      // Transform Canary Islands features in place
      if (data && data.features) {
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


const SpainMap: React.FC<SpainMapProps> = ({
  width,
  height,
  onCityClick,
  onCityNavigate,
  selectedCity,
  expandedCity,
  cities,
  className = ''
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [geoData, setGeoData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const projection = useMemo(() => {
    if (!width || !height) return null;
    return d3.geoMercator()
      .center([-3.5, 40])
      .scale(2800)
      .translate([width / 2, height / 2]);
  }, [width, height]);

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

  useEffect(() => {
    if (!svgRef.current || !geoData) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    const path = d3.geoPath().projection(projection);

    // draw map features (merged into a single MultiPolygon for a truly solid shape)
    const g = svg.append("g");
    
    // Add definitions for the gradient
    const defs = svg.append("defs");
    
    // Gradient definitions for a premium, high-contrast look
    const gradient = defs.append("linearGradient")
      .attr("id", "map-gradient")
      .attr("x1", "0%")
      .attr("y1", "0%")
      .attr("x2", "100%")
      .attr("y2", "100%");

    gradient.append("stop")
      .attr("offset", "0%")
      .style("stop-color", "#BFDDCE"); // var(--green-light)

    gradient.append("stop")
      .attr("offset", "100%")
      .style("stop-color", "#FBF6EF"); // var(--cream)




    // Create a single MultiPolygon from all features
    const mergedGeometry = {
      type: "MultiPolygon",
      coordinates: geoData.features.flatMap((f: any) => 
        f.geometry.type === "MultiPolygon" ? f.geometry.coordinates : [f.geometry.coordinates]
      )
    };

    g.append("path")
      .attr("class", "spain-shape")
      .datum(mergedGeometry)
      .attr("d", path as any)
      .style("fill", "url(#map-gradient)") // Premium gradient fill spanning the whole shape
      .style("stroke", "none") // No borders at all
      .style("opacity", 1.0);
  }, [geoData, projection]);  // projection already depends on width & height






  // Show error state with simple GlassCard
  if (error || !geoData || !projection) {
    return (
      <div className={`relative ${className} flex items-center justify-center`} style={{ width, height }}>
        <ErrorState
          title="Map Unavailable"
          message={error || 'Unable to load the Spain map at this time.'}
          showRetry={true}
        />
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} style={{ width, height }}>
      {/* SVG Map */}
      <svg
        ref={svgRef}
        width={width}
        height={height}
        style={{ overflow: 'visible' }}
      />

      {/* City Pins Overlay */}
      {projection && getCityCoordinates(cities).map((city) => {
        const [shiftedLon, shiftedLat] = transformCanaryCoords(city.coordinates[0], city.coordinates[1]);
        const p = projection([shiftedLon, shiftedLat]);
        if (!p) return null;
        return (
          <div
            key={city.name}
            className="absolute"
            style={{
              left: p[0] - 25, // Center the pin
              top: p[1] - 25,
              transform: 'translate(0, 0)', // Ensure precise positioning
            }}
          >
            <CityPin
              cityName={city.name}
              isSelected={selectedCity === city.name}
              isExpanded={expandedCity === city.name}
              variant="glassmorphic"
              size="md"
              onClick={() => onCityClick?.(city.name)}
              onNavigate={() => onCityNavigate?.(city.name)}
              tint="rgba(255, 255, 255, 0.1)"
              tintExpanded="rgba(244, 162, 76, 0.5)"
            />
          </div>
        );
      })}
    </div>
  );
};

export default SpainMap;
