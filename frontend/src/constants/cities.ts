export interface CityData {
  name: string;
  path: string;
  mapCoords: { x: number; y: number }; // Legacy pixel coordinates (deprecated)
  geoCoords: { longitude: number; latitude: number }; // Real geographic coordinates
  maxBounds?: [[number, number], [number, number]]; // [sw[lng, lat], ne[lng, lat]]
  population: number;
  budget: number;
  cyclingNetwork: number;
  coverage: number;
}

export const CITIES: CityData[] = [
  {
    name: "Madrid",
    path: "/map/madrid",
    mapCoords: { x: 639.4, y: 241.6 },
    geoCoords: { longitude: -3.7026, latitude: 40.4165 },
    maxBounds: [[-3.9199, 40.2768], [-3.4866, 40.6476]], // Exact bounds of Madrid features
    population: 3223000,
    budget: 2500000,
    cyclingNetwork: 45,
    coverage: 18
  },
  {
    name: "Barcelona",
    path: "/map/barcelona",
    mapCoords: { x: 909.1, y: 85.3 },
    geoCoords: { longitude: 2.1734, latitude: 41.3851 },
    population: 1620000,
    budget: 1800000,
    cyclingNetwork: 38,
    coverage: 22
  },
  {
    name: "Valencia",
    path: "/map/valencia",
    mapCoords: { x: 545.5, y: 505.6 },
    geoCoords: { longitude: -0.3763, latitude: 39.4699 },
    population: 789000,
    budget: 1200000,
    cyclingNetwork: 25,
    coverage: 15
  },
  {
    name: "Zaragoza",
    path: "/map/zaragoza",
    mapCoords: { x: 700, y: 150 },
    geoCoords: { longitude: -0.8773, latitude: 41.6488 },
    population: 675000,
    budget: 900000,
    cyclingNetwork: 20,
    coverage: 12
  },
  {
    name: "A Coruña",
    path: "/map/acoruña",
    mapCoords: { x: 90.9, y: 812.6 },
    geoCoords: { longitude: -8.4115, latitude: 43.3623 },
    population: 245000,
    budget: 500000,
    cyclingNetwork: 15,
    coverage: 8
  },
  {
    name: "Alicante",
    path: "/map/alicante",
    mapCoords: { x: 600, y: 450 },
    geoCoords: { longitude: -0.4817, latitude: 38.3452 },
    population: 337000,
    budget: 600000,
    cyclingNetwork: 18,
    coverage: 10
  },
  {
    name: "Murcia",
    path: "/map/murcia",
    mapCoords: { x: 550, y: 500 },
    geoCoords: { longitude: -1.1307, latitude: 37.9922 },
    population: 447000,
    budget: 750000,
    cyclingNetwork: 22,
    coverage: 13
  },
  {
    name: "Málaga",
    path: "/map/malaga",
    mapCoords: { x: 400, y: 350 },
    geoCoords: { longitude: -4.4214, latitude: 36.7213 },
    population: 578000,
    budget: 850000,
    cyclingNetwork: 28,
    coverage: 16
  },
  {
    name: "León",
    path: "/map/leon",
    mapCoords: { x: 300, y: 250 },
    geoCoords: { longitude: -5.5663, latitude: 42.5987 },
    population: 124000,
    budget: 300000,
    cyclingNetwork: 12,
    coverage: 6
  },
  {
    name: "Las Palmas",
    path: "/map/laspalmas",
    mapCoords: { x: 200, y: 750 },
    geoCoords: { longitude: -15.4138, latitude: 28.1248 },
    population: 378000,
    budget: 650000,
    cyclingNetwork: 16,
    coverage: 9
  },
];