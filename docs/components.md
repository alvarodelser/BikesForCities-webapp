# Component Modularity Design Document

## Overview
This document outlines the component architecture refactor to maximize reusability and maintainability across the BikesForCities application. It identifies common UI patterns and proposes a modular component structure.

---

## 1. Design System Standards & Consistency

### 1.1 GlassCard Component
**Purpose**: Unified glassmorphism card component with consistent styling
**Current Usage Locations**:
- `FeatureCard` (HeroSection) - Replace with GlassCard
- `CityCard` stats sections - Extract card wrapper
- `OverviewSection` stats cards - Replace with GlassCard
- `CityStats` stats cards - Replace with GlassCard
- `MapFilters` filter buttons - Replace with GlassCard variant
- `CityMap` legend container - Replace with GlassCard

**Props Interface**:
```typescript
interface GlassCardProps {
  children: React.ReactNode;
  variant?: 'default' | 'button' | 'compact';
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  selected?: boolean;
  hover?: boolean;
  textColor?: 'dark' | 'light';  // Added for CityCard compatibility
}
```

**Usage Examples**:
```typescript
// In OverviewSection stats
<GlassCard variant="default" hover>
  <StatContent />
</GlassCard>

// In MapFilters buttons
<GlassCard variant="button" selected={isSelected} onClick={onSelect}>
  <FilterContent />
</GlassCard>
```

### 1.2 SectionLayout Component
**Purpose**: Consistent section wrapper with background, texture, and margins
**Current Usage Locations**:
- `HeroSection` - Replace section wrapper
- `OverviewSection` - Replace section wrapper
- `MapFilters` - Replace section wrapper

**Props Interface**:
```typescript
interface SectionLayoutProps {
  children: React.ReactNode;
  background?: 'cream' | 'blue' | 'transparent';
  withTexture?: boolean;
  className?: string;
  id?: string;
}

**Note**: Component must handle `backgroundTexture` import from `../../assets/background2.svg` and apply texture styling when `withTexture` is true. Current components import this texture directly.
```

**Usage Examples**:
```typescript
// In HeroSection
<SectionLayout background="cream" withTexture id="hero">
  <HeroContent />
</SectionLayout>

// In MapFilters
<SectionLayout background="transparent">
  <FiltersContent />
</SectionLayout>
```

### 1.3 StatsGrid Component
**Purpose**: Reusable statistics display grid
**Current Usage Locations**:
- `OverviewSection` city stats - Replace with StatsGrid
- `CityStats` mode stats - Replace with StatsGrid

**Props Interface**:
```typescript
interface StatsGridProps {
  stats: StatItem[];
  columns?: 2 | 3 | 4;
  showTrends?: boolean;
  variant?: 'default' | 'compact';
}

interface StatItem {
  label: string;
  value: string | number;
  icon: React.ComponentType<any>;
  trend: 'up' | 'down' | 'neutral';  // Required - matches cityStats.ts interface
  unit?: string;
}
```

**Usage Examples**:
```typescript
// In OverviewSection
<StatsGrid 
  stats={cityStats} 
  columns={4} 
  variant="default"
/>

// In CityStats
<StatsGrid 
  stats={modeStats.stats} 
  columns={4} 
  showTrends 
/>
```

### 1.4 IconContainer Component
**Purpose**: Consistent icon wrapper with background and hover effects
**Current Usage Locations**:
- `FeatureCard` icon containers
- `OverviewSection` stat icons
- `CityStats` stat icons
- `MapFilters` filter icons

**Props Interface**:
```typescript
interface IconContainerProps {
  icon: React.ComponentType<any>;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'solid' | 'outline' | 'gradient';
  color?: 'green' | 'yellow' | 'blue' | 'red';
  hover?: boolean;
}
```

### 1.5 GradientText Component
**Purpose**: Reusable gradient text styling
**Current Usage Locations**:
- `HeroSection` titles - Replace with GradientText
- `OverviewSection` city name - Replace with GradientText

**Props Interface**:
```typescript
interface GradientTextProps {
  children: React.ReactNode;
  variant?: 'title' | 'subtitle' | 'heading';
  gradient?: 'blue' | 'green' | 'mixed';
  className?: string;
}
```

