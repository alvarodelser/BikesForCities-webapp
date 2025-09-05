✅ Step 5 — Map Rendering (Fully Expanded)
🔀 Overview
You have two main tools for rendering maps in React:
Tool	Best For
Leaflet	Quick, user-friendly, full-tile maps with layers and controls
D3.js	Full control over SVG-based rendering and custom visuals
Your project may benefit from Leaflet for base maps and D3 for overlays (e.g., data-driven bicycle networks).
We’ll split this into two parts:

🌍 Part A — Map Rendering with Leaflet
🎯 Use Case
You want to:
Show an interactive city map (from OpenStreetMap)
Zoom in/out, pan, click segments
Possibly add markers, popups, or overlays
✅ 1. Install Leaflet + Types
npm install leaflet
npm install --save-dev @types/leaflet
If you use React + Leaflet bindings, also:
npm install react-leaflet
But for learning purposes, let's first build it using vanilla Leaflet via refs.
✅ 2. Minimal Leaflet Map in React
import { useEffect, useRef } from "react";
import L from "leaflet";

export function CityMap() {
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    const map = L.map(mapRef.current).setView([41.6488, -0.8891], 13); // Zaragoza coords

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    return () => map.remove(); // Cleanup on unmount
  }, []);

  return <div ref={mapRef} style={{ height: "400px" }} />;
}
📘 Key Concepts:
✅ useRef
Used to hold a reference to the DOM node
Pass this to Leaflet.map() so it knows where to render
✅ useEffect
Used because Leaflet is imperative (not declarative like React)
Runs once when the component mounts
✅ Cleanup
Very important! Call map.remove() when the component unmounts
🧪 Add a Marker (Optional)
L.marker([41.6488, -0.8891])
  .addTo(map)
  .bindPopup("Zaragoza")
  .openPopup();
You can also create custom icons or bind events (onClick, etc.)
🌱 Bonus: Style Customization
Change tile layers to grayscale
Add a semi-transparent overlay
Draw polygons for neighborhoods or green corridors
🔄 When to Use react-leaflet Instead
If:
You want cleaner React syntax (<MapContainer />, <TileLayer />, etc.)
You need tight integration with React hooks and state
You want to avoid manual ref management
But you lose some raw control, which may be useful when combining with D3.
🧠 Academic Use for Leaflet
You can:
Highlight areas of poor bike infrastructure
Add clickable overlays to show stats
Let users explore city-wide bicycle networks and zoom into their neighborhood
📦 Component Skeleton for Your Project
// src/components/CityMap.tsx
export function CityMap({ city }: { city: City }) {
  // eventually fetch and display segment overlays for the city
  ...
}
Keep map components small — push overlays, interactivity, and configuration into child components or hooks.
📘 Summary of Leaflet Integration
Concept	Explanation
useRef	DOM access for non-React libs
useEffect	Lifecycle setup & teardown
Tile layer	Base map (from OSM or other)
Markers/layers	Data overlays for cities
Cleanup	Prevents memory leaks
Componentization	Split map logic cleanly
📌 When Not to Use Leaflet
If you don’t need pan/zoom or tile-based rendering
If you're doing custom visuals (e.g., animate segments, encode color by score)
Then you move to...
🟠 Part B — Map Rendering with D3.js
🎯 Use Case
You want to:
Draw custom overlays (paths, segments, shapes)
Encode data visually (e.g., color a segment by safety index)
Animate changes between cities
D3 is great when you need to control every visual detail — think data-driven SVG.
✅ 1. Conceptual Difference
D3:
Manipulates SVG elements based on data
You bind data → DOM, then encode attributes (e.g., color, size, position)
Integrates with React, but requires discipline (don't let D3 "own" the DOM)
✅ 2. Example: Drawing Bike Segments in SVG
Let’s assume you have some geoJSON-style segments:
export interface Segment {
  id: string;
  coords: [number, number][];
  safetyIndex: number;
}
🧱 Component with D3 in SVG
import { useEffect, useRef } from "react";
import * as d3 from "d3";

export function CitySegments({ segments }: { segments: Segment[] }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // clear on rerender

    const projection = d3.geoMercator()
      .center([-0.8891, 41.6488]) // Zaragoza
      .scale(200000)
      .translate([200, 200]);

    const line = d3.line<[number, number]>()
      .x(d => projection(d)[0])
      .y(d => projection(d)[1]);

    svg.selectAll("path")
      .data(segments)
      .join("path")
      .attr("d", d => line(d.coords))
      .attr("stroke", d => d3.interpolateWarm(d.safetyIndex / 100))
      .attr("stroke-width", 3)
      .attr("fill", "none");
  }, [segments]);

  return <svg ref={svgRef} width={400} height={400} />;
}
📘 Concepts
Concept	Meaning
geoMercator	Projects long/lat into pixel space
d3.line()	Converts [x, y] points into SVG path strings
attr("d", ...)	Draws the path
interpolateWarm	Maps data to color
useEffect	Makes D3 imperatively update DOM
🧠 Challenges with D3 + React
You need to manually sync props to DOM
You often reset SVG on every render
Use refs and useEffect to control lifecycle
✅ Pro Tip
For better encapsulation, consider using D3 in a custom hook:
useRenderSegments(svgRef, segments);
🧠 Academic Use for D3
You can:
Animate bike network growth over time
Encode safety, density, usage into lines
Create hover effects or tooltips
Build interactive overlays over a Leaflet map (hybrid!)
📌 When Not to Use D3
If all you need is:
Pan/zoom with markers
Tile maps
Simple geospatial shapes
Then Leaflet is simpler. But for custom visual storytelling → D3 is unmatched.
✅ Summary Table
Feature	Leaflet	D3.js
Pan/Zoom	✅ Built-in	❌ Manual
Tile-based base map	✅	❌
Visual customization	Limited	✅ Full control
Data encoding	Basic (circle size, color)	✅ Full (color scales, shape)
Projection math	Built-in	Manual with d3.geo*
React integration	Easy with react-leaflet	Manual via refs
Learning curve	Low–Medium	Medium–High


