🔁 Step 1 — Component Decomposition & Refactoring (Expanded)
🎯 Goal Recap
Break your UI into small, reusable, single-responsibility components.
In a complex UI like yours (e.g. maps, cards, interactive panels), we want every part to be modular, isolated, and testable.
🧠 Key Concepts (with learning expansions)
1. Single Responsibility Principle (SRP)
Each component should "do one thing well." This makes code easier to test, debug, and reuse.
Example:

// ❌ Bad: too much responsibility
function Dashboard() {
  return (
    <div>
      <Navbar />
      <HeroSection />
      <MapWithButtons />
      <Footer />
    </div>
  );
}

// ✅ Better: MapWithButtons is broken down:
function MapWithButtons() {
  return (
    <>
      <CitySelector />
      <CityMap />
    </>
  );
}
2. Props as Contracts
In React + TypeScript, the props are the external API of your component.
interface SearchBarProps {
  query: string;
  onQueryChange: (q: string) => void;
}
💡 Illustration: Think of props like function parameters, but for UI components. This makes behavior predictable.
3. Types: interface vs. type
Use interface for object-shaped props:
interface HeroProps {
  title: string;
  subtitle?: string;
}
Use type when combining types or creating unions:
type Color = "red" | "green" | "blue";
type ButtonProps = HeroProps & { onClick: () => void };
Design tip: Keep your prop types close to the component — ideally in the same file — unless reused widely.
4. Composition over Inheritance
React encourages nesting components rather than subclassing them. This is more intuitive for UI.
function Layout({ children }: { children: React.ReactNode }) {
  return <main className="p-4">{children}</main>;
}

<Layout>
  <CityMap />
</Layout>
5. Lifting State Up
If multiple components need access to the same data (e.g. selected city), store it in the nearest common ancestor.
function CityPage() {
  const [selectedCity, setSelectedCity] = useState<string | null>(null);

  return (
    <>
      <CitySelector value={selectedCity} onChange={setSelectedCity} />
      <CityMap city={selectedCity} />
    </>
  );
}
📘 Compare this to sharing variables between two functions in traditional programming — lift to a shared scope.
6. Controlled vs. Uncontrolled Inputs
Controlled: React state is the source of truth.
Uncontrolled: DOM keeps its own state (use refs).
// Controlled (preferred for forms):
<input value={query} onChange={(e) => setQuery(e.target.value)} />

// Uncontrolled:
<input defaultValue="Zaragoza" ref={inputRef} />
Use controlled for consistency, especially when syncing input with visual state or analytics.
7. Hook Usage at This Stage
useState — store local values like input text, filters
useEffect — react to component lifecycle events (used cautiously)
useContext (optional) — for global shared state (e.g. user theme, map config)
🔧 Hands-on Task: Apply Decomposition to Your App
Decompose one complex section, e.g. the HeroSection or Map+Sidebar, into smaller units:
src/components/
  ├── HeroSection.tsx
  ├── CitySelector.tsx
  ├── CityMap.tsx
  ├── StatsCard.tsx
  └── Footer.tsx
Ask:
Does each component have one clear job?
Are props explicit and typed?
Are styles isolated?
🧭 Why It Matters for "Bikes for Cities"
You’ll be able to:
Isolate and test UI features like the city map or card panels
Reuse components across views (e.g. StatsCard in both home and compare pages)
Simplify updates or translations
🟡 Summary: What You Should Know at This Stage
Concept	What to Remember
Props	Typed interfaces are contracts
State	Use useState, lift up when shared
Composition	Nest components to build complexity
Component purpose	Keep it SRP: one job, one component
Controlled input	Use state + onChange
File structure	Group by function not type
⏭️ Next
Would you like me to continue with Step 2 — First Test Pass, expanding it in the same way with test design concepts, common mistakes, and relevant test cases for your components like CitySelector or StatsCard?