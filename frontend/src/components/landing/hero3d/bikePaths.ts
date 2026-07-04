// B4C logo geometry, copied from AnimatedB4CLogo.tsx (viewBox 210x297).
// delay = when each element starts drawing, ms; strokes draw over STROKE_MS.

export const VIEWBOX = { w: 210, h: 297 };
export const STROKE_MS = 550;
export const DRAW_TOTAL_MS = 1590; // last stroke: 1040ms delay + 550ms draw

export type BikeElement =
  | { kind: 'circle'; cx: number; cy: number; r: number; width: number; delay: number }
  | { kind: 'path'; d: string; width: number; delay: number }
  | { kind: 'fill'; d: string; delay: number };

export const BIKE_ELEMENTS: BikeElement[] = [
  // Wheels
  { kind: 'circle', cx: 51.57188, cy: 239.64207, r: 31.599552, width: 10.2759, delay: 0 },
  { kind: 'circle', cx: 156.01056, cy: 186.93922, r: 31.599552, width: 10.2759, delay: 120 },
  // Frame
  { kind: 'path', d: 'm 50.846601,236.49926 13.054839,-53.18638 50.28529,-26.10967 14.02187,14.98889 c 0,0 12.57132,13.05484 27.56021,12.57132', width: 10.2759, delay: 240 },
  { kind: 'path', d: 'm 57.615774,177.02723 43.999646,44.48314 16.92292,-61.40608', width: 10.2759, delay: 340 },
  { kind: 'path', d: 'M 50.363097,237.46628 101.1319,221.99388', width: 10.2759, delay: 420 },
  { kind: 'path', d: 'm 104.03298,146.80769 11.6043,11.84606', width: 10.2759, delay: 460 },
  { kind: 'path', d: 'm 83.725453,143.66485 15.472397,-7.49444 c 0,0 9.42849,-0.96702 5.80215,12.32959', width: 10.2759, delay: 500 },
  // Handlebar / fork
  { kind: 'path', d: 'M 40.191901,59.994455 101.34225,137.33773 74.243549,60.246923', width: 6.42242, delay: 560 },
  { kind: 'path', d: 'M 129.99901,60.228186 102.79279,135.88719', width: 6.42242, delay: 620 },
  { kind: 'path', d: 'm 74.243549,60.246923 c 0,0 1.422686,-31.062096 27.340451,-45.237861', width: 6.42242, delay: 680 },
  { kind: 'path', d: 'm 129.99901,60.228186 c 0,0 -1.67437,-32.886906 -27.83793,-45.219124', width: 6.42242, delay: 720 },
  { kind: 'path', d: 'm 164.56397,59.74112 -61.5942,77.35629', width: 6.42242, delay: 760 },
  // Saddle (filled)
  { kind: 'fill', d: 'm 54.19147,180.87018 c -2.010069,-1.91387 -6.180102,-0.55439 -7.793595,-0.15447 0,0 -10.706602,-0.38971 -5.502575,-6.06523 14.806373,-16.14787 28.224485,-14.54298 24.4,-10.49742 -5.722553,6.05332 -3.886711,9.40213 -3.886711,9.40213 z', delay: 820 },
  // Rim arcs
  { kind: 'path', d: 'm 39.181097,59.74112 c 0,0 7.029138,-43.88701 62.661403,-44.607939', width: 10.2759, delay: 840 },
  { kind: 'path', d: 'm 164.05066,59.975718 c 0,0 -18.09574,9.197451 -34.05165,0.252468', width: 10.2759, delay: 880 },
  { kind: 'path', d: 'm 129.99901,60.228186 c 0,0 -9.89623,7.952301 -28.29457,7.484755', width: 10.2759, delay: 920 },
  { kind: 'path', d: 'm 164.56397,59.74112 c 0,0 -7.02912,-43.88701 -62.66139,-44.607939', width: 10.2759, delay: 960 },
  { kind: 'path', d: 'm 40.191901,59.994455 c 0,0 18.09574,9.19745 34.051648,0.252468', width: 10.2759, delay: 1000 },
  { kind: 'path', d: 'm 74.243549,60.246923 c 0,0 10.451862,7.913889 28.850221,7.446337', width: 10.2759, delay: 1040 },
];
