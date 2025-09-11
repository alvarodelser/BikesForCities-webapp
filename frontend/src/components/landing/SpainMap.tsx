import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { CITIES } from '../../constants/cities';
import CityPin from '../ui/CityPin';
import spainGeoJSON from '../../data/spain-provinces.geojson?url';

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
  const possiblePaths = [
    spainGeoJSON, // Bundled asset URL (most reliable)
    '/data/spain-provinces.geojson',
    './data/spain-provinces.geojson',
    `${import.meta.env.BASE_URL}data/spain-provinces.geojson`
  ];

  for (const path of possiblePaths) {
    try {
      console.log(`Trying to fetch GeoJSON from: ${path}`);
      const response = await fetch(path);
      if (response.ok) {
        const data = await response.json();
        console.log(`Successfully loaded GeoJSON from: ${path}`);
        return data;
      } else {
        console.warn(`Failed to fetch from ${path}: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.warn(`Error fetching from ${path}:`, error);
    }
  }
  
  console.error('Failed to load Spain GeoJSON from all possible paths');
  return null;
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load GeoJSON data
  useEffect(() => {
    console.log('SpainMap: Loading GeoJSON data...');
    setLoading(true);
    loadSpainGeoJSON().then(data => {
      if (data) {
        console.log('SpainMap: GeoJSON data loaded successfully', data);
        setGeoData(data);
        setError(null);
      } else {
        console.error('SpainMap: Failed to load GeoJSON data');
        setError('Failed to load map data');
      }
      setLoading(false);
    }).catch(err => {
      console.error('SpainMap: Error loading GeoJSON:', err);
      setError(`Error loading map: ${err.message}`);
      setLoading(false);
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

  // Show loading state
  if (loading) {
    return (
      <div className={`relative ${className} flex items-center justify-center bg-gray-100 rounded-lg`} style={{ width, height }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Spain map...</p>
        </div>
      </div>
    );
  }

  // Show error state with fallback
  if (error || !geoData) {
    return (
      <div className={`relative ${className}`} style={{ width, height }}>
        {/* Fallback: Show cities without map background */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-green-50 rounded-lg flex items-center justify-center">
          <div className="text-center mb-8">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Spain Cities</h3>
            {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
          </div>
        </div>
        
        {/* Show cities in a grid layout as fallback */}
        <div className="absolute inset-0 p-8">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 h-full items-center justify-items-center">
            {getCityCoordinates().map((city) => (
              <div key={city.name} className="transform hover:scale-105 transition-transform">
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
            ))}
          </div>
        </div>
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
