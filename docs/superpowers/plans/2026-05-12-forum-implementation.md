# Forum News Timeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/forum` route with a chronological news feed, search filtering, and a draggable timeline scrollbar on the right that syncs with feed scroll.

**Architecture:** Service-abstracted data layer (JSON now, API-swappable later) feeds React components. Timeline uses bidirectional scroll sync via a shared `scrollRef`. All components follow the site's editorial design system (EB Garamond, cream/blue palette, thin borders, no shadows).

**Tech Stack:** React, TypeScript, Tailwind, Vite (for static JSON import), date handling via native `Date` API.

---

## File Structure

**Backend (DB):**
- Create: `backend/database/migrations/007_news_table.sql`

**Frontend (Types & Services):**
- Create: `frontend/src/types/news.ts`
- Create: `frontend/src/services/newsService.ts`
- Create: `frontend/src/data/movilidad_news.json` (copy from project root)

**Frontend (Components):**
- Create: `frontend/src/components/forum/NewsCard.tsx`
- Create: `frontend/src/components/forum/NewsSearch.tsx`
- Create: `frontend/src/components/forum/NewsTimeline.tsx`
- Create: `frontend/src/pages/ForumPage.tsx`
- Modify: `frontend/src/App.tsx` (add `/forum` route)
- Modify: `frontend/src/components/layout/Navbar.tsx` (add "Foro" link)

---

## Tasks

### Task 1: Copy JSON and create types

**Files:**
- Create: `frontend/src/data/movilidad_news.json`
- Create: `frontend/src/types/news.ts`

- [ ] **Step 1: Copy movilidad_news.json to frontend**

```bash
cp /Users/alvarodelser/Projects/BikesForCities-webapp/data/movilidad_news.json \
   /Users/alvarodelser/Projects/BikesForCities-webapp/frontend/src/data/movilidad_news.json
```

- [ ] **Step 2: Create news types file**

`frontend/src/types/news.ts`:
```typescript
export interface NewsItem {
  id: number;
  headline: string;
  summary?: string;
  link?: string;
  source?: string;
  publication_dt: string; // ISO date YYYY-MM-DD
  topics?: string[];
  raw_txt?: string;
  city?: string;
}
```

- [ ] **Step 3: Verify the file exists**

```bash
ls -la frontend/src/data/movilidad_news.json frontend/src/types/news.ts
```

Expected: Both files listed.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/data/movilidad_news.json frontend/src/types/news.ts
git commit -m "feat: add news data and types"
```

---

### Task 2: Create news service with data mapping

**Files:**
- Create: `frontend/src/services/newsService.ts`

- [ ] **Step 1: Create news service**

`frontend/src/services/newsService.ts`:
```typescript
import newsData from '../data/movilidad_news.json';
import { NewsItem } from '../types/news';

interface RawNewsItem {
  headline: string;
  description?: string;
  link?: string;
  publication_date?: string;
  source?: string;
  topics?: string[];
}

export function getNews(): NewsItem[] {
  return newsData
    .map((item: RawNewsItem, index: number): NewsItem => ({
      id: index + 1,
      headline: item.headline,
      summary: item.description,
      link: item.link,
      source: item.source,
      publication_dt: item.publication_date || '',
      topics: item.topics,
      raw_txt: undefined,
      city: undefined,
    }))
    .sort((a, b) => 
      new Date(b.publication_dt).getTime() - new Date(a.publication_dt).getTime()
    );
}
```

- [ ] **Step 2: Verify the service returns data**

Create a quick test file `frontend/src/services/newsService.test.ts`:
```typescript
import { getNews } from './newsService';

describe('newsService', () => {
  it('returns news items sorted newest-first', () => {
    const items = getNews();
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].publication_dt).toBeTruthy();
    
    // Verify sorted newest-first
    for (let i = 0; i < items.length - 1; i++) {
      const current = new Date(items[i].publication_dt).getTime();
      const next = new Date(items[i + 1].publication_dt).getTime();
      expect(current).toBeGreaterThanOrEqual(next);
    }
  });

  it('maps description to summary', () => {
    const items = getNews();
    const first = items[0];
    expect(first.summary).toBeTruthy();
  });
});
```

- [ ] **Step 3: Run the test**

```bash
cd frontend && npm test -- newsService.test.ts --run
```

Expected: PASS (2 tests)

- [ ] **Step 4: Remove test file**

```bash
rm frontend/src/services/newsService.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/services/newsService.ts
git commit -m "feat: add news service with JSON mapping"
```

---

### Task 3: Create NewsCard component

**Files:**
- Create: `frontend/src/components/forum/NewsCard.tsx`

- [ ] **Step 1: Create NewsCard component**

`frontend/src/components/forum/NewsCard.tsx`:
```typescript
import React from 'react';
import { NewsItem } from '../../types/news';

