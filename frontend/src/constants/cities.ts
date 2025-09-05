export interface CityData {
  name: string;
  path: string;
  mapCoords: { x: number; y: number };
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
      population: 3223000,
      budget: 2500000,
      cyclingNetwork: 45,
      coverage: 18
    },
    { 
      name: "Barcelona", 
      path: "/map/barcelona", 
      mapCoords: { x: 909.1, y: 85.3 },
      population: 1620000,
      budget: 1800000,
      cyclingNetwork: 38,
      coverage: 22
    },
    { 
      name: "Valencia", 
      path: "/map/valencia", 
      mapCoords: { x: 545.5, y: 505.6 },
      population: 789000,
      budget: 1200000,
      cyclingNetwork: 25,
      coverage: 15
    },
    { 
      name: "Zaragoza", 
      path: "/map/zaragoza", 
      mapCoords: { x: 700, y: 150 },
      population: 675000,
      budget: 900000,
      cyclingNetwork: 20,
      coverage: 12
    },
    { 
      name: "A Coruña", 
      path: "/map/acoruña", 
      mapCoords: { x: 90.9, y: 812.6 },
      population: 245000,
      budget: 500000,
      cyclingNetwork: 15,
      coverage: 8
    },
    { 
      name: "Alicante", 
      path: "/map/alicante", 
      mapCoords: { x: 600, y: 450 },
      population: 337000,
      budget: 600000,
      cyclingNetwork: 18,
      coverage: 10
    },
    { 
      name: "Murcia", 
      path: "/map/murcia", 
      mapCoords: { x: 550, y: 500 },
      population: 447000,
      budget: 750000,
      cyclingNetwork: 22,
      coverage: 13
    },
    { 
      name: "Málaga", 
      path: "/map/malaga", 
      mapCoords: { x: 400, y: 350 },
      population: 578000,
      budget: 850000,
      cyclingNetwork: 28,
      coverage: 16
    },
    { 
      name: "León", 
      path: "/map/leon", 
      mapCoords: { x: 300, y: 250 },
      population: 124000,
      budget: 300000,
      cyclingNetwork: 12,
      coverage: 6
    },
    { 
      name: "Las Palmas", 
      path: "/map/laspalmas", 
      mapCoords: { x: 200, y: 750 },
      population: 378000,
      budget: 650000,
      cyclingNetwork: 16,
      coverage: 9
    },
];