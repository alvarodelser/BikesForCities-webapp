✅ Step 4 — Data with Constants Folder (Expanded & Educative)
🎯 Goal Recap
Use structured dummy data shaped like real API output to support component development and testing.
This step is all about preparing realistic placeholder data that mimics what you'd eventually get from your backend. This allows you to:
Build components without needing the backend live
Test, preview, and debug logic or layout
Document consistent sample states (e.g., with Storybook or tests)
🧠 Key Concepts (Expanded for Learning)
✅ 1. Why Dummy Data?
In any non-trivial web app (like yours with map visualizations, statistics, and comparisons), real data:
might not be available yet
might change
might be incomplete or inconsistent
Creating well-shaped constants lets you:
Avoid blockers
Develop UI early
Keep examples consistent across development, testing, and demos
✅ 2. Match the Real API Structure
The goal is not just to "fake data" — it's to mimic the structure of your API.
// constants/users.ts
export interface User {
  id: number;
  name: string;
  email: string;
}

export const USERS: User[] = [
  { id: 1, name: "Alice", email: "alice@example.com" },
];
🧠 Why Type First?
The TypeScript interface ensures:
You and your teammates know the shape
The compiler validates it
When the backend changes, the frontend breaks explicitly — which is good!
🧪 Educational Mini Task
Imagine you're building a component that shows city mobility stats. You might define:
// constants/cities.ts
export interface CityStats {
  name: string;
  cyclists: number;
  avgSpeed: number;
  greenKilometers: number;
}

export const CITY_STATS: CityStats[] = [
  { name: "Zaragoza", cyclists: 1290, avgSpeed: 14.2, greenKilometers: 32 },
  { name: "Barcelona", cyclists: 5210, avgSpeed: 12.6, greenKilometers: 74 },
];
Now your components can be developed as if the API is already working.
🏗️ 3. Folder Structure Recommendation
Keep your constants structured under a folder like:
/src/constants
  ├── cities.ts
  ├── users.ts
  ├── mapConfig.ts
  └── index.ts (optional barrel export)
Bonus:
You can use file-based grouping to mirror your component structure.
🧑‍💻 4. Using Constants in Components
Let’s say you want to show a list of cities.
import { CITY_STATS } from "../constants/cities";

export function CityList() {
  return (
    <ul>
      {CITY_STATS.map(city => (
        <li key={city.name}>
          {city.name}: {city.cyclists} cyclists
        </li>
      ))}
    </ul>
  );
}
Now this list:
Works without waiting for API integration
Is testable
Can be shown in Storybook
🌍 Academic Use Case — Bikes for Cities
Your app depends on:
Map overlays
Statistical summaries
Comparisons
All these benefit from consistent, fake data like:
export interface CityNetwork {
  id: string;
  name: string;
  segments: number;
  connectedPct: number;
  safetyIndex: number;
}
This shapes both your logic and your visual components. You’ll later replace it with a fetch call.
🧱 Common Gotchas
Problem	Fix
Dummy data missing fields	Always define the type first
Changing shape of constants later	Use strict typing to force updates
Repeating dummy data in multiple files	Centralize in /constants and import as needed
🧰 Bonus Tips
Use faker.js or Mockaroo to generate realistic data
For Storybook: you can pass constants as args to stories
For tests: reuse constants to ensure stable expectations
✅ Summary of This Step
Concept	Key Idea
Constants folder	Store mock data for development/testing
interface first	Let TypeScript guard the shape
Match real API	Design dummy data like real payloads
Use across tools	Storybook, tests, dev previews
Think ahead	Build like the backend already exists