interface NewsCardProps {
  item: NewsItem;
}

const NewsCard: React.FC<NewsCardProps> = ({ item }) => {
  const dateStr = new Date(item.publication_dt).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <a
      href={item.link}
      target="_blank"
      rel="noopener noreferrer"
      className="block p-4 border-b border-[var(--blue-light)] hover:border-l-4 hover:border-l-[var(--green-dark)] transition-colors duration-150"
    >
      <h3
        className="font-heading text-lg font-bold text-[var(--blue-dark)] leading-tight mb-1"
      >
        {item.headline}
      </h3>
      <p className="text-sm text-[var(--black)] opacity-60">
        {item.source} · {dateStr}
      </p>
    </a>
  );
};

export default NewsCard;
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/forum/NewsCard.tsx
git commit -m "feat: add NewsCard component"
```

---

### Task 4: Create NewsSearch component

**Files:**
- Create: `frontend/src/components/forum/NewsSearch.tsx`

- [ ] **Step 1: Create NewsSearch component**

`frontend/src/components/forum/NewsSearch.tsx`:
```typescript
import React from 'react';

interface NewsSearchProps {
  value: string;
  onChange: (value: string) => void;
}

const NewsSearch: React.FC<NewsSearchProps> = ({ value, onChange }) => {
  return (
    <div className="px-4 py-3 border-b-2 border-[var(--blue)] bg-[var(--cream)]">
      <input
        type="text"
        placeholder="Buscar noticias..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-[var(--cream)] text-[var(--black)] placeholder-[var(--black)] placeholder-opacity-40 border-b-2 border-[var(--blue)] outline-none font-body text-base py-2 px-1 transition-colors"
      />
    </div>
  );
};

export default NewsSearch;
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/forum/NewsSearch.tsx
git commit -m "feat: add NewsSearch component"
```

---

### Task 5: Create NewsTimeline component

**Files:**
- Create: `frontend/src/components/forum/NewsTimeline.tsx`

- [ ] **Step 1: Create NewsTimeline component**

`frontend/src/components/forum/NewsTimeline.tsx`:
```typescript
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { NewsItem } from '../../types/news';

interface NewsTimelineProps {
  items: NewsItem[];
  scrollRef: React.RefObject<HTMLDivElement>;
  onDotClick: (index: number) => void;
}