### 1.6 Button Component
**Purpose**: Unified button component with consistent styling
**Current Usage Locations**:
- `ScrollableCityCards` navigation buttons
- `CityMap` control buttons
- `CityCard` action buttons
- `CityPage` back button (if added)

**Props Interface**:
```typescript
interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'icon';
  size?: 'sm' | 'md' | 'lg';
  color?: 'green' | 'yellow' | 'blue' | 'white';
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}
```

### 1.7 InsightsPanel Component
**Purpose**: Reusable insights and recommendations display
**Current Usage Locations**:
- `CityStats` insights and recommendations sections

**Props Interface**:
```typescript
interface InsightsPanelProps {
  title: string;
  insights: Array<{
    text: string;
    color: 'green' | 'yellow' | 'blue' | 'orange';
  }>;
}
```

---

## 2. Higher-Level Component Refactors

### 2.1 Page Components

#### 2.1.1 LandingPage
**Current Structure**: Simple wrapper
**Proposed Refactor**: 
- Add consistent page layout wrapper
- Add scroll management
- Add page transitions

**New Structure**:
```typescript
<PageLayout>
  <HeroSection />
  <MapSelector />
</PageLayout>
```

#### 2.1.2 CityPage
**Current Structure**: Simple wrapper with city lookup
**Proposed Refactor**:
- Extract city lookup logic to custom hook
- Add loading states
- Add error boundaries

**New Structure**:
```typescript
<PageLayout>
  <CityPageContent city={city} />
</PageLayout>
```

### 2.2 Section Components Refactors

#### 2.2.1 HeroSection
**Current Issues**: Mixed concerns (layout + content)
**Proposed Refactor**:
- Extract to use SectionLayout
- Create HeroContent component
- Separate scroll logic

**New Structure**:
```typescript
<SectionLayout background="cream" withTexture>
  <HeroContent 
    title="Bikes for Cities"
    subtitle="Movilidad sostenible en la era digital"
    features={heroFeatures}
    onScrollNext={scrollToMapSelector}
  />
</SectionLayout>
```

#### 2.2.2 OverviewSection
**Current Issues**: Hardcoded layout, mixed styling
**Proposed Refactor**:
- Extract to use SectionLayout and StatsGrid
- Create reusable CityOverview component

**New Structure**:
```typescript
<SectionLayout background="cream" withTexture>
  <CityOverview 
    city={city}
    image={cityImage}
    stats={cityStats}
  />
</SectionLayout>
```

#### 2.2.3 MapFilters
**Current Issues**: Mixed layout and logic
**Proposed Refactor**:
- Extract to use SectionLayout
- Create FilterGrid component
- Separate mode selection logic

**New Structure**:
```typescript
<SectionLayout>
  <FilterGrid 
    modes={filterModes}
    selectedMode={selectedMode}
    onModeChange={onModeChange}
  />
</SectionLayout>
```

### 2.3 Layout Components

#### 2.3.1 PageLayout Component
**Purpose**: Consistent page wrapper with common functionality
**Features**:
- Scroll management
- Loading states
- Error boundaries
- Page transitions

#### 2.3.2 ContentWrapper Component
**Purpose**: Consistent content margins and responsive behavior
**Current Usage**: Replace hardcoded `mx-[100px]` throughout components

---

## 3. Step-by-Step Implementation Plan

### Step 1: Create GlassCard Component
- [ ] **File**: `frontend/src/components/ui/GlassCard.tsx`

**Actions**:
- [ ] 1. Create new file with the following structure:
   ```typescript
   interface GlassCardProps {
     children: React.ReactNode;
     variant?: 'default' | 'button' | 'compact';
     className?: string;
     onClick?: () => void;
     disabled?: boolean;
     selected?: boolean;
     hover?: boolean;
   }
   ```
- [ ] 2. Implement three variants:
   - `default`: Standard glassmorphism card with `bg-white/80 backdrop-blur-md border border-[var(--green)]/30`
   - `button`: Interactive card with hover states and selection styling
   - `compact`: Smaller padding and margins for tight layouts
