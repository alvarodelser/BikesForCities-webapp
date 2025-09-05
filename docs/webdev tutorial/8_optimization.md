⚡️ Step 8 — Optimization Round (Expanded)
🎯 Goal
Improve the performance, responsiveness, and load speed of your frontend — particularly after you've integrated all core features (map, charts, API, routing, etc.).
Optimization isn’t just about milliseconds — it's about:
Reducing waiting time for users
Keeping the experience smooth on slow devices
Ensuring accessibility and usability for all
⚠️ Don't optimize prematurely — focus on measurable gains.
🧠 Key Concepts in Optimization
Concept	What it means
Code splitting	Load only what’s needed for the current page
Lazy loading	Delay loading expensive components until needed
Memoization	Prevent recalculating values unnecessarily
Asset optimization	Reduce image and bundle size
DevTools profiling	Understand where the app is slow or memory-heavy
🧱 1. Code Splitting with React lazy() and Suspense
Use React.lazy for large or route-specific components (like your charts, compare views, or map pages).
const CompareView = React.lazy(() => import("./views/CompareView"));

<Suspense fallback={<div>Cargando…</div>}>
  <CompareView />
</Suspense>
🔍 Best Places to Use It
CityMap (especially with Leaflet)
ComparePanel
CityUsageChart
Storybook pages or dev-only tools
🧠 Tip: Group lazy components by route to optimize per-page load.
🧮 2. Memoization with useMemo and React.memo
📌 When to memoize:
Heavy calculations (e.g., sorting, filtering large lists)
Pure visual components that re-render too often
✅ useMemo Example
const sortedCities = useMemo(() => {
  return [...cities].sort((a, b) => b.cyclists - a.cyclists);
}, [cities]);
✅ React.memo Example
const StatsCard = React.memo(({ label, value }: Props) => {
  return <div>{label}: {value}</div>;
});
🖼️ 3. Optimize Images & Icons
Use loading="lazy" on <img />:
<img src="/hero-bg.jpg" loading="lazy" alt="..." />
Prefer SVG for icons
Use compressed WebP or AVIF images for photos
Avoid loading large assets above-the-fold
🚀 4. Prefetching & Preloading
Vite automatically prefetches imported chunks
You can add preload hints in HTML if needed:
<link rel="preload" href="/fonts/inter.woff2" as="font" type="font/woff2" crossorigin="anonymous" />
📦 5. Build Optimization via Vite
Vite handles most optimizations:
Tree-shaking unused code
Minifying JS/CSS
Compressing output
Bundle analysis (optional):
npm install --save-dev rollup-plugin-visualizer
Then use it to inspect what's inside your bundle:
// vite.config.ts
import { visualizer } from "rollup-plugin-visualizer";

export default {
  plugins: [visualizer({ open: true })],
};
🧪 6. Profile with React DevTools
In Chrome:
Install React Developer Tools
Go to the "Profiler" tab
Record a session while interacting
Look for:
Frequent unnecessary re-renders
Slow renders > 16ms
Use this to justify optimizations, not guess them.
✅ 7. Checklist: What to Optimize
Element	Optimization Strategy
CityMap (Leaflet)	Lazy load + cache tile layers
Charts	Lazy load + memoize data
Data-heavy lists	Virtualization (e.g., react-window)
Images	Use lazy loading, small file sizes
Routes/pages	Use React.lazy() and Suspense
App shell	Keep fast with minimal above-the-fold components
🎓 Academic Impact
Optimizing your civic tech app means:
It works well on low-resource devices
You reduce data usage (important for accessibility)
It feels professional and production-ready — ideal for publication, demos, or grant proposals
✅ Summary
Optimization	Benefit
Lazy imports	Reduces bundle size
Memoization	Avoids re-renders and recalculation
Asset tuning	Faster load, less memory
Profiling	Targets real bottlenecks
Suspense	Smooth loading experience