📊 Step 5.5 — Adding Charts to Your React App (Expanded Guide)
🎯 Goal
Integrate interactive charts into your React frontend to visualize metrics like cyclist usage, safety index, modal split, and time trends.
✅ What You’ll Learn
What charting libraries are best suited for your project
How to integrate them in a React + TypeScript app
How to structure data for charts
How to create reusable and accessible chart components
Example: Cyclist usage per city over time
🔍 1. Choosing the Right Charting Library
There are many, but these are the best trade-offs for you:
Library	Why Use It
Recharts	Easy to use, great with React + TS, flexible
Chart.js via react-chartjs-2	Good for polished static charts
[D3.js (custom)	Full control, but more complex
Nivo	Beautiful charts, great for dashboards
Visx	Low-level, best if you want full design freedom
➡️ Recommendation: Start with Recharts for line, bar, area, and pie charts.
🧱 2. Setup Recharts
npm install recharts
📦 3. Create a Reusable Chart Component
Example: Cyclists per city (bar chart)
// src/components/CityUsageChart.tsx
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

export interface CityUsageData {
  name: string;
  cyclists: number;
}

export function CityUsageChart({ data }: { data: CityUsageData[] }) {
  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="cyclists" fill="#027A76" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
🧪 Sample Data for Demo
const CITY_USAGE: CityUsageData[] = [
  { name: "Zaragoza", cyclists: 1280 },
  { name: "Barcelona", cyclists: 4210 },
  { name: "Madrid", cyclists: 3050 },
];
Use this in a Storybook story or demo page.
🧠 Educational Notes
✅ Chart Anatomy
Part	What it does
BarChart	The wrapper
XAxis/YAxis	Shows labels/scales
Tooltip	Shows values on hover
Bar	Visualizes the metric
ResponsiveContainer	Makes the chart adapt to screen size
✅ Color Semantics
Use your design colors:
fill="#F4A24C" // --yellow
fill="#FF7F50" // --orange
fill="#AF4749" // --red
Color-code according to metric or alert level (e.g., safety = red, usage = yellow).
💡 Examples You Might Build
Chart Type	Data
Line chart	Cyclist traffic over time
Area chart	Network coverage per city
Pie chart	Modal share (bike, car, walk)
Heat map (advanced)	Hourly usage patterns
Radar chart	Compare city scores
🏗️ Chart Integration Strategy
Organize charts like components:
/src/components/charts
  ├── CityUsageChart.tsx
  ├── NetworkCoverageChart.tsx
  └── ModalSplitPie.tsx
Keep:
types next to each chart
colors and formatting consistent (e.g., one formatNumber() util)
Recharts isolated from other logic
♿ Accessibility Tips
Add aria-label to charts if inside SVG
Provide text fallback or summary:
<p className="sr-only">Barcelona has 4,210 cyclists, the highest among the cities shown.</p>
Avoid color-only legends (use icons, patterns, or labels)
📘 Summary
Concept	Meaning
ResponsiveContainer	Makes charts mobile-friendly
Reusable component	Accept data prop and style cleanly
Chart semantics	Use color meaningfully and accessibly
Data shaping	Structure mock/fetched data to match chart needs
Chart storytelling	Use charts to surface patterns worth acting on
🎓 Academic Use for Charts
Showcase:
Change in bike network coverage over time
Compare cities by safety or modal share
Motivate policy priorities with visual trends
📘 Combine charts + map + text = persuasive data story