- [ ] 3. Add conditional classes for `selected`, `disabled`, and `hover` states
- [ ] 4. Include glass reflection effect div and bottom highlight div

**Testing**: - [ ] Verify component renders correctly in isolation

### Step 2: Replace FeatureCard with GlassCard
- [ ] **File**: `frontend/src/components/landing/HeroSection.tsx`

**Actions**:
- [ ] 1. Import `GlassCard` instead of `FeatureCard`
- [ ] 2. Replace `<FeatureCard>` usage (lines 78-89) with:
   ```typescript
   <GlassCard variant="compact" hover>
     <div className="flex items-center gap-3">
       <IconContainer icon={CircuitBoard} size="md" color="green" />
       <span className="text-[var(--blue-dark)]">Compara nuestras ciudades</span>
     </div>
   </GlassCard>
   ```
- [ ] 3. Repeat for all three feature cards
- [ ] 4. Remove `FeatureCard` import

**Testing**: - [ ] Verify HeroSection renders identically to before

### Step 3: Create IconContainer Component  
- [ ] **File**: `frontend/src/components/ui/IconContainer.tsx`

**Actions**:
- [ ] 1. Create component with interface:
   ```typescript
   interface IconContainerProps {
     icon: React.ComponentType<any>;
     size?: 'sm' | 'md' | 'lg';
     variant?: 'solid' | 'outline' | 'gradient';
     color?: 'green' | 'yellow' | 'blue' | 'red';
     hover?: boolean;
   }
   ```
- [ ] 2. Implement size variants: `sm` (8x8), `md` (12x12), `lg` (16x16)
- [ ] 3. Implement color variants with corresponding CSS variables
- [ ] 4. Add hover scale animation when `hover` prop is true

**Testing**: - [ ] Verify different variants render correctly

### Step 4: Refactor OverviewSection Stats with GlassCard
- [ ] **File**: `frontend/src/components/city/OverviewSection.tsx`

**Actions**:
- [ ] 1. Import `GlassCard` and `IconContainer`
- [ ] 2. Replace stats grid div (lines 54-128) with:
   ```typescript
   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-12 mb-12 mx-[100px]">
     <GlassCard variant="default" hover>
       <div className="flex items-center gap-3 mb-4">
         <IconContainer icon={Users} size="lg" color="green" hover />
         <h3 className="text-lg font-semibold text-[var(--blue-dark)]">Population</h3>
       </div>
       <p className="text-3xl font-bold text-[var(--blue-dark)]">
         {/* population formatting logic */}
       </p>
     </GlassCard>
     {/* Repeat for other 3 stats */}
   </div>
   ```
- [ ] 3. Remove all hardcoded glassmorphism styling from individual stat divs

**Testing**: - [ ] Verify OverviewSection renders identically with new components

### Step 5: Create StatsGrid Component
- [ ] **File**: `frontend/src/components/ui/StatsGrid.tsx`

**Actions**:
- [ ] 1. Create component with interfaces:
   ```typescript
   interface StatItem {
     label: string;
     value: string | number;
     icon: React.ComponentType<any>;
     trend?: 'up' | 'down' | 'neutral';
     unit?: string;
   }
   
   interface StatsGridProps {
     stats: StatItem[];
     columns?: 2 | 3 | 4;
     showTrends?: boolean;
     variant?: 'default' | 'compact';
   }
   ```
- [ ] 2. Use `GlassCard` and `IconContainer` internally
- [ ] 3. Implement responsive grid with dynamic columns
- [ ] 4. Add trend indicators when `showTrends` is true

**Testing**: - [ ] Verify grid renders correctly with different configurations

### Step 6: Refactor OverviewSection to use StatsGrid
- [ ] **File**: `frontend/src/components/city/OverviewSection.tsx`

**Actions**:
- [ ] 1. Create `cityStats` array from existing city data:
   ```typescript
   const cityStats: StatItem[] = [
     {
       label: 'Population',
       value: city.population >= 1000000 ? `${(city.population / 1000000).toFixed(1)}M` : `${(city.population / 1000).toFixed(0)}K`,
       icon: Users,
       unit: ''
     },
     // ... other stats
   ];
   ```
