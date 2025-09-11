import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { CITIES } from '../../constants/cities';
import CityPin from '../ui/CityPin';

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
    const response = await fetch('/data/spain-provinces.geojson');
    return await response.json();
  } catch (error) {
    console.error('Error loading Spain GeoJSON:', error);
    return null;
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

  // Load GeoJSON data
  useEffect(() => {
    loadSpainGeoJSON().then(data => {
      if (data) {
        setGeoData(data);
      }
    });
  }, []);

  useEffect(() => {
    if (!svgRef.current || !geoData) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clear previous render

    // Set up projection for Spain
    const projection = d3.geoMercator()
      .center([-3.5, 40]) // Center on Spain
      .scale(2800) // Adjust scale for Spain
      .translate([width / 2, height / 2]);

    const path = d3.geoPath().projection(projection);

    // Create main group
    const g = svg.append("g");

    // Draw Spain provinces
    g.selectAll(".province")
      .data(geoData.features)
      .enter()
      .append("path")
      .attr("class", "province")
      .attr("d", d => path(d as any) || "")
      .style("fill", "rgba(191, 221, 206, 1)")
      .style("stroke", "rgba(191, 221, 206, 0.4)")
      .style("stroke-width", 1);

    // Store projection for React components to use
    (svg.node() as any).__projection = projection;

  }, [width, height, selectedCity, onCityClick, geoData]);

  // Get projection from SVG for positioning pins
  const projection = svgRef.current ? (svgRef.current as any).__projection : null;

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
        const projected = projection(city.coordinates);
        if (!projected) return null;

        return (
          <div
            key={city.name}
            className="absolute"
            style={{
              left: projected[0] - 25, // Center the pin
              top: projected[1] - 25,
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
            />
          </div>
        );
      })}
    </div>
  );
};

export default SpainMap;
