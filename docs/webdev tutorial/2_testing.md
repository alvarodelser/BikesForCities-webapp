✅ Step 2 — First Test Pass (Expanded & Educative)
🎯 Goal Recap
Write your first tests to verify that key components behave as expected.
This step helps build confidence in your UI by checking that components react properly to user interaction and prop changes.
🧠 Concepts to Learn Now (Expanded)
1. Why Test Components?
Even though you can “see” the UI, tests help you:
Prevent regressions during refactors
Catch unexpected bugs from edge cases
Ensure components follow their contract (props/state)
Build shared understanding across your team
📘 Think of it like writing unit tests in any backend app — you’re verifying each component does what it claims.
2. The Testing Stack
We'll use the following tools:
Tool	Purpose
Vitest	Test runner and assertion library
@testing-library/react	Simulates user interaction
@testing-library/jest-dom	Adds matchers like .toBeInTheDocument()
Install once:
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom
And in package.json:
"scripts": {
  "test": "vitest"
}
Then run:
npm run test
3. How Tests are Structured: Arrange–Act–Assert
Phase	What you do
Arrange	Render the component with necessary props
Act	Simulate user action or re-render with new props
Assert	Confirm the expected output or behavior occurs
4. Simple Example — SearchBar
import { render, screen, fireEvent } from "@testing-library/react";
import { SearchBar } from "./SearchBar";

test("calls onQueryChange when typing", () => {
  const handleChange = vi.fn(); // spy function
  render(<SearchBar query="" onQueryChange={handleChange} />);

  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: "hi" },
  });

  expect(handleChange).toHaveBeenCalledWith("hi");
});
📘 Concepts to Explain
✅ render() — Arranges the DOM for the test
render(<SearchBar query="" onQueryChange={fn} />);
The render() function mounts the component into a virtual DOM so you can interact with it.
✅ screen — Access elements by role/text
screen.getByRole("textbox") // Finds <input>
screen.getByText("Explore") // Finds buttons, text
🧠 Why role-based selection? It's the closest to how a screen reader or user would navigate the page.
✅ fireEvent — Simulate interaction
fireEvent.change(input, { target: { value: "new text" } });
Simulates a change, click, keypress, etc.
🧪 You can also use userEvent from @testing-library/user-event for more realistic sequences (recommended later).

✅ vi.fn() — Mock a callback
const onClick = vi.fn();
// Now you can test whether it was called, how often, and with what args
🛠️ Suggested Practice: Test CitySelector
Let’s say you have:
export function CitySelector({
  cities,
  selected,
  onChange,
}: {
  cities: string[];
  selected: string;
  onChange: (city: string) => void;
}) {
  return (
    <select value={selected} onChange={e => onChange(e.target.value)}>
      {cities.map(city => <option key={city}>{city}</option>)}
    </select>
  );
}
🔬 Your test should look like:
test("selecting a city calls onChange", () => {
  const onChange = vi.fn();
  render(<CitySelector cities={["Zaragoza", "Madrid"]} selected="Zaragoza" onChange={onChange} />);

  fireEvent.change(screen.getByRole("combobox"), {
    target: { value: "Madrid" },
  });

  expect(onChange).toHaveBeenCalledWith("Madrid");
});
🧱 Learning Milestones
At this point, you should understand:
How to write a basic test for component behavior
What a mock function does
The value of testing from the user’s perspective (black-box testing)
That one test = one behavior, keep it focused
🔄 Design Tip for Bikes for Cities
You’ll want to test components like:
StatsCard: do values render correctly?
CityMap: does clicking update state?
HeroSection: do CTA buttons navigate or trigger?
Start with functional testing before moving to styling or layout tests.
🔁 What’s Missing or Optional to Add Later
userEvent for better interaction simulation
Snapshot testing (used cautiously)
Test coverage tooling (like c8)
Accessibility checks (axe or jest-axe)