- [ ] 2. Replace entire stats grid section with:
   ```typescript
   <StatsGrid stats={cityStats} columns={4} variant="default" />
   ```
- [ ] 3. Remove all individual stat card implementations

**Testing**: - [ ] Verify OverviewSection functionality unchanged

### Step 7: Create SectionLayout Component
- [ ] **File**: `frontend/src/components/ui/SectionLayout.tsx`

**Actions**:
- [ ] 1. Create component with interface:
   ```typescript
   interface SectionLayoutProps {
     children: React.ReactNode;
     background?: 'cream' | 'blue' | 'transparent';
     withTexture?: boolean;
     className?: string;
     id?: string;
   }
   ```
- [ ] 2. Implement background variants using CSS variables
- [ ] 3. Add conditional texture overlay when `withTexture` is true
- [ ] 4. Include consistent padding and responsive behavior

**Testing**: - [ ] Verify component renders with different background options

### Step 8: Refactor HeroSection to use SectionLayout
- [ ] **File**: `frontend/src/components/landing/HeroSection.tsx`

**Actions**:
- [ ] 1. Import `SectionLayout`
- [ ] 2. Replace outer `<section>` (lines 15-21) and background div (lines 22-36) with:
   ```typescript
   <SectionLayout background="cream" withTexture>
   ```
- [ ] 3. Remove hardcoded background styling and texture div
- [ ] 4. Keep all content inside the SectionLayout wrapper
- [ ] 5. Close with `</SectionLayout>`

**Testing**: - [ ] Verify HeroSection renders identically

### Step 9: Refactor OverviewSection to use SectionLayout
- [ ] **File**: `frontend/src/components/city/OverviewSection.tsx`

**Actions**:
- [ ] 1. Import `SectionLayout`
- [ ] 2. Replace outer `<section>` (lines 14-19) and background div (lines 20-34) with:
   ```typescript
   <SectionLayout background="cream" withTexture>
   ```
- [ ] 3. Remove all hardcoded background and texture styling
- [ ] 4. Keep title, image, and StatsGrid inside wrapper

**Testing**: - [ ] Verify OverviewSection renders identically

### Step 10: Create Button Component
- [ ] **File**: `frontend/src/components/ui/Button.tsx`

**Actions**:
- [ ] 1. Create component with interface:
   ```typescript
   interface ButtonProps {
     children: React.ReactNode;
     variant?: 'primary' | 'secondary' | 'ghost' | 'icon';
     size?: 'sm' | 'md' | 'lg';
     color?: 'green' | 'yellow' | 'blue' | 'white';
     disabled?: boolean;
     onClick?: () => void;
     className?: string;
   }
   ```
- [ ] 2. Implement all variant combinations with consistent styling
- [ ] 3. Add complex gradient overlay effects (see CityCard buttons for reference):
   - Backdrop blur effects (`backdrop-blur-lg`)
   - Internal gradient overlays (`bg-gradient-to-r from-white/15 to-transparent`)
   - Scale animations (`hover:scale-105`)
- [ ] 4. Add hover and disabled states
- [ ] 5. Include proper accessibility attributes

**Note**: Current buttons are complex with multiple layers of styling. Preserve all visual effects including gradient overlays and scale animations.

**Testing**: - [ ] Verify all button variants render correctly

### Step 11: Refactor CityCard to use Button component
- [ ] **File**: `frontend/src/components/ui/CityCard.tsx`

**Actions**:
- [ ] 1. Import `Button` component
- [ ] 2. Replace hardcoded button (around line with "Entrar") with:
   ```typescript
   <Button variant="primary" color="green" onClick={(e) => {
     e.stopPropagation();
     navigate(city.path);
   }}>
     Entrar
   </Button>
   ```
- [ ] 3. Remove hardcoded button styling classes

**Testing**: - [ ] Verify CityCard button functionality unchanged

### Step 12: Refactor CityStats to use StatsGrid
- [ ] **File**: `frontend/src/components/city/CityStats.tsx`

