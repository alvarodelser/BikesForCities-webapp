🔌 Step 6 — API Integration (React + TypeScript + FastAPI Backend)
🎯 Goal
Connect your React frontend to the FastAPI backend to replace dummy data with real, live data — for maps, charts, and UI components.
This step is about:
Fetching data from a REST API
Typing the responses correctly
Handling loading and error states
Keeping the UI responsive and resilient
🧠 Key Concepts
Concept	What It Means
useEffect	React hook to trigger data fetching after mount
useState	Stores the loading, error, and data values
fetch	Standard browser API for HTTP requests
Error handling	Making sure users see something useful even if the fetch fails
Type assertion	Ensure the shape of fetched data matches expected types
✅ 1. Design the Data Contract
Suppose your FastAPI endpoint is:
GET /api/cities
It returns:
[
  { "name": "Zaragoza", "cyclists": 1280, "avgSpeed": 14.2 },
  { "name": "Barcelona", "cyclists": 4210, "avgSpeed": 12.3 }
]
Create a type:
export interface CityData {
  name: string;
  cyclists: number;
  avgSpeed: number;
}
✅ 2. Fetching Data in a Component
import { useEffect, useState } from "react";

export function CityList() {
  const [data, setData] = useState<CityData[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/cities")
      .then(res => {
        if (!res.ok) throw new Error("API error");
        return res.json();
      })
      .then((data: CityData[]) => setData(data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading cities...</p>;
  if (error) return <p>Error loading cities: {error}</p>;
  if (!data || data.length === 0) return <p>No cities available</p>;

  return (
    <ul>
      {data.map(city => (
        <li key={city.name}>{city.name}: {city.cyclists} cyclists</li>
      ))}
    </ul>
  );
}
✅ 3. Type Assertion
fetch("/api/cities")
  .then(res => res.json() as Promise<CityData[]>)
This tells TypeScript what the shape of the payload is — but ⚠️ be careful! You're telling, not checking.
Advanced: Use runtime validation with zod or io-ts if needed.

🔁 Reusable API Layer (Optional but Best Practice)
You can abstract API access into its own module:
// src/api/cities.ts
export async function getCities(): Promise<CityData[]> {
  const res = await fetch("/api/cities");
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}
Then in the component:
useEffect(() => {
  getCities()
    .then(setData)
    .catch(err => setError(err.message))
    .finally(() => setLoading(false));
}, []);
🧪 Real Integration — Connect to Chart
Let’s say you want to pass fetched data to a chart:
import { CityUsageChart } from "./charts/CityUsageChart";

{data && <CityUsageChart data={data} />}
This connects your live backend to your visual frontend.
🧱 Component Structure Tip
Break it into:
/src/api/
  cities.ts
  stats.ts

/src/components/
  CityList.tsx
  charts/
    CityUsageChart.tsx
🔐 Extra: Handling Authentication (Optional)
If your FastAPI backend uses a token, add headers:
fetch("/api/cities", {
  headers: {
    Authorization: `Bearer ${token}`
  }
})
Store your token in localStorage or use a secure context/provider.
❗ Common Pitfalls
Mistake	Fix
Forgetting .finally()	UI stays stuck on loading
Missing error handling	Blank screen or console errors
Typos in endpoint	404 returned silently unless caught
Trusting untyped payload	TypeScript gives false confidence
🎓 Academic Use Case
You're now able to:
Pull live city network data into maps and charts
Display up-to-date usage metrics
Show data-driven insight during your demos or presentations
And you can transition from:
import { CITY_STATS } from "../constants/cities";
➡️ to:
useEffect(() => { fetch from FastAPI }, []);
✅ Summary
Concept	Purpose
useEffect	Fetch data on mount
useState	Store loading, error, and response
Error boundaries	Provide fallback UI
TypeScript types	Define response shape
Chart/map connection	Replace mock with live data
API module	Clean separation of logic