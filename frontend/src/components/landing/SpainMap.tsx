import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { CITIES } from '../../constants/cities';
import CityPin from '../ui/CityPin';
import GlassCard from '../ui/GlassCard';
import spainGeoJSON from '../../assets/spain-provinces.geojson?url';

interface SpainMapProps {
  width: number;
  height: number;
  onCityClick?: (cityName: string) => void;
  onCityNavigate?: (cityName: string) => void;
  selectedCity?: string | null;
  expandedCity?: string | null;
  className?: string;
}

interface CityCoordinates {
  name: string;
  coordinates: [number, number]; // [longitude, latitude]
}

// Convert city data to coordinate format for D3
const getCityCoordinates = (): CityCoordinates[] => {
  return CITIES.map(city => ({
    name: city.name,
    coordinates: [city.geoCoords.longitude, city.geoCoords.latitude]
  }));
};

// Load Spain provinces GeoJSON data
const loadSpainGeoJSON = async () => {
  try {
    const response = await fetch(spainGeoJSON);
    if (response.ok) {
      return await response.json();
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

  // draw provinces
  const g = svg.append("g");
  g.selectAll(".province")
    .data(geoData.features)
    .enter()
    .append("path")
    .attr("class", "province")
    .attr("d", (d: any) => path(d) || "")
    .style("fill", "rgba(191, 221, 206, 1)")
    .style("stroke", "rgba(191, 221, 206, 0.4)")
    .style("stroke-width", 1);
}, [geoData, projection]);  // projection already depends on width & height

  // Show error state with simple GlassCard
  if (error || !geoData || !projection) {
    return (
      <div className={`relative ${className} flex items-center justify-center`} style={{ width, height }}>
        <GlassCard
          surface="glass"
          tint="rgba(225, 111, 111, 0.48)"
          className="p-8 text-center max-w-md"
        >
          <h3 className="text-xl font-semibold text-white mb-4">Map Unavailable</h3>
          <p className="text-white mb-6">
            {error || 'Unable to load the Spain map at this time.'}
          </p>
          <p className="text-sm text-white">
            Please try refreshing the page or explore our cities using the cards below.
          </p>
        </GlassCard>
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
      {projection && getCityCoordinates().map((city) => {
        const p = projection(city.coordinates);
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