**Actions**:
- [ ] 1. Import `StatsGrid` component
- [ ] 2. Replace statistics grid section (around lines with stats.map) with:
   ```typescript
   <StatsGrid 
     stats={modeStats.stats} 
     columns={4} 
     showTrends 
     variant="default"
   />
   ```
- [ ] 3. Remove hardcoded stats grid implementation
- [ ] 4. Keep header and insights sections unchanged

**Testing**: - [ ] Verify CityStats renders correctly with trends

### Step 13: Create InsightsPanel Component
- [ ] **File**: `frontend/src/components/ui/InsightsPanel.tsx`

**Actions**:
- [ ] 1. Create component with interface:
   ```typescript
   interface InsightsPanelProps {
     title: string;
     insights: Array<{
       text: string;
       color?: 'green' | 'yellow' | 'blue' | 'orange';
     }>;
   }
   ```
- [ ] 2. Use `GlassCard` as container
- [ ] 3. Implement color-coded insights with appropriate styling

**Testing**: - [ ] Verify component renders insights correctly

### Step 14: Refactor CityStats to use InsightsPanel
- [ ] **File**: `frontend/src/components/city/CityStats.tsx`

**Actions**:
- [ ] 1. Import `InsightsPanel`
- [ ] 2. Replace insights and recommendations sections with:
   ```typescript
   <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
     <InsightsPanel 
       title="Key Insights"
       insights={[
         { text: modeStats.insights.primary, color: 'blue' },
         { text: modeStats.insights.secondary, color: 'green' }
       ]}
     />
     <InsightsPanel 
       title="Recommendations"
       insights={[
         { text: modeStats.recommendations.primary, color: 'yellow' },
         { text: modeStats.recommendations.secondary, color: 'orange' }
       ]}
     />
   </div>
   ```
- [ ] 3. Remove hardcoded insights sections

**Testing**: - [ ] Verify CityStats insights render correctly

### Step 15: Create GradientText Component
- [ ] **File**: `frontend/src/components/ui/GradientText.tsx`

**Actions**:
- [ ] 1. Create component with interface:
   ```typescript
   interface GradientTextProps {
     children: React.ReactNode;
     variant?: 'title' | 'subtitle' | 'heading';
     gradient?: 'blue' | 'green' | 'mixed';
     className?: string;
   }
   ```
- [ ] 2. Implement gradient variants using CSS variables
- [ ] 3. Add font size and weight variants

**Testing**: - [ ] Verify different gradient combinations work

### Step 16: Refactor titles to use GradientText
- [ ] **Files**: `HeroSection.tsx`, `OverviewSection.tsx`

**Actions**:
- [ ] 1. Import `GradientText` in both files
- [ ] 2. In HeroSection, replace title h1 (line 40-44) with:
   ```typescript
   <GradientText variant="title" gradient="blue">
     Bikes for Cities
   </GradientText>
   ```
- [ ] 3. In OverviewSection, replace city name h1 (lines 38-42) with:
   ```typescript
   <GradientText variant="title" gradient="blue">
     {city.name}
   </GradientText>
   ```
- [ ] 4. Remove hardcoded gradient classes

**Testing**: - [ ] Verify titles render identically

### Step 17: Create ContentWrapper Component
- [ ] **File**: `frontend/src/components/ui/ContentWrapper.tsx`

**Actions**:
- [ ] 1. Create simple wrapper component:
   ```typescript
   interface ContentWrapperProps {
     children: React.ReactNode;
     size?: 'sm' | 'md' | 'lg';
     className?: string;
   }
   ```
- [ ] 2. Implement responsive margin variants:
   - `sm`: `mx-[50px]`
   - `md`: `mx-[100px]` (default)
   - `lg`: `mx-[120px]`

**Testing**: - [ ] Verify wrapper applies correct margins

### Step 18: Replace hardcoded margins with ContentWrapper
- [ ] **Files**: Multiple components with `mx-[100px]` or `mx-[120px]`

**Actions**:
- [ ] 1. Find all instances of hardcoded horizontal margins
- [ ] 2. Replace with `<ContentWrapper>` or `<ContentWrapper size="lg">`
- [ ] 3. Update the following files:
   - `HeroSection.tsx`: title and content sections
   - `OverviewSection.tsx`: title, image, and stats sections  
   - `MapFilters.tsx`: content sections