const NewsTimeline: React.FC<NewsTimelineProps> = ({
  items,
  scrollRef,
  onDotClick,
}) => {
  const timelineRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const [thumbTop, setThumbTop] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Compute proportional positions for dots and year labels
  const dates = items.map(i => new Date(i.publication_dt).getTime());
  const minDate = Math.min(...dates);
  const maxDate = Math.max(...dates);
  const dateRange = maxDate - minDate || 1;

  const dotPositions = items.map(item => {
    const itemDate = new Date(item.publication_dt).getTime();
    return ((itemDate - minDate) / dateRange) * 100;
  });

  // Year labels: map unique years to their first position
  const yearLabels: { year: number; position: number }[] = [];
  const seenYears = new Set<number>();
  items.forEach((item, idx) => {
    const year = new Date(item.publication_dt).getFullYear();
    if (!seenYears.has(year)) {
      seenYears.add(year);
      yearLabels.push({ year, position: dotPositions[idx] });
    }
  });

  // Handle feed scroll → update thumb position
  const handleFeedScroll = useCallback(() => {
    if (!scrollRef.current || !timelineRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const scrollFraction = scrollHeight > clientHeight
      ? scrollTop / (scrollHeight - clientHeight)
      : 0;
    const trackHeight = timelineRef.current.clientHeight;
    setThumbTop(Math.max(0, scrollFraction * (trackHeight - 24))); // 24px thumb height
  }, [scrollRef]);

  // Handle thumb drag → update feed scroll
  const handleThumbPointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!isDragging || !timelineRef.current || !scrollRef.current) return;

    const trackRect = timelineRef.current.getBoundingClientRect();
    const trackHeight = trackRect.height;
    const dragY = e.clientY - trackRect.top;
    const fraction = Math.max(0, Math.min(1, dragY / trackHeight));

    const { scrollHeight, clientHeight } = scrollRef.current;
    scrollRef.current.scrollTop = fraction * (scrollHeight - clientHeight);
  }, [isDragging, scrollRef]);

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  // Handle dot click → jump feed to that article
  const handleDotClick = (index: number) => {
    onDotClick(index);
  };

  useEffect(() => {
    const feedDiv = scrollRef.current;
    if (feedDiv) {
      feedDiv.addEventListener('scroll', handleFeedScroll);
    }
    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);

    return () => {
      if (feedDiv) feedDiv.removeEventListener('scroll', handleFeedScroll);
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };
  }, [handleFeedScroll, handlePointerMove]);

  return (
    <div
      ref={timelineRef}
      className="sticky top-0 h-[calc(100vh-80px)] w-7 flex flex-col items-center bg-[var(--cream)] py-4"
    >
      <div className="relative flex-1 w-1 bg-[var(--blue-light)]">
        {/* Year labels */}
        {yearLabels.map((label) => (
          <div
            key={label.year}
            className="absolute left-3 text-xs text-[var(--black)] whitespace-nowrap"
            style={{ top: `${label.position}%` }}
          >
            {label.year}
          </div>
        ))}

        {/* Article dots */}
        {items.map((item, idx) => (
          <button
            key={item.id}
            onClick={() => handleDotClick(idx)}
            className="absolute left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[var(--blue-dark)] hover:bg-[var(--green-dark)] transition-colors cursor-pointer"
            style={{ top: `${dotPositions[idx]}%` }}
            title={item.headline}
          />
        ))}

        {/* Draggable thumb */}
        <div
          ref={thumbRef}
          onPointerDown={handleThumbPointerDown}
          className="absolute left-1/2 -translate-x-1/2 w-5 h-6 rounded-full bg-[var(--green-dark)] cursor-grab active:cursor-grabbing transition-colors hover:bg-[var(--green)] shadow-sm"
          style={{ top: `${thumbTop}px` }}
        />
      </div>
    </div>
  );
};

export default NewsTimeline;
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/forum/NewsTimeline.tsx
git commit -m "feat: add NewsTimeline component with scroll sync"
```

---

### Task 6: Create ForumPage component

**Files:**
- Create: `frontend/src/pages/ForumPage.tsx`

- [ ] **Step 1: Create ForumPage component**

`frontend/src/pages/ForumPage.tsx`:
```typescript
import React, { useRef, useMemo } from 'react';
import { getNews } from '../services/newsService';
import NewsCard from '../components/forum/NewsCard';
import NewsSearch from '../components/forum/NewsSearch';
import NewsTimeline from '../components/forum/NewsTimeline';

const ForumPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = React.useState('');
  const feedRef = useRef<HTMLDivElement>(null);

  const allNews = useMemo(() => getNews(), []);

  const filteredNews = useMemo(() => {
    if (!searchQuery.trim()) return allNews;

    const query = searchQuery.toLowerCase();
    return allNews.filter(item =>
      item.headline.toLowerCase().includes(query) ||
      (item.summary && item.summary.toLowerCase().includes(query))
    );
  }, [searchQuery, allNews]);

  const handleDotClick = (index: number) => {
    if (!feedRef.current) return;

    const cards = feedRef.current.querySelectorAll('[data-news-id]');
    if (cards[index]) {
      const card = cards[index] as HTMLElement;
      const feedTop = feedRef.current.getBoundingClientRect().top;
      const cardTop = card.getBoundingClientRect().top;
      const scrollOffset = cardTop - feedTop;
      feedRef.current.scrollTop += scrollOffset - 20; // 20px padding
    }
  };

  return (
    <div className="flex h-[calc(100vh-80px)] bg-[var(--cream)]">
      {/* Left: Feed */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <NewsSearch value={searchQuery} onChange={setSearchQuery} />
        <div
          ref={feedRef}
          className="flex-1 overflow-y-scroll"
        >
          {filteredNews.length > 0 ? (
            filteredNews.map((item) => (
              <div key={item.id} data-news-id={item.id}>
                <NewsCard item={item} />
              </div>
            ))
          ) : (
            <div className="p-6 text-center text-[var(--black)] opacity-50">
              No hay noticias que coincidan con tu búsqueda.
            </div>
          )}
        </div>
      </div>

      {/* Right: Timeline */}
      <NewsTimeline
        items={filteredNews}
        scrollRef={feedRef}
        onDotClick={handleDotClick}
      />
    </div>
  );
};

