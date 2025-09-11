import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { CITIES } from '../../constants/cities';

interface SpainMapProps {
  width: number;
  height: number;
  onCityClick?: (cityName: string) => void;
  selectedCity?: string | null;
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

// Simplified Spain GeoJSON (you'll want to replace this with a proper Spain GeoJSON)
const SPAIN_GEOJSON = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { name: "Spain" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-9.5, 43.8], [-7.0, 43.8], [-1.8, 43.4], [3.3, 42.4],
          [3.3, 41.9], [2.1, 41.4], [0.7, 41.6], [0.3, 39.5],
          [-0.5, 38.3], [-1.1, 38.0], [-4.4, 36.7], [-5.6, 36.0],
          [-6.2, 36.0], [-7.1, 37.1], [-7.5, 39.3], [-9.5, 41.9],
          [-8.9, 42.1], [-9.0, 43.0], [-9.5, 43.8]
        ]]
      }
    }
  ]
};

const SpainMap: React.FC<SpainMapProps> = ({
  width,
  height,
  onCityClick,
  selectedCity,
  className = ''
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;

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

    // Draw Spain outline
    g.selectAll(".country")
      .data(SPAIN_GEOJSON.features)
      .enter()
      .append("path")
      .attr("class", "country")
      .attr("d", d => path(d as any) || "")
      .style("fill", "rgba(255, 255, 255, 0.1)")
      .style("stroke", "rgba(255, 255, 255, 0.3)")
      .style("stroke-width", 2);

    // Add cities
    const cityCoordinates = getCityCoordinates();
    g.selectAll(".city")
      .data(cityCoordinates)
      .enter()
      .append("circle")
      .attr("class", "city")
      .attr("cx", d => {
        const projected = projection(d.coordinates);
        return projected ? projected[0] : 0;
      })
      .attr("cy", d => {
        const projected = projection(d.coordinates);
        return projected ? projected[1] : 0;
      })
      .attr("r", 8)
      .style("fill", "var(--green)")
      .style("stroke", d => selectedCity === d.name ? "var(--yellow)" : "rgba(255, 255, 255, 0.8)")
      .style("stroke-width", d => selectedCity === d.name ? 4 : 2)
      .style("cursor", "pointer")
      .style("transition", "all 0.3s ease")
      .on("mouseover", function(_, d) {
        d3.select(this)
          .transition()
          .duration(200)
          .attr("r", 12);
        
        // Show tooltip
        const tooltip = g.append("g")
          .attr("class", "tooltip")
          .attr("transform", () => {
            const projected = projection(d.coordinates);
            return projected ? `translate(${projected[0]}, ${projected[1] - 20})` : "translate(0,0)";
          });

        tooltip.append("rect")
          .attr("x", -30)
          .attr("y", -15)
          .attr("width", 60)
          .attr("height", 20)
          .attr("rx", 5)
          .style("fill", "rgba(255, 255, 255, 0.9)")
          .style("stroke", "rgba(0, 0, 0, 0.2)");

        tooltip.append("text")
          .attr("text-anchor", "middle")
          .attr("y", -2)
          .style("font-size", "12px")
          .style("fill", "#333")
          .text(d.name);
      })
      .on("mouseout", function() {
        d3.select(this)
          .transition()
          .duration(200)
          .attr("r", 8);
        
        g.select(".tooltip").remove();
      })
      .on("click", function(_, d) {
        if (onCityClick) {
          onCityClick(d.name);
        }
      });

  }, [width, height, selectedCity, onCityClick]);

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      className={className}
      style={{ overflow: 'visible' }}
    />
  );
};

export default SpainMap;