- [ ] 4. Remove hardcoded margin classes

**Testing**: - [ ] Verify all layouts remain consistent

### Step 19: Refactor CityCard Internal Stats
- [ ] **File**: `frontend/src/components/ui/CityCard.tsx`

**Actions**:
- [ ] 1. Import `GlassCard` component
- [ ] 2. Replace internal stat cards (lines 84-146) with:
   ```typescript
   <div className="grid grid-rows-2 grid-cols-2 gap-4 relative z-10 flex-1 mb-4">
     <GlassCard variant="compact" textColor="light" className="border-white/20 p-4">
       <h3 className="font-semibold text-white/95 mb-2 drop-shadow-lg text-xs">
         Población
       </h3>
       <p className="font-bold text-white drop-shadow-lg text-base">
         {formatPopulation(city.population)}
       </p>
     </GlassCard>
     {/* Repeat for other 3 stats */}
   </div>
   ```
- [ ] 3. Remove hardcoded glassmorphism styling from individual stat cards
- [ ] 4. Preserve responsive text sizing based on `distance` prop

**Testing**: - [ ] Verify CityCard stats render identically with new GlassCard

### Step 20: Handle Background Texture Imports
- [ ] **Files**: `HeroSection.tsx`, `OverviewSection.tsx`

**Actions**:
- [ ] 1. Remove `backgroundTexture` imports from components using `SectionLayout`
- [ ] 2. Move texture import to `SectionLayout` component
- [ ] 3. Update `SectionLayout` to handle texture application when `withTexture` prop is true
- [ ] 4. Verify texture styling matches previous implementation

**Testing**: - [ ] Verify background textures render identically

### Step 21: Cleanup and Optimization
- [ ] **Actions**:
- [ ] 1. Remove unused component files:
   - `FeatureCard.tsx` (replaced by GlassCard)
- [ ] 2. Update imports across all modified files
- [ ] 3. Run linter and fix any issues
- [ ] 4. Verify no duplicate styling exists
- [ ] 5. Test all pages for visual consistency

**Testing**: - [ ] Full application regression test

### Step 22: Documentation Update
- [ ] **Actions**:
- [ ] 1. Update component documentation
- [ ] 2. Create usage examples for each new component
- [ ] 3. Document migration from old components
- [ ] 4. Update README if necessary

**Testing**: - [ ] Verify documentation accuracy

---

## 4. Implementation Priority & Critical Notes

### Priority Levels
1. **High Priority**: Steps 1-6 (GlassCard, IconContainer, basic refactors)
   - These provide immediate reusability benefits
   - Low risk, high impact changes
2. **Medium Priority**: Steps 7-12 (SectionLayout, StatsGrid)
   - More complex but essential for consistency
3. **Complex Priority**: Steps 13-16 (Button, advanced components)
   - Require careful handling of complex styling
4. **Final Polish**: Steps 17-22 (ContentWrapper, cleanup, documentation)

### Critical Implementation Notes

#### Interface Alignment
- `StatItem` interface **must** include `trend` property (required, not optional)
- `GlassCard` needs `textColor` prop to handle both dark (`OverviewSection`) and light (`CityCard`) text

#### Animation Preservation
- Preserve all hover animations: `hover:scale-[1.02]`, `group-hover:scale-110`
- Maintain transition timings: `transition-all duration-300`
- Keep complex button gradient overlays and backdrop blur effects

#### Background Texture Handling
- Components currently import `backgroundTexture` directly from `../../assets/background2.svg`
- `SectionLayout` must centralize this import and application
- Texture styling: `backgroundSize: '600px 600px'`, `opacity: 0.07`

#### Missing Refactor Areas
- `CityCard` internal stat cards (lines 84-146) use glassmorphism but weren't in original plan
- Complex button implementations with multiple styling layers need special attention

### Testing Checkpoints
- Visual regression testing after each major step
- Verify glassmorphism effects render identically
- Confirm all animations and transitions preserved
- Test responsive behavior across all screen sizes

---