export default ForumPage;
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/ForumPage.tsx
git commit -m "feat: add ForumPage with feed and timeline"
```

---

### Task 7: Add /forum route to App.tsx

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Read the current App.tsx**

```bash
head -40 frontend/src/App.tsx
```

- [ ] **Step 2: Add the import and route**

In `frontend/src/App.tsx`, add after the existing page imports:

```typescript
import ForumPage from "./pages/ForumPage";
```

And add this route in the `<Routes>` block before the `<Route path="*">`:

```typescript
<Route path="/forum" element={<ForumPage />} />
```

- [ ] **Step 3: Verify the file**

```bash
grep -n "ForumPage\|/forum" frontend/src/App.tsx
```

Expected: Two matches (import and route).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat: add /forum route"
```

---

### Task 8: Add "Foro" link to Navbar

**Files:**
- Modify: `frontend/src/components/layout/Navbar.tsx`

- [ ] **Step 1: Inspect Navbar structure**

```bash
head -80 frontend/src/components/layout/Navbar.tsx | tail -40
```

- [ ] **Step 2: Add Foro link**

Find the navbar link list (usually an unordered list or flexbox of links). Add a new link item:

```typescript
<NavLink to="/forum" className={navLinkClass}>
  Foro
</NavLink>
```

Or if the navbar uses a different structure, add the link before or after the existing navigation items. The exact implementation depends on the existing code structure — locate the pattern used for other links (e.g., `/about`, `/compare`) and replicate it for `/forum`.

- [ ] **Step 3: Verify the link is added**

```bash
grep -n "Foro\|/forum" frontend/src/components/layout/Navbar.tsx
```

Expected: At least one match.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/layout/Navbar.tsx
git commit -m "feat: add Foro link to navbar"
```

---

### Task 9: Add DB migration

**Files:**
- Create: `backend/database/migrations/007_news_table.sql`

- [ ] **Step 1: Create migration file**

`backend/database/migrations/007_news_table.sql`:
```sql
CREATE TABLE IF NOT EXISTS news (
    id             SERIAL PRIMARY KEY,
    headline       TEXT NOT NULL,
    summary        TEXT,
    link           TEXT,
    source         TEXT,
    publication_dt DATE,
    topics         TEXT[],
    raw_txt        TEXT,
    city           TEXT,
    created_at     TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_news_publication_dt ON news(publication_dt);
CREATE INDEX IF NOT EXISTS idx_news_city ON news(city);
```

- [ ] **Step 2: Verify file exists**

```bash
cat backend/database/migrations/007_news_table.sql
```

- [ ] **Step 3: Commit**

```bash
git add backend/database/migrations/007_news_table.sql
git commit -m "feat: add news table migration"
```

---

### Task 10: Manual browser testing

**Files:**
- None (testing existing work)

- [ ] **Step 1: Start the dev server**

```bash
cd frontend && npm run dev
```

- [ ] **Step 2: Navigate to /forum**

Open http://localhost:5173/forum

- [ ] **Step 3: Verify layout**

- [ ] Search bar is visible at top-left
- [ ] News cards render below search bar
- [ ] Timeline is visible on right side with dots
- [ ] Timeline spans full height of viewport

- [ ] **Step 4: Test search filtering**

Type "bicicleta" in search bar. Verify only matching headlines appear.

- [ ] **Step 5: Test scroll sync**

Scroll the feed with the mouse wheel. Verify the timeline thumb moves proportionally.

- [ ] **Step 6: Test timeline drag**

Drag the timeline thumb up/down. Verify the feed scrolls.

- [ ] **Step 7: Test dot click**

Click a dot on the timeline. Verify the feed jumps to that article.

- [ ] **Step 8: Test card click**

Click a news headline. Verify it opens the link in a new tab (if link exists).

- [ ] **Step 9: Verify Foro link in navbar**

Navigate to homepage. Verify "Foro" link is in navbar. Click it and verify it navigates to /forum.

- [ ] **Step 10: No console errors**

Open browser DevTools console. Verify no errors or warnings are logged.

- [ ] **Step 11: Commit any hotfixes (if needed)**

If any bugs found, fix them and commit:

```bash
git add <files>
git commit -m "fix: [description]"
```

Otherwise, the implementation is complete.

---

## Checklist Summary

- [ ] JSON copied and types created
- [ ] Service layer with mapping implemented
- [ ] NewsCard component created
- [ ] NewsSearch component created
- [ ] NewsTimeline component with scroll sync created
- [ ] ForumPage component created
- [ ] /forum route added
- [ ] Foro navbar link added
- [ ] DB migration file created
- [ ] Manual browser testing completed
