✅ Step 7 — Second Test Pass After Integration (Expanded)
🎯 Goal
Test your React components in their real, integrated form — where they fetch live (or mocked) data and render various states: loading, success, and error.
Why this matters:
After integrating API calls, your components now depend on network conditions, async data, and side effects.
These need to be tested to prevent flaky or broken UIs and make sure your app fails gracefully.
🧠 Key Concepts to Learn
Concept	Description
Async testing	Use await and findBy* queries for dynamic content
Mocking fetch	Replace network with simulated responses
Testing UI states	Confirm loading spinners, errors, and final output
Separation of concerns	Only test one component’s logic per test
🧪 Real-World Test Case: CityList.tsx
We’ll use the integrated version that:
fetches /api/cities
displays a loading message
renders a list of cities when loaded
shows an error on failure
✅ 1. Mock the Fetch Call
import { render, screen } from "@testing-library/react";
import { CityList } from "./CityList";
import { vi } from "vitest";

const mockData = [
  { name: "Zaragoza", cyclists: 1280, avgSpeed: 14.2 },
  { name: "Barcelona", cyclists: 4210, avgSpeed: 12.3 },
];

test("shows loading, then data", async () => {
  global.fetch = vi.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve(mockData),
    })
  ) as any;

  render(<CityList />);

  // While loading
  expect(screen.getByText(/loading/i)).toBeInTheDocument();

  // After data has loaded
  expect(await screen.findByText("Zaragoza")).toBeInTheDocument();
  expect(screen.getByText("Barcelona: 4210 cyclists")).toBeInTheDocument();
});
📘 Learn This Pattern: findBy* vs getBy*
Matcher	When to use
getByText	Synchronous — element must be present now
findByText	Asynchronous — wait for element to appear (after loading or async updates)
❗ Error Handling Test
test("shows error on failed fetch", async () => {
  global.fetch = vi.fn(() =>
    Promise.resolve({ ok: false })
  ) as any;

  render(<CityList />);
  expect(await screen.findByText(/error/i)).toBeInTheDocument();
});
✅ What to Test (Checklist)
State	How to Test
Loading state	getByText("Loading...")
Error state	findByText(/error/i)
Empty list	Test for fallback “no cities found”
Success	Match expected city data in UI
Prop rendering	If data is passed to child components
🧩 Optional: Mock the API Layer Instead
If you have an API module like getCities(), mock that:
vi.mock("../api/cities", () => ({
  getCities: () => Promise.resolve(mockData),
}));
Advantage:
Keeps fetch untouched
Avoids global pollution between tests
🛠️ Bonus: Test Your Chart
Let’s say you render CityUsageChart with fetched data:
expect(await screen.findByText("Zaragoza")).toBeInTheDocument();
expect(screen.getByText("1280")).toBeInTheDocument();
Charts render inside SVG or canvas, so sometimes you use:
getByText() (if values are rendered)
querySelector('svg') (to assert number of bars or lines)
🔄 Strategy Tip
Component Layer	Testing Focus
CityList (page/view)	Integration: loading + data states
CityUsageChart	Pure rendering: correct visual props
getCities()	API logic (unit tested separately)
♿ Accessibility Check (Bonus)
Use jest-axe to test if your loaded page is accessible:
npm install --save-dev jest-axe
Then:
import { axe, toHaveNoViolations } from "jest-axe";

expect(await axe(container)).toHaveNoViolations();
✅ Summary
Concept	Purpose
findBy*	For waiting on async content
Mocking fetch	Simulates backend response
Integration test scope	Loading → Data → Error
vi.fn()	Spy on API or handler calls
Component layering	Test behavior at each level
📘 Academic Takeaway
This test ensures your app:
Works offline in Storybook/test environment
Displays robust UX even if the backend fails
Demonstrates reliability and reproducibility — key academic criteria
