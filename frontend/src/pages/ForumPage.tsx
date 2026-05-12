import React, { useRef, useMemo, useState } from 'react';
import { getNews } from '../services/newsService';
import NewsCard from '../components/forum/NewsCard';
import NewsTimeline from '../components/forum/NewsTimeline';
import { Search, X } from 'lucide-react';
import CityBuildingBackground, { type CityBuildingBackgroundHandle } from '../components/forum/CityBuildingBackground';
import BuildingTrajectories from '../components/forum/BuildingTrajectories';
import { fetchCities } from '../services/api';
import type { CityData } from '../constants/cities';

const ForumPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [showSearch, setShowSearch] = useState(false);
  const pageRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const bgRef = useRef<CityBuildingBackgroundHandle | null>(null);
  const [cities, setCities] = useState<CityData[]>([]);
  const selectedCityId = useMemo(
    () => {
      if (cities.length === 0) return 1;
      // Pick the city with the largest population for denser buildings
      const largest = cities.reduce((prev, current) =>
        (current.population || 0) > (prev.population || 0) ? current : prev
      );
      return largest.id ?? 1;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cities.length > 0]
  );

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
    if (!pageRef.current) return;

    const cards = pageRef.current.querySelectorAll('[data-news-id]');
    if (cards[index]) {
      const card = cards[index] as HTMLElement;
      const cardTop = card.getBoundingClientRect().top;
      const pageTop = pageRef.current.getBoundingClientRect().top;
      window.scrollBy({
        top: cardTop - pageTop - 120,
        behavior: 'smooth'
      });
    }
  };

  React.useEffect(() => {
    if (showSearch && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showSearch]);

  React.useEffect(() => {
    fetchCities().then(setCities).catch(() => {
      // Silent fail — default city id 1 will be used
    });
  }, []);

  return (
    <div ref={pageRef} className="scrollbar-hide min-h-screen" style={{ position: 'relative', background: 'var(--forum-bg)' }}>
      <CityBuildingBackground cityId={selectedCityId} ref={bgRef} />
      <BuildingTrajectories bgRef={bgRef} />
      {/* Header */}
      <div
        className="sticky top-0 z-50 border-b border-[var(--blue-light)] py-6 px-8"
        style={{
          background: 'rgba(237, 224, 204, 0.72)',
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.5)',
        }}
      >
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="font-heading text-2xl font-bold text-[var(--blue-dark)]">Foro de Noticias</h1>
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="p-2 hover:bg-[var(--blue-light)]/20 rounded transition-colors"
          >
            {showSearch ? (
              <X size={20} className="text-[var(--blue-dark)]" />
            ) : (
              <Search size={20} className="text-[var(--blue-dark)]" />
            )}
          </button>
        </div>

        {/* Search bar - hidden by default */}
        {showSearch && (
          <div className="max-w-4xl mx-auto mt-4">
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Buscar noticias..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[var(--cream)] text-[var(--black)] placeholder-[var(--black)] placeholder-opacity-40 border-b-2 border-[var(--blue)] outline-none font-body text-base py-2 px-1 transition-colors"
            />
          </div>
        )}
      </div>

      {/* Feed content */}
      <div className="pr-8 max-w-4xl mx-auto py-8" style={{ position: 'relative', zIndex: 3 }}>
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

      {/* Right: Fixed Timeline */}
      <NewsTimeline
        items={filteredNews}
        onDotClick={handleDotClick}
      />
    </div>
  );
};

export default ForumPage;
