✅ Step 3 — Storybook Setup (Expanded & Educative)
🎯 Goal Recap
Create an interactive catalog of your reusable components to document and test them visually.
This step introduces Storybook, a powerful tool for both development and communication. It's not just useful for developers — it can also help designers, researchers, and reviewers understand your components in isolation.
🧠 What You’ll Learn in This Step
What Storybook is and why it matters
How to set it up in a React + Vite project
How to write and organize stories
Best practices for your academic project
Real-world use: e.g., showcasing StatsCard with different values
🔍 1. What is Storybook?
Storybook is a UI workbench: it renders your React components outside the app in a live sandbox.
📘 Think of it like Jupyter notebooks for components:

You test them in isolation
You document how they behave with different props
You preview their states without writing manual pages or routes
📦 2. Installing Storybook
Run this in your frontend project root:
npx storybook@latest init
If you’re using Vite with React + TypeScript, it will:
Add Storybook config files
Add a few example stories
Configure a compatible build setup
Then:
npm run storybook
Storybook will launch at http://localhost:6006.
🧱 3. Writing Your First Story
Let’s document SearchBar (or StatsCard, etc.) in isolation.
Create a file next to your component:

src/components/SearchBar.stories.tsx
✍️ Basic Story Structure:
import type { Meta, StoryObj } from "@storybook/react";
import { SearchBar } from "./SearchBar";

const meta: Meta<typeof SearchBar> = {
  title: "Forms/SearchBar", // Appears in Storybook sidebar
  component: SearchBar,
  args: {
    query: "",
    onQueryChange: () => {},
  },
};
export default meta;

type Story = StoryObj<typeof SearchBar>;

export const Default: Story = {};
🎓 Concepts to Understand
✅ Meta and title
This metadata tells Storybook how to organize your stories.
title: "Forms/SearchBar"
Storybook will group your component under "Forms" → "SearchBar" in the sidebar.
✅ args
These are props passed to the component by default in this story.
args: {
  query: "Madrid",
  onQueryChange: () => {},
}
📘 It’s like rendering the component with specific test data — but live.
You can tweak these props in the UI and see results instantly.

✅ Multiple Variants (Stories)
export const Empty: Story = {
  args: { query: "" },
};

export const Prefilled: Story = {
  args: { query: "Barcelona" },
};
Each variant is a scenario — useful for:
Showing different usage cases
Creating visual test snapshots
Teaching how the component behaves
✅ Live Controls
If you pass args, you get live prop controls automatically.
Prop	Storybook renders input
string	text box
boolean	checkbox
enum	dropdown
function	logs to actions panel
You can try onQueryChange in the Storybook UI and see it log every input change.
🎯 Real Example: StatsCard Story
Let’s say you have:
export function StatsCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color: "red" | "orange" | "green";
}) {
  return (
    <div className={`border-t-4 p-4 border-${color}`}>
      <h3>{label}</h3>
      <p>{value}</p>
    </div>
  );
}
📘 You could define stories like:
export const Default: Story = {
  args: {
    label: "Cyclists",
    value: 2840,
    color: "orange",
  },
};

export const EmptyValue: Story = {
  args: {
    label: "No Data",
    value: "—",
    color: "red",
  },
};
This lets you show:
Success case
Missing data
Different visual states
🏗️ 4. Best Practices for Your Project
Goal	How Storybook Helps
Show component states	Use multiple stories with args
Improve documentation	Use stories as living docs
Communicate with others	Share the Storybook URL
Ensure consistency	Validate layout + props visually
💡 You can show your academic supervisor or team how each UI piece works without running the full app.
🛠️ Bonus Tips
Use CSF (Component Story Format) — it’s clean, typed, and works well with Vite
Use play functions for interaction testing (advanced)
Add docs tab later to explain usage and design reasoning
🧱 Key Takeaways
Concept	Meaning
Meta	Configuration of your story group
Story	A specific usage case of a component
args	Props passed to the component
Storybook UI	Lets you tweak props visually
Storybook = playground + docs + visual testbed	✅