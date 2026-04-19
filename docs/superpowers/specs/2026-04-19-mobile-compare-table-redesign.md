# Mobile Compare Table Redesign

**Date:** 2026-04-19  
**Scope:** Mobile-only changes to `CityCompareTable` and `MobileTabs` components  
**Status:** Design approved, ready for implementation

---

## Overview

Redesign the mobile compare table to shift from a card-based layout to a compact row-based table format with interactive column group selection. Improve tab styling for better contrast on dark backgrounds.

### Goals

- **Compact layout:** Reduce row height and vertical scrolling burden
- **Column control:** Let users toggle column groups (Infraestructura, Servicio Bici, Ayuntamiento) via pill buttons
- **Better UX:** Mode icons become inline buttons at the row end instead of bottom of card
- **Improved tab contrast:** Pill-style tabs with blue/white inversion for readability on dark background

---

## Architecture

### New Components

#### 1. `ColumnGroupPicker` (New)

**Purpose:** Display toggleable pill buttons for each column group.

**Props:**
- `groups: ColumnGroup[]` — Array of available groups (Infraestructura, Servicio Bici, Ayuntamiento)
- `expanded: Set<GroupId>` — Currently expanded groups
- `onToggle: (groupId: GroupId) => void` — Callback when user clicks a pill

**Behavior:**
- Renders horizontal flex row of pill buttons
- Each pill shows group icon + label
- Pill appearance:
  - Default (inactive): `bg-white/10 text-white/60`
  - Active: `bg-white/20 text-white`
  - Hover: `bg-white/15` (both states)
  - Rounded pill shape: `rounded-full px-4 py-2`
- Always includes a read-only "Base" pill to indicate city name + mode icons are always visible
- Placed above the table, horizontal scroll if needed on very narrow screens

#### 2. `MobileCompareRows` (New)

**Purpose:** Render city data as compact horizontal rows instead of cards.

**Props:**
- `cities: CityData[]` — Sorted cities from parent
- `selectedCityPaths: string[]` — Selected city paths
- `onToggleCity: (city: CityData) => void` — Selection callback
- `visibleColumns: Column[]` — Filtered columns based on active groups
- `onSort: (key: SortKey) => void` — Sort callback (may not be used for mobile, but available)

**Row Layout:**
- Height: `py-3` (approximately 44px total)
- Flex row: `flex items-center gap-2`
- Flex grow/shrink:
  - City name: `flex-shrink-0 min-w-[100px]`
  - Stat columns: `flex-grow`, right-aligned
  - Mode icons: `flex-shrink-0`, grouped at far right
- Background: Alternating stripes + selection highlight
  - Default even: `rgba(255,255,255,0.02)`
  - Default odd: `rgba(255,255,255,0.05)`
  - Selected: `rgba(225,172,85,0.45)` (first) or `rgba(175,71,73,0.45)` (second)
  - Hover: `bg-white/10`
- Border: `border-b border-white/5` (same as desktop rows)
- Clickable: Full row is a `<button>` to toggle selection

**City Name Cell:**
- `font-semibold text-white text-sm`
- `px-3`, left-aligned
- Non-wrapping
- Includes selection badge if selected (inline, small `text-[10px]` badge)

**Stat Columns:**
- Text: `text-white/70 text-xs`, right-aligned
- Spacing: `px-3` between columns
- Use `tabular-nums` for alignment
- Content same as desktop (formatters for population, distance, percentage)

**Mode Icons (Right End):**
- Icon size: 12px
- Rendered as small pill buttons: `p-1.5 rounded-md bg-white/5 hover:bg-white/15`
- Spacing: `gap-1`
- Icon color: Varies by mode (same as desktop)
- Opacity: `opacity-70` default, `opacity-100` on hover
- Container flex: `flex items-center gap-1 flex-shrink-0`
- Links have `onClick={(e) => e.stopPropagation()}` to prevent row selection

#### 3. `MobileTabs` (Update Existing)

**Purpose:** Update tab styling to pill-style with blue/white inversion.

**Current behavior:** Preserved (hash routing, mobile-only rendering, default tab)

**Styling changes:**
- Tab container: `flex gap-2 border-b border-black/10 px-3 py-3` (add padding, add gap)
- Default tab: 
  - `bg-[var(--blue)] text-white px-4 py-2 rounded-full`
  - `font-semibold text-sm`
  - `transition-all duration-200`
- Selected tab:
  - `bg-white text-[var(--blue)] px-4 py-2 rounded-full`
  - `font-semibold text-sm`
  - `transition-all duration-200`
- Remove: `border-b-2` underline styling
- Hover: Subtle opacity change on default tabs

---

## Changes to `CityCompareTable`

### Mobile Rendering Branch (lines 392–450)

**Replace current card layout with:**

```
1. ColumnGroupPicker (new)
   - Props: groups, expandedGroups, toggleGroup handler
   - Placed in section header, above the rows container

2. MobileCompareRows (new)
   - Props: cities, selectedCityPaths, onToggleCity, visibleColumns, onSort
   - All city rows rendered in a flex column

3. Remove: Old card rendering loop (lines 395–448)
```

### Shared State

- Reuse `expandedGroups` state from desktop (already defined at line 297)
- Reuse `toggleGroup` handler (already defined at line 364)
- Reuse `visibleColumns` memo (already defined at line 383)
- Reuse `sortKey`, `setSortKey`, `sortDir`, `setSortDir` (for future sort-on-mobile capability)

### Data Flow

```
CityCompareTable
  ├─ expandedGroups state
  ├─ toggleGroup handler
  └─ visibleColumns memo
      ├─→ ColumnGroupPicker (receives: groups, expanded, onToggle)
      └─→ MobileCompareRows (receives: cities, selectedPaths, onToggleCity, visibleColumns)
```

---

## Column Group Behavior

**Base columns (always visible):**
- City name (left-aligned)
- Mode icons (right-aligned, as buttons)

**Group columns (toggled via pills):**
- Infraestructura: Cobertura, Red (km)
- Servicio Bici: Servicio, Estaciones, Viajes/mes
- Ayuntamiento: Alcalde/sa, Partido

**Default state on page load:**
- Desktop: Infraestructura and Ayuntamiento expanded (current behavior)
- Mobile: Same as desktop (inherited from `expandedGroups` state initialization at line 297)

Users can toggle groups in real-time; columns appear/disappear smoothly.

---

## Tab Styling

**File:** `frontend/src/components/compare/MobileTabs.tsx`

**Changes:** Lines 44–59 (tab container and buttons)

**Visual result:**
- Pill-shaped buttons with clear selected state
- Blue background (default) vs. white background (selected)
- High contrast on dark page background
- Gap between pills provides breathing room

---

## Testing Strategy

**Mobile-specific checks:**
1. Row height is noticeably smaller than cards
2. All stat columns visible and right-aligned
3. Mode icons appear as small buttons at row end, clickable without selecting row
4. Column group pills toggle columns in real-time
5. Selection highlighting works (gold/red tint)
6. Alternating row backgrounds are visible
7. Horizontal scroll on narrow screens (if any columns overflow)
8. Sorting still works (if enabled for mobile in future)

**Tab styling:**
1. Tabs render as pills (not underline style)
2. Default tabs: blue background, white text
3. Selected tab: white background, blue text
4. Smooth transition between states
5. Readable on dark background

**Cross-browser:**
- Chrome mobile
- Safari iOS
- Firefox mobile

---

## File Changes Summary

| File | Change | Type |
|------|--------|------|
| `frontend/src/components/compare/ColumnGroupPicker.tsx` | New file | Component |
| `frontend/src/components/compare/MobileCompareRows.tsx` | New file | Component |
| `frontend/src/components/compare/CityCompareTable.tsx` | Replace mobile render (lines 392–450) | Refactor |
| `frontend/src/components/compare/MobileTabs.tsx` | Update tab styling (lines 44–59) | Style |

---

## Notes

- No changes to desktop table rendering
- No changes to API or data flow
- No changes to sorting, filtering, or city selection logic
- Mode icons remain clickable links to city maps
- Row selection behavior unchanged (click row to toggle selection)
- Accessibility: Use semantic `<button>` and proper ARIA roles already in place

---

## Future Enhancements (Out of Scope)

- Sortable columns on mobile (infrastructure ready, UI not yet added)
- Persistent column preferences (localStorage)
- Drag-to-reorder columns
- Swipe gestures for group toggle

